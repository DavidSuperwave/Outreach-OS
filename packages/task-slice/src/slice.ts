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
import { ProjectionPlane, type SoupDelta, type SoupItem, type SoupListener } from "soup";

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

/** Wire-shaped async capability (ADR-002). Implemented by TaskSliceDurableObject. */
export interface TaskRpc {
  createTask(title: string, ctx: RequestContext): Promise<TaskView>;
  updateTitle(title: string, ctx: RequestContext): Promise<TaskRecord>;
  setStatus(status: string, ctx: RequestContext): Promise<TaskRecord>;
  setPriority(priority: string, ctx: RequestContext): Promise<TaskRecord>;
  setAssignee(assigneeId: string, ctx: RequestContext): Promise<TaskRecord>;
  markDone(done: boolean, ctx: RequestContext): Promise<TaskRecord>;
  listTasks(receipts: readonly Receipt[]): Promise<SoupItem[]>;
  listVisible(actor: ActorContext): Promise<SoupItem[]>;
  listActivity(actor: ActorContext): Promise<import("control-plane").ActivityFact[]>;
  listAlerts(actor: ActorContext): Promise<import("./operator-alerts.js").OperatorAlert[]>;
  seq(): Promise<number>;
  replayFrom(seq: number, actor: ActorContext): Promise<SoupDelta[]>;
  rebuildProjection(actor: ActorContext): Promise<void>;
}

export interface TaskSliceSnapshot {
  docs: TaskRecord[];
  registry: ReturnType<EntityRegistry["snapshot"]>;
  access: ReturnType<AccessStore["snapshot"]>;
  outbox: ReturnType<Outbox["snapshot"]>;
  activity: ReturnType<ActivityLog["list"]>;
  idempotency: ReturnType<IdempotencyStore["snapshot"]>;
  plane: ReturnType<ProjectionPlane["lists"]["persistence"]>;
  clock: number;
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
  #accessRows: Array<{
    actorId: string;
    entityId: string;
    entityType: "document";
    tenantId: string;
    level: string;
  }> = [];
  #clock = 0;

  openApi(): TaskApi {
    return {
      createTask: (title, ctx) => this.createTask(title, ctx),
      updateTitle: (title, ctx) => this.updateTitle(title, ctx),
      setStatus: (status, ctx) => this.setStatus(status, ctx),
      setPriority: (priority, ctx) => this.setPriority(priority, ctx),
      setAssignee: (assigneeId, ctx) => this.setAssignee(assigneeId, ctx),
      markDone: (done, ctx) => this.markDone(done, ctx),
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
      this.rebuildAccessProjection();
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

  updateTitle(title: string, ctx: RequestContext): TaskRecord {
    return this.mutate(ctx, "edit", (task) => ({ ...task, title }));
  }

  setStatus(status: string, ctx: RequestContext): TaskRecord {
    return this.mutate(ctx, "edit", (task) => ({ ...task, status }), "property_changed");
  }

  setPriority(priority: string, ctx: RequestContext): TaskRecord {
    return this.mutate(ctx, "edit", (task) => ({ ...task, priority }), "property_changed");
  }

  setAssignee(assigneeId: string, ctx: RequestContext): TaskRecord {
    return this.mutate(ctx, "edit", (task) => ({ ...task, assigneeIds: [assigneeId] }), "property_changed");
  }

  markDone(done: boolean, ctx: RequestContext): TaskRecord {
    return this.mutate(ctx, "edit", (task) => ({ ...task, done }));
  }

  listTasks(receipts: readonly Receipt[]): SoupItem[] {
    return this.plane.lists.query({ types: ["document"], facet: "task" }, receipts).items;
  }

  listVisible(actor: ActorContext): SoupItem[] {
    const tenantId = actor.actor.tenantId;
    if (!tenantId) return [];
    const visible = new Set(
      this.#accessRows
        .filter((row) => row.tenantId === tenantId && row.actorId === actor.actor.id)
        .map((row) => row.entityId),
    );
    return this.plane.lists
      .snapshot()
      .filter((item) => item.facet === "task" && item.tenantId === tenantId && visible.has(item.entityId));
  }

  accessProjection(tenantId: string) {
    return this.#accessRows.filter((row) => row.tenantId === tenantId).map((row) => ({ ...row }));
  }

  /** Project policy outcomes after authoritative ACL writes or snapshot restore. */
  rebuildAccessProjection(): void {
    this.#accessRows = this.access.snapshot().flatMap(({ entityId, state }) => [
      {
        actorId: state.ownerId,
        entityId,
        entityType: "document" as const,
        tenantId: state.tenantId,
        level: "owner",
      },
      ...state.shares.map((share) => ({
        actorId: share.actorId,
        entityId,
        entityType: "document" as const,
        tenantId: state.tenantId,
        level: share.level,
      })),
    ]);
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
    const run = () => {
      const current = this.#docs.get(receipt.entityId);
      if (!current) throw new Error(`unknown task ${receipt.entityId}`);
      const next = { ...patch(current), version: current.version + 1 };
      this.#docs.set(next.id, next);
      this.#publish(next, ctx, action);
      return next;
    };
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
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
          assigneeIds: task.assigneeIds,
          tags: task.tags,
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

  toSnapshot(): TaskSliceSnapshot {
    return {
      docs: [...this.#docs.values()].map((doc) => ({ ...doc })),
      registry: this.registry.snapshot(),
      access: this.access.snapshot(),
      outbox: this.outbox.snapshot(),
      activity: this.activity.list().map((fact) => ({ ...fact })),
      idempotency: this.idempotency.snapshot(),
      plane: this.plane.lists.persistence(),
      clock: this.#clock,
    };
  }

  static fromSnapshot(snapshot: TaskSliceSnapshot): TaskSlice {
    const slice = new TaskSlice();
    slice.registry.restore(snapshot.registry);
    slice.access.restore(snapshot.access);
    slice.rebuildAccessProjection();
    slice.outbox.restore(snapshot.outbox);
    slice.activity.restore(snapshot.activity);
    slice.idempotency.restore(snapshot.idempotency);
    slice.plane.lists.restore(snapshot.plane);
    slice.#docs = new Map(snapshot.docs.map((doc) => [doc.id, { ...doc }]));
    slice.#clock = snapshot.clock;
    return slice;
  }
}

export function actorContext(actor: ActorContext["actor"], kernelUsername = "admin"): ActorContext {
  return { actor, kernelUsername, isDeploymentAdmin: false };
}

export { requestContext };
