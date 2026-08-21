import type { ActivityFact, RequestContext } from "control-plane";
import { requestContext } from "control-plane";
import type { ActorContext } from "identity/principal";
import type { SoupDelta, SoupItem } from "soup";
import type { TaskSessionApi } from "./domain-api.js";
import type { TaskRecord, TaskSlice } from "./slice.js";

/** In-process TaskSessionApi over TaskSlice. Same methods as the Cap'n Web stub. */
export function inProcessTaskSession(slice: TaskSlice, actor: ActorContext): TaskSessionApi {
  const mutate = async (
    entityId: string,
    need: "edit" | "owner",
    correlationId: string | undefined,
    run: (ctx: RequestContext) => TaskRecord,
  ): Promise<TaskRecord> => {
    const receipt = slice.engine.mint({
      actor,
      entityType: "document",
      entityId,
      need,
    });
    return run(requestContext(actor, { receipt, correlationId }));
  };

  return {
    createTask: async (title, correlationId) =>
      slice.createTask(title, requestContext(actor, { correlationId })),
    listTasks: async () => slice.listTasks(viewReceipts(slice, actor)),
    listActivity: async () => {
      const visible = new Set(viewReceipts(slice, actor).map((receipt) => receipt.entityId));
      return slice.activity.list().filter((fact) => visible.has(fact.entityId));
    },
    updateTitle: (entityId, title, correlationId) =>
      mutate(entityId, "edit", correlationId, (ctx) => slice.updateTitle(title, ctx)),
    setStatus: (entityId, status, correlationId) =>
      mutate(entityId, "edit", correlationId, (ctx) => slice.setStatus(status, ctx)),
    setPriority: (entityId, priority, correlationId) =>
      mutate(entityId, "edit", correlationId, (ctx) => slice.setPriority(priority, ctx)),
    setAssignee: (entityId, assigneeId, correlationId) =>
      mutate(entityId, "edit", correlationId, (ctx) => slice.setAssignee(assigneeId, ctx)),
    markDone: (entityId, done, correlationId) =>
      mutate(entityId, "edit", correlationId, (ctx) => slice.markDone(done, ctx)),
    seq: async () => slice.plane.lists.seq,
    replayFrom: async (seq) => {
      const receipts = viewReceipts(slice, actor);
      return slice.plane.lists.replayFrom(seq).filter((delta: SoupDelta) =>
        receipts.some((receipt) => receipt.entityId === delta.item.entityId),
      );
    },
    rebuildProjection: async () => {
      slice.rebuildProjection();
    },
  };
}

function viewReceipts(slice: TaskSlice, actor: ActorContext) {
  const receipts = [];
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

export async function loadTaskSurface(session: TaskSessionApi): Promise<{
  items: SoupItem[];
  activity: Array<{ id: string; action: string; entityId: string }>;
}> {
  const [items, facts] = await Promise.all([session.listTasks(), session.listActivity()]);
  return {
    items,
    activity: facts.map((fact: ActivityFact) => ({
      id: fact.id,
      action: fact.action,
      entityId: fact.entityId,
    })),
  };
}
