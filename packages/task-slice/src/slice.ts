import { AccessStore, PolicyEngine, emptyAccess, requireReceipt, type Receipt } from "authz";
import {
  ActivityLog,
  IdempotencyStore,
  Outbox,
  envelope,
  requestContext,
  runOnce,
  type EventEnvelope,
  type RequestContext,
} from "control-plane";
import type { ActorContext } from "identity/principal";
import { EntityRegistry, nextId } from "registry";
import { ProjectionPlane, type SoupItem, type SoupListener } from "soup";

export interface TaskRecord {
  id: string;
  tenantId: string;
  title: string;
  status: string | null;
  priority: string | null;
  assigneeIds: string[];
  tags: string[];
  done: boolean;
  version: number;
  facet: "task";
}

export interface TaskView {
  task: TaskRecord;
  receipt: Receipt;
}

export interface TaskApi {
  createTask(title: string, ctx: RequestContext): TaskView;
  updateTitle(title: string, ctx: RequestContext): TaskRecord;
  setStatus(status: string, ctx: RequestContext): TaskRecord;
  setPriority(priority: string, ctx: RequestContext): TaskRecord;
  setAssignee(assigneeId: string, ctx: RequestContext): TaskRecord;
  markDone(done: boolean, ctx: RequestContext): TaskRecord;
  listTasks(receipts: readonly Receipt[]): SoupItem[];
  subscribe(listener: SoupListener): () => void;
}

/**
 * Authoritative task store is document + facet `task` (OD-7).
 * Outbox drain is the async side effect; Soup is the projection; ActivityLog is audit.
 */
export class TaskSlice {
  readonly registry = new EntityRegistry();
  readonly access = new AccessStore();
  readonly engine = new PolicyEngine(this.registry, this.access);
  outbox = new Outbox();
  plane = new ProjectionPlane();
  readonly activity = new ActivityLog();
  readonly idempotency = new IdempotencyStore();
  #docs = new Map<string, TaskRecord>();
  #clock = 0;

  openApi(): TaskApi {
    return {
      createTask: (title, ctx) => this.createTask(title, ctx),
      updateTitle: (title, ctx) => this.mutate(ctx, "edit", (task) => ({ ...task, title })),
      setStatus: (status, ctx) => this.mutate(ctx, "edit", (task) => ({ ...task, status }), "property_changed"),
      setPriority: (priority, ctx) => this.mutate(ctx, "edit", (task) => ({ ...task, priority }), "property_changed"),
      setAssignee: (assigneeId, ctx) =>
        this.mutate(ctx, "edit", (task) => ({ ...task, assigneeIds: [assigneeId] }), "property_changed"),
      markDone: (done, ctx) => this.mutate(ctx, "edit", (task) => ({ ...task, done })),
      listTasks: (receipts) => this.listTasks(receipts),
      subscribe: (listener) => this.plane.lists.subscribe(listener),
    };
  }

  createTask(title: string, ctx: RequestContext): TaskView {
    const tenantId = ctx.actor.actor.tenantId;
    if (!tenantId) throw new Error("createTask requires a tenant-scoped actor");
    const run = () => {
      const id = nextId("document");
      this.registry.register({ type: "document", id, tenantId, createdAt: this.#now(), facet: "task" });
      this.access.put(id, emptyAccess(ctx.actor.actor.id, tenantId));
      const task: TaskRecord = {
        id,
        tenantId,
        title,
        status: "todo",
        priority: null,
        assigneeIds: [],
        tags: [],
        done: false,
        version: 1,
        facet: "task",
      };
      this.#docs.set(id, task);
      this.#publish(task, ctx, "created");
      const receipt = this.engine.mint({
        actor: ctx.actor,
        entityType: "document",
        entityId: id,
        need: "owner",
      });
      return { task, receipt };
    };
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  listTasks(receipts: readonly Receipt[]): SoupItem[] {
    return this.plane.lists.query({ types: ["document"], facet: "task" }, receipts).items;
  }

  get(id: string): TaskRecord | undefined {
    return this.#docs.get(id);
  }

  /** Drop projection and rebuild from outbox (gate 5). */
  rebuildProjection(): void {
    this.plane = new ProjectionPlane();
    this.plane.rebuild(this.outbox);
  }

  drain(publish: (env: EventEnvelope) => void = () => undefined): void {
    this.outbox.drain(publish);
    this.plane.ingest(this.outbox);
  }

  mutate(
    ctx: RequestContext,
    need: "view" | "edit" | "owner",
    patch: (task: TaskRecord) => TaskRecord,
    action: "edited" | "property_changed" = "edited",
  ): TaskRecord {
    const receipt = ctx.receipt;
    if (!receipt) throw new Error("task mutation requires a receipt");
    requireReceipt(receipt, need, receipt.entityId);
    const current = this.#docs.get(receipt.entityId);
    if (!current) throw new Error(`unknown task ${receipt.entityId}`);
    const next = { ...patch(current), version: current.version + 1 };
    this.#docs.set(next.id, next);
    this.#publish(next, ctx, action);
    return next;
  }

  #publish(task: TaskRecord, ctx: RequestContext, action: "created" | "edited" | "property_changed"): void {
    const occurredAt = this.#now();
    this.outbox.append(
      envelope({
        topic: "documents",
        entityType: "document",
        entityId: task.id,
        tenantId: task.tenantId,
        actorId: ctx.actor.actor.id,
        onBehalfOfId: ctx.actor.onBehalfOf?.id ?? null,
        occurredAt,
        version: task.version,
        payload: {
          title: task.title,
          facet: "task",
          status: task.status,
          priority: task.priority,
          done: task.done,
          body: task.title,
        },
        receipt: {
          level: ctx.receipt?.level ?? "owner",
          entityType: "document",
          entityId: task.id,
          actorId: ctx.actor.actor.id,
        },
        correlationId: ctx.correlationId,
      }),
    );
    this.activity.append({
      id: `${action}:${task.id}:${task.version}`,
      action,
      entityType: "document",
      entityId: task.id,
      actorId: ctx.actor.actor.id,
      tenantId: task.tenantId,
      occurredAt,
    });
    this.drain();
  }

  #now(): number {
    this.#clock += 1;
    return this.#clock;
  }
}

export function actorContext(actor: ActorContext["actor"], kernelUsername = "admin"): ActorContext {
  return { actor, kernelUsername, isDeploymentAdmin: false };
}

export { requestContext };
