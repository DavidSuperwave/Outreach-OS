import { DurableObject } from "cloudflare:workers";
import { filterVisible, requireReceipt, type Receipt } from "authz";
import type { AccessState } from "authz";
import type { ActorContext } from "identity/principal";
import { envelope, type RequestContext } from "control-plane";
import { ensureListSchema, projectListSnapshot, queryFacetRows, type SoupD1, type SoupDelta, type SoupItem } from "soup";
import {
  TaskSlice,
  type TaskRecord,
  type TaskRpc,
  type TaskSliceSnapshot,
  type TaskView,
} from "./slice.js";

export interface TaskSliceEnv {
  SOUP: SoupD1;
}

interface SubscribeAttachment {
  cursor: number;
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

  async #save(slice: TaskSlice): Promise<void> {
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
  }

  #broadcast(slice: TaskSlice): void {
    for (const ws of this.ctx.getWebSockets()) {
      const att = (ws.deserializeAttachment() as SubscribeAttachment | null) ?? { cursor: 0 };
      const deltas = slice.plane.lists.replayFrom(att.cursor);
      if (deltas.length === 0) continue;
      ws.send(JSON.stringify({ type: "delta", deltas, seq: slice.plane.lists.seq }));
      ws.serializeAttachment({ cursor: slice.plane.lists.seq } satisfies SubscribeAttachment);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/subscribe") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const cursor = Number(url.searchParams.get("cursor") ?? "0");
      this.ctx.acceptWebSocket(server);
      const slice = this.#load();
      const deltas = slice.plane.lists.replayFrom(Number.isFinite(cursor) ? cursor : 0);
      server.serializeAttachment({ cursor: slice.plane.lists.seq } satisfies SubscribeAttachment);
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
    const view = slice.createTask(title, ctx);
    await this.#save(slice);
    return view;
  }

  async updateTitle(title: string, ctx: RequestContext): Promise<TaskRecord> {
    return this.#mutate(ctx, (slice) => slice.updateTitle(title, ctx));
  }

  async setStatus(status: string, ctx: RequestContext): Promise<TaskRecord> {
    return this.#mutate(ctx, (slice) => slice.setStatus(status, ctx));
  }

  async setPriority(priority: string, ctx: RequestContext): Promise<TaskRecord> {
    return this.#mutate(ctx, (slice) => slice.setPriority(priority, ctx));
  }

  async setAssignee(assigneeId: string, ctx: RequestContext): Promise<TaskRecord> {
    return this.#mutate(ctx, (slice) => slice.setAssignee(assigneeId, ctx));
  }

  async markDone(done: boolean, ctx: RequestContext): Promise<TaskRecord> {
    return this.#mutate(ctx, (slice) => slice.markDone(done, ctx));
  }

  async listTasks(receipts: readonly Receipt[]): Promise<SoupItem[]> {
    const slice = this.#load();
    const tenantId = this.#tenantId(slice);
    if (!tenantId) return [];
    await ensureListSchema(this.env.SOUP);
    const rows = await queryFacetRows(this.env.SOUP, tenantId, "task");
    return filterVisible(rows, receipts);
  }

  async seq(): Promise<number> {
    return this.#load().plane.lists.seq;
  }

  async replayFrom(seq: number): Promise<SoupDelta[]> {
    return this.#load().plane.lists.replayFrom(seq);
  }

  async rebuildProjection(): Promise<void> {
    const slice = this.#load();
    slice.rebuildProjection();
    await this.#save(slice);
  }

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

  async get(id: string): Promise<TaskRecord | null> {
    return this.#load().get(id) ?? null;
  }

  async shareState(
    entityId: string,
    state: AccessState,
    actor: ActorContext,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      const slice = this.#load();
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
      return {
        ok: true,
        receipt: this.#load().engine.mint({
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

  async #mutate(ctx: RequestContext, run: (slice: TaskSlice) => TaskRecord): Promise<TaskRecord> {
    const slice = this.#load();
    const next = run(slice);
    await this.#save(slice);
    return next;
  }
}
