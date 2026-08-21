import type { ActivityFact } from "control-plane";
import type { SoupDelta, SoupItem } from "soup";
import type { OperatorAlert } from "./operator-alerts.js";
import type { TaskRecord, TaskView } from "./slice.js";

export type { OperatorAlert } from "./operator-alerts.js";

export interface SubscribeTicket {
  ticket: string;
  expiresAt: number;
}

/**
 * Wrapper-owned Cap'n Web entry (ADR-002). Same authenticate-then-mint pattern as
 * kernel PublicApi, but not added to api.ts. Holding the returned stub is the authority.
 */
export interface TaskDomainPublicApi {
  authenticate(token: string): Promise<TaskAuthenticatedApi>;
}

/** Kernel session capability. Tenant membership is checked when opening a tenant. */
export interface TaskAuthenticatedApi {
  openTenant(tenantId: string): Promise<TaskSessionApi>;
  /** Bootstrap or reuse the kernel user's home team, then mint a tenant session. */
  openDefaultTenant(): Promise<TaskSessionApi>;
}

/**
 * Tenant-scoped Task capability. Actor is closed over at mint time — clients never pass
 * ActorContext, receipts, or x-neuwave-actor.
 */
export interface TaskSessionApi {
  createTask(title: string, operationId: string): Promise<TaskView>;
  listTasks(): Promise<SoupItem[]>;
  listActivity(): Promise<ActivityFact[]>;
  listAlerts(): Promise<OperatorAlert[]>;
  updateTitle(entityId: string, title: string, operationId: string): Promise<TaskRecord>;
  setStatus(entityId: string, status: string, operationId: string): Promise<TaskRecord>;
  setPriority(entityId: string, priority: string, operationId: string): Promise<TaskRecord>;
  setAssignee(entityId: string, assigneeId: string, operationId: string): Promise<TaskRecord>;
  markDone(entityId: string, done: boolean, operationId: string): Promise<TaskRecord>;
  /** Short-lived, single-use bearer for the browser-only WebSocket upgrade. */
  createSubscribeTicket(): Promise<SubscribeTicket>;
  seq(): Promise<number>;
  replayFrom(seq: number): Promise<SoupDelta[]>;
  rebuildProjection(): Promise<void>;
  tenantId(): Promise<string>;
}
