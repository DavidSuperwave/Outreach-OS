import type { AccessState, Receipt } from "authz";
import type { RequestContext } from "control-plane";
import type { ActorContext } from "identity/principal";
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
  listVisible(actor: ActorContext): Promise<SoupItem[]>;
  listActivity(actor: ActorContext): Promise<import("control-plane").ActivityFact[]>;
  seq(): Promise<number>;
  replayFrom(seq: number, actor: ActorContext): Promise<SoupDelta[]>;
  rebuildProjection(actor: ActorContext): Promise<void>;
  get(id: string, actor: ActorContext): Promise<TaskRecord | null>;
  shareState(
    entityId: string,
    state: AccessState,
    actor: ActorContext,
  ): Promise<{ ok: true } | { ok: false; message: string }>;
  mintView(
    actor: RequestContext["actor"],
    entityId: string,
    need: "view" | "edit" | "owner",
  ): Promise<{ ok: true; receipt: Receipt } | { ok: false; message: string }>;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
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

  listVisible(actor: ActorContext): Promise<SoupItem[]> {
    return this.#stub().listVisible(actor);
  }

  listActivity(actor: ActorContext): Promise<import("control-plane").ActivityFact[]> {
    return this.#stub().listActivity(actor);
  }

  seq(): Promise<number> {
    return this.#stub().seq();
  }

  replayFrom(seq: number, actor: ActorContext): Promise<SoupDelta[]> {
    return this.#stub().replayFrom(seq, actor);
  }

  rebuildProjection(actor: ActorContext): Promise<void> {
    return this.#stub().rebuildProjection(actor);
  }

  shareState(
    entityId: string,
    state: AccessState,
    actor: ActorContext,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    return this.#stub().shareState(entityId, state, actor);
  }

  subscribe(cursor = 0, actor: ActorContext): Promise<Response> {
    return this.#stub().fetch(`https://task-slice/subscribe?cursor=${cursor}`, {
      headers: {
        Upgrade: "websocket",
        "x-neuwave-actor": JSON.stringify(actor),
      },
    });
  }
}
