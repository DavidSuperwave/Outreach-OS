import { DurableObject } from "cloudflare:workers";
import { filterVisible } from "authz";
import { ensureListSchema, projectListSnapshot, queryFacetRows, type SoupD1 } from "soup";
import {
  TaskSlice,
  type TaskRecord,
  type TaskRpc,
  type TaskSliceSnapshot,
  type TaskView,
} from "./slice.js";
import type { Receipt } from "authz";
import type { RequestContext } from "control-plane";
import type { SoupDelta, SoupItem } from "soup";

export interface TaskSliceEnv {
  SOUP: SoupD1;
}

/**
 * Authoritative task store (OD-7 document + facet task) on SQLite DO storage.
 * Soup lists family is projected to D1 (OD-27), not this DO.
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
  }

  #load(): TaskSlice {
    const rows = this.ctx.storage.sql
      .exec<{ json: string }>("SELECT json FROM snapshot WHERE id = 1")
      .toArray();
    if (!rows[0]) return new TaskSlice();
    return TaskSlice.fromSnapshot(JSON.parse(rows[0].json) as TaskSliceSnapshot);
  }

  async #save(slice: TaskSlice): Promise<void> {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO snapshot (id, json) VALUES (1, ?)",
      JSON.stringify(slice.toSnapshot()),
    );
    await projectListSnapshot(this.env.SOUP, slice.plane.lists.snapshot());
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
    const tenantId = slice.toSnapshot().docs[0]?.tenantId;
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

  async get(id: string): Promise<TaskRecord | null> {
    return this.#load().get(id) ?? null;
  }

  async shareState(
    entityId: string,
    state: ReturnType<TaskSlice["access"]["require"]>,
  ): Promise<void> {
    const slice = this.#load();
    slice.access.put(entityId, state);
    await this.#save(slice);
  }

  async mintView(
    actorJson: RequestContext["actor"],
    entityId: string,
    need: "view" | "edit" | "owner",
  ): Promise<{ ok: true; receipt: import("authz").Receipt } | { ok: false; message: string }> {
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
