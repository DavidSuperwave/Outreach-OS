import type { RequestContext } from "control-plane";
import { requestContext } from "control-plane";
import type { ActorContext } from "identity/principal";
import type { SoupDelta } from "soup";
import type { TaskSessionApi } from "./domain-api.js";
import { operatorAlertsFromPoison } from "./operator-alerts.js";
import type { TaskRecord, TaskSlice } from "./slice.js";
import { loadTaskSurface, submitTaskCompose } from "./live-session.js";

/** In-process TaskSessionApi over TaskSlice. Same methods as the Cap'n Web stub. */
export function inProcessTaskSession(slice: TaskSlice, actor: ActorContext): TaskSessionApi {
  const mutate = async (
    entityId: string,
    need: "edit" | "owner",
    operation: "title" | "status" | "priority" | "assignee" | "done",
    operationId: string,
    run: (ctx: RequestContext) => TaskRecord,
  ): Promise<TaskRecord> => {
    if (!operationId) throw new Error("operationId required");
    const receipt = slice.engine.mint({
      actor,
      entityType: "document",
      entityId,
      need,
    });
    return run(requestContext(actor, {
      receipt,
      correlationId: operationId,
      idempotencyKey: `${actor.actor.id}:${operation}:${entityId}:${operationId}`,
    }));
  };

  return {
    createTask: async (title, operationId) => {
      if (!operationId) throw new Error("operationId required");
      return slice.createTask(title, requestContext(actor, {
        correlationId: operationId,
        idempotencyKey: `${actor.actor.id}:create:${operationId}`,
      }));
    },
    listTasks: async () => slice.listTasks(viewReceipts(slice, actor)),
    listActivity: async () => {
      const visible = new Set(viewReceipts(slice, actor).map((receipt) => receipt.entityId));
      return slice.activity.list().filter((fact) => visible.has(fact.entityId));
    },
    listAlerts: async () => {
      const visible = new Set(viewReceipts(slice, actor).map((receipt) => receipt.entityId));
      return operatorAlertsFromPoison(slice.outbox.poison(), visible);
    },
    updateTitle: (entityId, title, operationId) =>
      mutate(entityId, "edit", "title", operationId, (ctx) => slice.updateTitle(title, ctx)),
    setStatus: (entityId, status, operationId) =>
      mutate(entityId, "edit", "status", operationId, (ctx) => slice.setStatus(status, ctx)),
    setPriority: (entityId, priority, operationId) =>
      mutate(entityId, "edit", "priority", operationId, (ctx) => slice.setPriority(priority, ctx)),
    setAssignee: (entityId, assigneeId, operationId) =>
      mutate(entityId, "edit", "assignee", operationId, (ctx) => slice.setAssignee(assigneeId, ctx)),
    markDone: (entityId, done, operationId) =>
      mutate(entityId, "edit", "done", operationId, (ctx) => slice.markDone(done, ctx)),
    createSubscribeTicket: async () => ({
      ticket: crypto.randomUUID(),
      expiresAt: Date.now() + 30_000,
    }),
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
    tenantId: async () => {
      const tenantId = actor.actor.tenantId;
      if (!tenantId) throw new Error("session is not tenant-scoped");
      return tenantId;
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

export { loadTaskSurface, submitTaskCompose };
