import type { Receipt } from "authz";
import type { RequestContext } from "control-plane";
import type { SoupDelta, SoupItem } from "soup";
import type { TaskRecord, TaskRpc, TaskView } from "./slice.js";
import type { TaskSliceDurableObject } from "./task-do.js";

export interface TaskSliceNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub<TaskSliceDurableObject>;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectStub<T> {
  createTask(title: string, ctx: RequestContext): Promise<TaskView>;
  updateTitle(title: string, ctx: RequestContext): Promise<TaskRecord>;
  setStatus(status: string, ctx: RequestContext): Promise<TaskRecord>;
  setPriority(priority: string, ctx: RequestContext): Promise<TaskRecord>;
  setAssignee(assigneeId: string, ctx: RequestContext): Promise<TaskRecord>;
  markDone(done: boolean, ctx: RequestContext): Promise<TaskRecord>;
  listTasks(receipts: readonly Receipt[]): Promise<SoupItem[]>;
  seq(): Promise<number>;
  replayFrom(seq: number): Promise<SoupDelta[]>;
  rebuildProjection(): Promise<void>;
  get(id: string): Promise<TaskRecord | null>;
  shareState(entityId: string, state: unknown): Promise<void>;
  mintView(
    actor: RequestContext["actor"],
    entityId: string,
    need: "view" | "edit" | "owner",
  ): Promise<{ ok: true; receipt: Receipt } | { ok: false; message: string }>;
}

/**
 * Tenant-scoped TaskRpc over TaskSliceDurableObject.
 * One DO per tenant; Soup lists are D1 (OD-27).
 */
export class DurableTaskApi implements TaskRpc {
  constructor(
    private readonly tasks: TaskSliceNamespace,
    readonly tenantId: string,
  ) {}

  #stub(): DurableObjectStub<TaskSliceDurableObject> {
    return this.tasks.get(this.tasks.idFromName(this.tenantId));
  }

  createTask(title: string, ctx: RequestContext): Promise<TaskView> {
    return this.#stub().createTask(title, ctx);
  }

  updateTitle(title: string, ctx: RequestContext): Promise<TaskRecord> {
    return this.#stub().updateTitle(title, ctx);
  }

  setStatus(status: string, ctx: RequestContext): Promise<TaskRecord> {
    return this.#stub().setStatus(status, ctx);
  }

  setPriority(priority: string, ctx: RequestContext): Promise<TaskRecord> {
    return this.#stub().setPriority(priority, ctx);
  }

  setAssignee(assigneeId: string, ctx: RequestContext): Promise<TaskRecord> {
    return this.#stub().setAssignee(assigneeId, ctx);
  }

  markDone(done: boolean, ctx: RequestContext): Promise<TaskRecord> {
    return this.#stub().markDone(done, ctx);
  }

  listTasks(receipts: readonly Receipt[]): Promise<SoupItem[]> {
    return this.#stub().listTasks(receipts);
  }

  seq(): Promise<number> {
    return this.#stub().seq();
  }

  replayFrom(seq: number): Promise<SoupDelta[]> {
    return this.#stub().replayFrom(seq);
  }

  rebuildProjection(): Promise<void> {
    return this.#stub().rebuildProjection();
  }
}
