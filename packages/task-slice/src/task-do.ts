import { DurableObject } from "cloudflare:workers";
import { filterVisible, requireReceipt, type Receipt } from "authz";
import type { AccessState } from "authz";
import type { ActorContext } from "identity/principal";
import { envelope, type RequestContext } from "control-plane";
import {
  ensureListSchema,
  projectListSnapshot,
  queryFacetRows,
  queryVisibleEntityIds,
  queryVisibleFacetRows,
  type AccessProjectionRow,
  type SoupD1,
  type SoupDelta,
  type SoupItem,
} from "soup";
import { operatorAlertsFromPoison, type OperatorAlert } from "./operator-alerts.js";
import {
  TaskSlice,
  type TaskRecord,
  type TaskRpc,
  type TaskSliceSnapshot,
  type TaskView,
} from "./slice.js";

export interface TaskSliceEnv {
  SOUP: SoupD1;
  /** Queues producer — durable outbox re-drive after a write (ADR-005). */
  TASK_OUTBOX: { send(message: { tenantId: string }): Promise<unknown> };
}

interface SubscribeAttachment {
  cursor: number;
  actor: ActorContext;
}

export const SUBSCRIBE_TICKET_TTL_MS = 30_000;
export const PROJECTION_ALARM_RETRY_MS = 1_000;

interface PendingProjection {
  generation: number;
  tenantId: string;
}

/**
 * Authoritative task store (OD-7 document + facet task) on SQLite DO storage.
 * Soup lists family is projected to D1 (OD-27), not this DO.
 * Live subscribers attach via hibernation WebSockets on `/subscribe`.
 */
export class TaskSliceDurableObject extends DurableObject<TaskSliceEnv> implements TaskRpc {
  #writeTail: Promise<void> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: TaskSliceEnv) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS snapshot (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        json TEXT NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS subscribe_ticket (
        ticket TEXT PRIMARY KEY,
        actor_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS projection_delivery (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        generation INTEGER NOT NULL,
        tenant_id TEXT NOT NULL
      )
    `);
  }

  async #serializeWrite<T>(run: () => Promise<T>): Promise<T> {
    const previous = this.#writeTail;
    let release!: () => void;
    this.#writeTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await run();
    } finally {
      release();
    }
  }

  #load(): TaskSlice {
    const rows = this.ctx.storage.sql
      .exec<{ json: string }>("SELECT json FROM snapshot WHERE id = 1")
      .toArray();
    if (!rows[0]) return new TaskSlice();
    return TaskSlice.fromSnapshot(JSON.parse(rows[0].json) as TaskSliceSnapshot);
  }

  #tenantId(slice?: TaskSlice): string | undefined {
    const meta = this.ctx.storage.sql
      .exec<{ v: string }>("SELECT v FROM meta WHERE k = 'tenant_id'")
      .toArray()[0];
    if (meta?.v) return meta.v;
    return slice?.toSnapshot().docs[0]?.tenantId;
  }

  #assertTenant(actor: ActorContext, slice?: TaskSlice): void {
    const claimed = actor.actor.tenantId;
    if (!claimed) throw new Error("tenant-scoped actor required");
    const bound = this.#tenantId(slice);
    if (bound && bound !== claimed) throw new Error("tenant mismatch");
  }

  #accessProjection(slice: TaskSlice, tenantId: string): AccessProjectionRow[] {
    return slice.accessProjection(tenantId);
  }

  async #visibleDeltas(slice: TaskSlice, actor: ActorContext, fromSeq: number): Promise<SoupDelta[]> {
    const tenantId = this.#tenantId(slice);
    if (!tenantId) return [];
    const visible = new Set(await queryVisibleEntityIds(this.env.SOUP, tenantId, actor.actor.id));
    return slice.plane.lists.replayFrom(fromSeq).filter((delta) => visible.has(delta.item.entityId));
  }

  #consumeSubscribeTicket(ticket: string): ActorContext | null {
    if (!ticket) return null;
    const row = this.ctx.storage.sql
      .exec<{ actor_json: string; expires_at: number }>(
        "DELETE FROM subscribe_ticket WHERE ticket = ? RETURNING actor_json, expires_at",
        ticket,
      )
      .toArray()[0];
    if (!row || row.expires_at <= Date.now()) return null;
    try {
      return JSON.parse(row.actor_json) as ActorContext;
    } catch {
      return null;
    }
  }

  #pendingProjection(): PendingProjection | null {
    const row = this.ctx.storage.sql
      .exec<{ generation: number; tenant_id: string }>(
        "SELECT generation, tenant_id FROM projection_delivery WHERE id = 1",
      )
      .toArray()[0];
    return row ? { generation: row.generation, tenantId: row.tenant_id } : null;
  }

  #persistAuthority(slice: TaskSlice, tenantId: string): number {
    const snapshot = JSON.stringify(slice.toSnapshot());
    return this.ctx.storage.transactionSync(() => {
      const current = this.ctx.storage.sql
        .exec<{ v: string }>("SELECT v FROM meta WHERE k = 'projection_generation'")
        .toArray()[0];
      const generation = Number(current?.v ?? "0") + 1;
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO snapshot (id, json) VALUES (1, ?)",
        snapshot,
      );
      this.ctx.storage.sql.exec("INSERT OR REPLACE INTO meta (k, v) VALUES ('tenant_id', ?)", tenantId);
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO meta (k, v) VALUES ('projection_generation', ?)",
        String(generation),
      );
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO projection_delivery (id, generation, tenant_id) VALUES (1, ?, ?)",
        generation,
        tenantId,
      );
      return generation;
    });
  }

  #persistSnapshot(slice: TaskSlice): void {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO snapshot (id, json) VALUES (1, ?)",
      JSON.stringify(slice.toSnapshot()),
    );
  }

  async #enqueueProjection(tenantId: string): Promise<void> {
    const fail = this.ctx.storage.sql
      .exec<{ v: string }>("DELETE FROM meta WHERE k = 'test_fail_next_outbox' RETURNING v")
      .toArray()[0];
    if (fail) throw new Error("injected TASK_OUTBOX.send failure");
    await this.env.TASK_OUTBOX.send({ tenantId });
  }

  async #completeProjection(generation: number): Promise<void> {
    this.ctx.storage.sql.exec(
      "DELETE FROM projection_delivery WHERE id = 1 AND generation = ?",
      generation,
    );
    if (!this.#pendingProjection()) await this.ctx.storage.deleteAlarm();
  }

  async #deliverProjection(
    slice: TaskSlice,
    pending: PendingProjection,
    enqueue: boolean,
  ): Promise<void> {
    if (enqueue) await this.#enqueueProjection(pending.tenantId);
    await projectListSnapshot(
      this.env.SOUP,
      slice.plane.lists.snapshot(),
      pending.tenantId,
      this.#accessProjection(slice, pending.tenantId),
    );
    await this.#completeProjection(pending.generation);
    await this.#broadcast(slice);
  }

  async #save(slice: TaskSlice): Promise<void> {
    const tenantId = this.#tenantId(slice) ?? slice.toSnapshot().docs[0]?.tenantId;
    if (!tenantId) {
      this.#persistSnapshot(slice);
      return;
    }

    // Schedule recovery before committing authority. With writes serialized, an
    // alarm cannot clear this recovery path before its matching marker exists.
    await this.ctx.storage.setAlarm(Date.now() + PROJECTION_ALARM_RETRY_MS);
    const generation = this.#persistAuthority(slice, tenantId);
    try {
      await this.#deliverProjection(slice, { generation, tenantId }, true);
    } catch (error) {
      await this.ctx.storage.setAlarm(Date.now() + PROJECTION_ALARM_RETRY_MS);
      throw error;
    }
  }

  /** Queue consumer entry — re-drains the outbox and rebuilds the latest D1 projection. */
  async drainOutbox(): Promise<{ pending: number }> {
    return this.#serializeWrite(async () => {
      const slice = this.#load();
      slice.drain();
      this.#persistSnapshot(slice);
      const pending = this.#pendingProjection();
      if (pending) {
        await this.#deliverProjection(slice, pending, false);
      } else {
        const tenantId = this.#tenantId(slice);
        await projectListSnapshot(
          this.env.SOUP,
          slice.plane.lists.snapshot(),
          tenantId,
          tenantId ? this.#accessProjection(slice, tenantId) : [],
        );
        await this.#broadcast(slice);
      }
      return { pending: slice.outbox.pending().length };
    });
  }

  async alarm(): Promise<void> {
    await this.#serializeWrite(async () => {
      const pending = this.#pendingProjection();
      if (!pending) {
        await this.ctx.storage.deleteAlarm();
        return;
      }
      const slice = this.#load();
      slice.drain();
      this.#persistSnapshot(slice);
      try {
        await this.#deliverProjection(slice, pending, true);
      } catch {
        await this.ctx.storage.setAlarm(Date.now() + PROJECTION_ALARM_RETRY_MS);
      }
    });
  }

  async #broadcast(slice: TaskSlice): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SubscribeAttachment | null;
      if (!att?.actor) continue;
      const deltas = await this.#visibleDeltas(slice, att.actor, att.cursor);
      if (deltas.length === 0) {
        ws.serializeAttachment({ cursor: slice.plane.lists.seq, actor: att.actor } satisfies SubscribeAttachment);
        continue;
      }
      ws.send(JSON.stringify({ type: "delta", deltas, seq: slice.plane.lists.seq }));
      ws.serializeAttachment({ cursor: slice.plane.lists.seq, actor: att.actor } satisfies SubscribeAttachment);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/subscribe") {
      if (request.method !== "GET") {
        return new Response("method not allowed", { status: 405 });
      }
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return new Response("websocket upgrade required", { status: 426 });
      }
      const actor = this.#consumeSubscribeTicket(url.searchParams.get("ticket") ?? "");
      if (!actor) return new Response("invalid or spent subscribe ticket", { status: 401 });
      const slice = this.#load();
      try {
        this.#assertTenant(actor, slice);
      } catch (error) {
        return new Response(error instanceof Error ? error.message : "tenant mismatch", { status: 403 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const cursor = Number(url.searchParams.get("cursor") ?? "0");
      const from = Number.isFinite(cursor) ? cursor : 0;
      this.ctx.acceptWebSocket(server);
      const deltas = await this.#visibleDeltas(slice, actor, from);
      server.serializeAttachment({ cursor: slice.plane.lists.seq, actor } satisfies SubscribeAttachment);
      server.send(JSON.stringify({ type: "replay", deltas, seq: slice.plane.lists.seq }));
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("outreach task-slice", { headers: { "content-type": "text/plain" } });
  }

  webSocketClose(): void {
    // Hibernation callback — client disconnect is not an error.
  }

  webSocketError(): void {
    // Swallow peer-reset during Miniflare reset().
  }

  async createTask(title: string, ctx: RequestContext): Promise<TaskView> {
    return this.#serializeWrite(async () => {
      const slice = this.#load();
      this.#assertTenant(ctx.actor, slice);
      const view = slice.createTask(title, ctx);
      await this.#save(slice);
      return view;
    });
  }

  async createSubscribeTicket(actor: ActorContext): Promise<import("./domain-api.js").SubscribeTicket> {
    const slice = this.#load();
    this.#assertTenant(actor, slice);
    const ticket = crypto.randomUUID();
    const expiresAt = Date.now() + SUBSCRIBE_TICKET_TTL_MS;
    this.ctx.storage.sql.exec("DELETE FROM subscribe_ticket WHERE expires_at <= ?", Date.now());
    this.ctx.storage.sql.exec(
      "INSERT INTO subscribe_ticket (ticket, actor_json, expires_at) VALUES (?, ?, ?)",
      ticket,
      JSON.stringify(actor),
      expiresAt,
    );
    return { ticket, expiresAt };
  }

  async updateTitle(title: string, ctx: RequestContext): Promise<TaskRecord> {
    return this.#mutate(ctx, "edit", (slice, gated) => slice.updateTitle(title, gated));
  }

  async setStatus(status: string, ctx: RequestContext): Promise<TaskRecord> {
    return this.#mutate(ctx, "edit", (slice, gated) => slice.setStatus(status, gated));
  }

  async setPriority(priority: string, ctx: RequestContext): Promise<TaskRecord> {
    return this.#mutate(ctx, "edit", (slice, gated) => slice.setPriority(priority, gated));
  }

  async setAssignee(assigneeId: string, ctx: RequestContext): Promise<TaskRecord> {
    return this.#mutate(ctx, "edit", (slice, gated) => slice.setAssignee(assigneeId, gated));
  }

  async markDone(done: boolean, ctx: RequestContext): Promise<TaskRecord> {
    return this.#mutate(ctx, "edit", (slice, gated) => slice.markDone(done, gated));
  }

  async listTasks(receipts: readonly Receipt[]): Promise<SoupItem[]> {
    const slice = this.#load();
    const tenantId = this.#tenantId(slice);
    if (!tenantId) return [];
    await ensureListSchema(this.env.SOUP);
    const rows = await queryFacetRows(this.env.SOUP, tenantId, "task");
    return filterVisible(rows, receipts);
  }

  async listVisible(actor: ActorContext): Promise<SoupItem[]> {
    const slice = this.#load();
    this.#assertTenant(actor, slice);
    const tenantId = this.#tenantId(slice);
    if (!tenantId) return [];
    await ensureListSchema(this.env.SOUP);
    return queryVisibleFacetRows(this.env.SOUP, tenantId, actor.actor.id, "task");
  }

  async listActivity(actor: ActorContext): Promise<import("control-plane").ActivityFact[]> {
    const slice = this.#load();
    this.#assertTenant(actor, slice);
    const tenantId = this.#tenantId(slice);
    if (!tenantId) return [];
    const visible = new Set(await queryVisibleEntityIds(this.env.SOUP, tenantId, actor.actor.id));
    return slice.activity.list().filter((fact) => visible.has(fact.entityId));
  }

  async listAlerts(actor: ActorContext): Promise<OperatorAlert[]> {
    const slice = this.#load();
    this.#assertTenant(actor, slice);
    const tenantId = this.#tenantId(slice);
    if (!tenantId) return [];
    const visible = new Set(await queryVisibleEntityIds(this.env.SOUP, tenantId, actor.actor.id));
    return operatorAlertsFromPoison(slice.outbox.poison(), visible);
  }

  async seq(): Promise<number> {
    return this.#load().plane.lists.seq;
  }

  async replayFrom(seq: number, actor: ActorContext): Promise<SoupDelta[]> {
    const slice = this.#load();
    this.#assertTenant(actor, slice);
    return this.#visibleDeltas(slice, actor, seq);
  }

  async rebuildProjection(actor: ActorContext): Promise<void> {
    await this.#serializeWrite(async () => {
      const slice = this.#load();
      this.#assertTenant(actor, slice);
      slice.rebuildProjection();
      await this.#save(slice);
    });
  }

  /** Test/debug helper — not part of TaskRpc. */
  async poisonPending(attempts = 5): Promise<number> {
    return this.#serializeWrite(async () => {
      const slice = this.#load();
      const task = slice.toSnapshot().docs[0];
      if (!task) return 0;
      slice.outbox.append(
        envelope({
          topic: "documents",
          entityType: "document",
          entityId: task.id,
          tenantId: task.tenantId,
          actorId: task.id,
          onBehalfOfId: null,
          occurredAt: 99,
          version: 99,
          payload: { title: "never", facet: "task" },
          receipt: null,
          correlationId: "poison",
          eventId: `poison-${task.id}-${slice.toSnapshot().clock}`,
        }),
      );
      for (let i = 0; i < attempts; i += 1) {
        slice.outbox.drain(() => {
          throw new Error("projector down");
        });
      }
      this.#persistSnapshot(slice);
      return slice.outbox.poison().length;
    });
  }

  /** Fault injection for Workers tests; service binding only, never browser-exposed. */
  async failNextOutboxSend(): Promise<void> {
    await this.#serializeWrite(async () => {
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO meta (k, v) VALUES ('test_fail_next_outbox', '1')",
      );
    });
  }

  async get(id: string, actor: ActorContext): Promise<TaskRecord | null> {
    const slice = this.#load();
    this.#assertTenant(actor, slice);
    try {
      slice.engine.mint({ actor, entityType: "document", entityId: id, need: "view" });
    } catch {
      return null;
    }
    return slice.get(id) ?? null;
  }

  async shareState(
    entityId: string,
    state: AccessState,
    actor: ActorContext,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      return await this.#serializeWrite(async () => {
        const slice = this.#load();
        this.#assertTenant(actor, slice);
        const receipt = slice.engine.mint({
          actor,
          entityType: "document",
          entityId,
          need: "owner",
        });
        requireReceipt(receipt, "owner", entityId);
        slice.access.put(entityId, state);
        slice.rebuildAccessProjection();
        await this.#save(slice);
        return { ok: true as const };
      });
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "share failed" };
    }
  }

  async mintView(
    actorJson: RequestContext["actor"],
    entityId: string,
    need: "view" | "edit" | "owner",
  ): Promise<{ ok: true; receipt: Receipt } | { ok: false; message: string }> {
    try {
      const slice = this.#load();
      this.#assertTenant(actorJson, slice);
      return {
        ok: true,
        receipt: slice.engine.mint({
          actor: actorJson,
          entityType: "document",
          entityId,
          need,
        }),
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "mint failed" };
    }
  }

  async #mutate(
    ctx: RequestContext,
    need: "edit" | "owner",
    run: (slice: TaskSlice, gated: RequestContext) => TaskRecord,
  ): Promise<TaskRecord> {
    return this.#serializeWrite(async () => {
      const slice = this.#load();
      this.#assertTenant(ctx.actor, slice);
      const entityId = ctx.receipt?.entityId;
      if (!entityId) throw new Error("task mutation requires a receipt");
      const receipt = slice.engine.mint({
        actor: ctx.actor,
        entityType: "document",
        entityId,
        need,
      });
      const gated: RequestContext = { ...ctx, receipt };
      const next = run(slice, gated);
      await this.#save(slice);
      return next;
    });
  }
}
