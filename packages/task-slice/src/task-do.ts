import { DurableObject } from "cloudflare:workers";
import { filterVisible, requireReceipt, type Receipt } from "authz";
import type { AccessState } from "authz";
import type { ActorContext } from "identity/principal";
import { envelope, type RequestContext } from "control-plane";
import { ensureListSchema, projectListSnapshot, queryFacetRows, type SoupD1, type SoupDelta, type SoupItem } from "soup";
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
  /** Optional Queues producer — durable outbox re-drive after a write (ADR-005). */
  TASK_OUTBOX?: { send(message: { tenantId: string }): Promise<unknown> };
}

interface SubscribeAttachment {
  cursor: number;
  actor: ActorContext;
}

/**
 * Authoritative task store (OD-7 document + facet task) on SQLite DO storage.
 * Soup lists family is projected to D1 (OD-27), not this DO.
 * Live subscribers attach via hibernation WebSockets on `/subscribe`.
 */
export class TaskSliceDurableObject extends DurableObject<TaskSliceEnv> implements TaskRpc {
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

  #viewReceipts(slice: TaskSlice, actor: ActorContext): Receipt[] {
    const receipts: Receipt[] = [];
    for (const doc of slice.toSnapshot().docs) {
      try {
        receipts.push(
          slice.engine.mint({
            actor,
            entityType: "document",
            entityId: doc.id,
            need: "view",
          }),
        );
      } catch {
        // Actor cannot view this document (SEC-1).
      }
    }
    return receipts;
  }

  #visibleDeltas(slice: TaskSlice, actor: ActorContext, fromSeq: number): SoupDelta[] {
    const receipts = this.#viewReceipts(slice, actor);
    return slice.plane.lists.replayFrom(fromSeq).filter((delta) => filterVisible([delta.item], receipts).length > 0);
  }

  #parseActor(request: Request): ActorContext | null {
    const raw = request.headers.get("x-neuwave-actor");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ActorContext;
    } catch {
      return null;
    }
  }

  async #save(slice: TaskSlice, opts: { enqueue?: boolean } = {}): Promise<void> {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO snapshot (id, json) VALUES (1, ?)",
      JSON.stringify(slice.toSnapshot()),
    );
    const tenantId = this.#tenantId(slice) ?? slice.toSnapshot().docs[0]?.tenantId;
    if (tenantId) {
      this.ctx.storage.sql.exec("INSERT OR REPLACE INTO meta (k, v) VALUES ('tenant_id', ?)", tenantId);
    }
    await projectListSnapshot(this.env.SOUP, slice.plane.lists.snapshot(), tenantId);
    this.#broadcast(slice);
    if (opts.enqueue !== false && tenantId && this.env.TASK_OUTBOX) {
      await this.env.TASK_OUTBOX.send({ tenantId });
    }
  }

  /** Queue consumer entry — re-drains the outbox and rebuilds the D1 projection. */
  async drainOutbox(): Promise<{ pending: number }> {
    const slice = this.#load();
    slice.drain();
    await this.#save(slice, { enqueue: false });
    return { pending: slice.outbox.pending().length };
  }

  #broadcast(slice: TaskSlice): void {
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SubscribeAttachment | null;
      if (!att?.actor) continue;
      const deltas = this.#visibleDeltas(slice, att.actor, att.cursor);
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
      const actor = this.#parseActor(request);
      if (!actor) return new Response("actor required", { status: 401 });
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
      const deltas = this.#visibleDeltas(slice, actor, from);
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
    const slice = this.#load();
    this.#assertTenant(ctx.actor, slice);
    const view = slice.createTask(title, ctx);
    await this.#save(slice);
    return view;
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
    return filterVisible(rows, receipts).map((item) => {
      const task = slice.get(item.entityId);
      if (!task) return item;
      return {
        ...item,
        status: task.status,
        priority: task.priority,
        done: task.done,
        title: task.title,
        assigneeIds: task.assigneeIds,
        tags: task.tags,
      };
    });
  }

  async listVisible(actor: ActorContext): Promise<SoupItem[]> {
    const slice = this.#load();
    this.#assertTenant(actor, slice);
    return this.listTasks(this.#viewReceipts(slice, actor));
  }

  async listActivity(actor: ActorContext): Promise<import("control-plane").ActivityFact[]> {
    const slice = this.#load();
    this.#assertTenant(actor, slice);
    const visible = new Set(this.#viewReceipts(slice, actor).map((receipt) => receipt.entityId));
    return slice.activity.list().filter((fact) => visible.has(fact.entityId));
  }

  async listAlerts(actor: ActorContext): Promise<OperatorAlert[]> {
    const slice = this.#load();
    this.#assertTenant(actor, slice);
    const visible = new Set(this.#viewReceipts(slice, actor).map((receipt) => receipt.entityId));
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
    const slice = this.#load();
    this.#assertTenant(actor, slice);
    slice.rebuildProjection();
    await this.#save(slice);
  }

  /** Test/debug helper — not part of TaskRpc. */
  async poisonPending(attempts = 5): Promise<number> {
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
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO snapshot (id, json) VALUES (1, ?)",
      JSON.stringify(slice.toSnapshot()),
    );
    return slice.outbox.poison().length;
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
      await this.#save(slice);
      return { ok: true };
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
  }
}
