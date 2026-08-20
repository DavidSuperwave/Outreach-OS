import { AuthzError, requireReceipt, type Receipt } from "authz";
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
import { actorContext, TaskSlice, type TaskApi, type TaskRecord, type TaskView } from "task-slice";
import type { SoupItem, SoupListener } from "soup";
import { resolveStorageType } from "./facet.js";
import { optionIdsOf, PropertyValueIndex, selectOptionId } from "./index-store.js";
import {
  KANBAN_NONE,
  optionKeyFromId,
  priorityOptionIdForKey,
  seedSystemDefinitions,
  statusOptionIdForKey,
  SYSTEM_DEFINITION_IDS,
  TAGS_DEFINITION_ID,
} from "./system.js";
import type {
  BulkResult,
  BulkSetOptionsInput,
  BulkSetValuesInput,
  CreateDefinitionInput,
  EntityPropertyRow,
  GridRow,
  KanbanColumn,
  PropertyDefinition,
  PropertyOption,
  PropertyValue,
  TagRecord,
} from "./types.js";

export interface PropertiesApi {
  createTask(title: string, ctx: RequestContext): TaskView;
  listTasks(receipts: readonly Receipt[]): SoupItem[];
  listDefinitions(): PropertyDefinition[];
  createDefinition(input: CreateDefinitionInput, ctx: RequestContext): PropertyDefinition;
  deleteDefinition(definitionId: string, ctx: RequestContext): void;
  getEntityProperties(entityId: string): Record<string, PropertyValue | null>;
  setEntityProperty(definitionId: string, value: PropertyValue, ctx: RequestContext): EntityPropertyRow;
  bulkSetValues(input: BulkSetValuesInput, ctx: RequestContext): BulkResult;
  bulkSetOptions(input: BulkSetOptionsInput, ctx: RequestContext): BulkResult;
  grid(receipts: readonly Receipt[]): GridRow[];
  kanban(receipts: readonly Receipt[], definitionId?: string): KanbanColumn[];
  moveKanbanCard(toOptionId: string, ctx: RequestContext, definitionId?: string): BulkResult;
  createTag(name: string, ctx: RequestContext): TagRecord;
  mergeTags(fromId: string, intoId: string, ctx: RequestContext): TagRecord;
  promoteTag(tagId: string, definitionId: string, ctx: RequestContext): PropertyOption;
  subscribe(listener: SoupListener): () => void;
}

/**
 * Full EAV property system on top of the frozen N6 TaskSlice (OD-7).
 * Values live as entity_properties rows keyed TASK; Soup remains the list projection.
 */
export class TaskProperties {
  readonly slice = new TaskSlice();
  readonly index = new PropertyValueIndex();
  outbox = new Outbox();
  readonly activity = new ActivityLog();
  readonly idempotency = new IdempotencyStore();
  #definitions = new Map<string, PropertyDefinition>();
  #options = new Map<string, PropertyOption>();
  #values = new Map<string, EntityPropertyRow>();
  #tags = new Map<string, TagRecord>();
  #clock = 0;
  #customSeq = 0;

  constructor() {
    const seeded = seedSystemDefinitions();
    for (const def of seeded.definitions) this.#definitions.set(def.id, def);
    for (const option of seeded.options) this.#options.set(option.id, option);
  }

  get tasks(): TaskApi {
    return this.slice.openApi();
  }

  openApi(): PropertiesApi {
    return {
      createTask: (title, ctx) => this.createTask(title, ctx),
      listTasks: (receipts) => this.listTasks(receipts),
      listDefinitions: () => this.listDefinitions(),
      createDefinition: (input, ctx) => this.createDefinition(input, ctx),
      deleteDefinition: (id, ctx) => this.deleteDefinition(id, ctx),
      getEntityProperties: (entityId) => this.getEntityProperties(entityId),
      setEntityProperty: (definitionId, value, ctx) => this.setEntityProperty(definitionId, value, ctx),
      bulkSetValues: (input, ctx) => this.bulkSetValues(input, ctx),
      bulkSetOptions: (input, ctx) => this.bulkSetOptions(input, ctx),
      grid: (receipts) => this.grid(receipts),
      kanban: (receipts, definitionId) => this.kanban(receipts, definitionId ?? SYSTEM_DEFINITION_IDS.status),
      moveKanbanCard: (toOptionId, ctx, definitionId) =>
        this.moveKanbanCard(toOptionId, ctx, definitionId ?? SYSTEM_DEFINITION_IDS.status),
      createTag: (name, ctx) => this.createTag(name, ctx),
      mergeTags: (fromId, intoId, ctx) => this.mergeTags(fromId, intoId, ctx),
      promoteTag: (tagId, definitionId, ctx) => this.promoteTag(tagId, definitionId, ctx),
      subscribe: (listener) => this.slice.openApi().subscribe(listener),
    };
  }

  createTask(title: string, ctx: RequestContext): TaskView {
    const view = this.slice.createTask(title, ctx);
    this.#seedTaskBundle(view.task, ctx);
    return view;
  }

  listTasks(receipts: readonly Receipt[]): SoupItem[] {
    return this.slice.listTasks(receipts);
  }

  listDefinitions(): PropertyDefinition[] {
    return [...this.#definitions.values()];
  }

  optionsFor(definitionId: string): PropertyOption[] {
    return [...this.#options.values()]
      .filter((option) => option.definitionId === definitionId)
      .sort((a, b) => a.rank - b.rank);
  }

  getEntityProperties(entityId: string): Record<string, PropertyValue | null> {
    return this.index.forEntity(entityId);
  }

  createDefinition(input: CreateDefinitionInput, ctx: RequestContext): PropertyDefinition {
    this.#requireTenant(ctx);
    const run = () => {
      this.#customSeq += 1;
      const id = `pdef_custom_${this.#customSeq.toString(16).padStart(4, "0")}`;
      const definition: PropertyDefinition = {
        id,
        tenantId: ctx.actor.actor.tenantId,
        name: input.name,
        dataType: input.dataType,
        isSystem: false,
        applicable: input.applicable ?? [],
        version: 1,
      };
      this.#definitions.set(id, definition);
      (input.options ?? []).forEach((option, rank) => {
        const optionId = `${id}_opt_${option.key}`;
        this.#options.set(optionId, { id: optionId, definitionId: id, key: option.key, label: option.label, rank });
      });
      this.#publishSchema(definition, ctx);
      return definition;
    };
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  deleteDefinition(definitionId: string, ctx: RequestContext): void {
    this.#requireTenant(ctx);
    const definition = this.#requireDefinition(definitionId);
    if (definition.isSystem) throw new Error(`system property ${definitionId} is not deletable`);
    this.#definitions.delete(definitionId);
    for (const [id, option] of this.#options) {
      if (option.definitionId === definitionId) this.#options.delete(id);
    }
  }

  setEntityProperty(definitionId: string, value: PropertyValue, ctx: RequestContext): EntityPropertyRow {
    const receipt = ctx.receipt;
    if (!receipt) throw new Error("property mutation requires a receipt");
    return this.#setOne(receipt, definitionId, value, ctx);
  }

  /**
   * First-class bulk RPC (Ledger: a per-item client loop is not faithful).
   * Fan-out is per-entity serialized writes with a per-item result envelope.
   */
  bulkSetValues(input: BulkSetValuesInput, ctx: RequestContext): BulkResult {
    const run = () => this.#bulk(input.targets, ctx, (receipt) => this.#setOne(receipt, input.definitionId, input.value, ctx));
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  bulkSetOptions(input: BulkSetOptionsInput, ctx: RequestContext): BulkResult {
    const definition = this.#requireDefinition(input.definitionId);
    const value = optionsValue(definition.dataType, input.optionIds);
    const run = () => this.#bulk(input.targets, ctx, (receipt) => this.#setOne(receipt, input.definitionId, value, ctx));
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  grid(receipts: readonly Receipt[]): GridRow[] {
    return this.listTasks(receipts).map((item) => ({
      entityId: item.entityId,
      title: item.title,
      facet: item.facet,
      values: this.index.forEntity(item.entityId),
    }));
  }

  kanban(receipts: readonly Receipt[], definitionId: string = SYSTEM_DEFINITION_IDS.status): KanbanColumn[] {
    const rows = this.grid(receipts);
    const options = this.optionsFor(definitionId);
    const columns: KanbanColumn[] = options.map((option) => ({
      optionId: option.id,
      label: option.label,
      items: rows.filter((row) => selectOptionId(row.values[definitionId]) === option.id),
    }));
    columns.push({
      optionId: KANBAN_NONE,
      label: "None",
      items: rows.filter((row) => selectOptionId(row.values[definitionId]) === KANBAN_NONE),
    });
    return columns;
  }

  moveKanbanCard(
    toOptionId: string,
    ctx: RequestContext,
    definitionId: string = SYSTEM_DEFINITION_IDS.status,
  ): BulkResult {
    const receipt = ctx.receipt;
    if (!receipt) throw new Error("kanban move requires a receipt");
    const optionIds = toOptionId === KANBAN_NONE ? [] : [toOptionId];
    return this.bulkSetOptions({ targets: [{ receipt }], definitionId, optionIds }, ctx);
  }

  createTag(name: string, ctx: RequestContext): TagRecord {
    this.#requireTenant(ctx);
    this.#customSeq += 1;
    const id = `tag_${this.#customSeq.toString(16).padStart(4, "0")}`;
    const tag: TagRecord = { id, tenantId: ctx.actor.actor.tenantId!, name, mergedIntoId: null };
    this.#tags.set(id, tag);
    const optionId = `${TAGS_DEFINITION_ID}_opt_${id}`;
    this.#options.set(optionId, {
      id: optionId,
      definitionId: TAGS_DEFINITION_ID,
      key: id,
      label: name,
      rank: this.optionsFor(TAGS_DEFINITION_ID).length,
    });
    return tag;
  }

  mergeTags(fromId: string, intoId: string, ctx: RequestContext): TagRecord {
    this.#requireTenant(ctx);
    const from = this.#tags.get(fromId);
    const into = this.#tags.get(intoId);
    if (!from || !into) throw new Error("unknown tag");
    const fromOption = `${TAGS_DEFINITION_ID}_opt_${fromId}`;
    const intoOption = `${TAGS_DEFINITION_ID}_opt_${intoId}`;
    for (const row of this.#values.values()) {
      if (row.definitionId !== TAGS_DEFINITION_ID || row.values.kind !== "multi_select") continue;
      if (!row.values.optionIds.includes(fromOption)) continue;
      const optionIds = [...new Set(row.values.optionIds.map((id) => (id === fromOption ? intoOption : id)))];
      this.#writeRow(row.entityId, row.storageType, TAGS_DEFINITION_ID, { kind: "multi_select", optionIds }, ctx);
    }
    from.mergedIntoId = intoId;
    this.#tags.set(fromId, from);
    this.#options.delete(fromOption);
    return into;
  }

  promoteTag(tagId: string, definitionId: string, ctx: RequestContext): PropertyOption {
    this.#requireTenant(ctx);
    const tag = this.#tags.get(tagId);
    if (!tag) throw new Error(`unknown tag ${tagId}`);
    const definition = this.#requireDefinition(definitionId);
    if (definition.dataType !== "select" && definition.dataType !== "multi_select") {
      throw new Error("promoteTag requires a select definition");
    }
    const optionId = `${definitionId}_opt_${tagId}`;
    const option: PropertyOption = {
      id: optionId,
      definitionId,
      key: tagId,
      label: tag.name,
      rank: this.optionsFor(definitionId).length,
    };
    this.#options.set(optionId, option);
    return option;
  }

  rebuildProjection(): void {
    this.slice.rebuildProjection();
    this.index.clear();
    for (const env of this.outbox.replay()) this.index.apply(env);
  }

  drain(publish: (env: EventEnvelope) => void = () => undefined): void {
    this.outbox.drain(publish);
    for (const env of this.outbox.replay()) this.index.apply(env);
  }

  #seedTaskBundle(task: TaskRecord, ctx: RequestContext): void {
    const storage = resolveStorageType("document", "task");
    this.#writeRow(
      task.id,
      storage,
      SYSTEM_DEFINITION_IDS.status,
      { kind: "select", optionId: statusOptionIdForKey(task.status) },
      ctx,
    );
    this.#writeRow(
      task.id,
      storage,
      SYSTEM_DEFINITION_IDS.priority,
      { kind: "select", optionId: priorityOptionIdForKey(task.priority) },
      ctx,
    );
    this.#writeRow(
      task.id,
      storage,
      SYSTEM_DEFINITION_IDS.assignees,
      { kind: "user", userIds: [...task.assigneeIds] },
      ctx,
    );
  }

  #bulk(
    targets: readonly { receipt: Receipt }[],
    _ctx: RequestContext,
    apply: (receipt: Receipt) => EntityPropertyRow,
  ): BulkResult {
    const results = targets.map((target) => {
      try {
        const row = apply(target.receipt);
        return { entityId: target.receipt.entityId, ok: true as const, version: row.version };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { entityId: target.receipt.entityId, ok: false as const, error: message };
      }
    });
    return {
      results,
      succeeded: results.filter((row) => row.ok).length,
      failed: results.filter((row) => !row.ok).length,
    };
  }

  #setOne(receipt: Receipt, definitionId: string, value: PropertyValue, ctx: RequestContext): EntityPropertyRow {
    requireReceipt(receipt, "edit", receipt.entityId);
    const record = this.slice.registry.get(receipt.entityId);
    if (!record) throw new Error(`unknown entity ${receipt.entityId}`);
    const storage = resolveStorageType(record.type, record.facet);
    const definition = this.#requireDefinition(definitionId);
    if (definition.applicable.length > 0 && !definition.applicable.includes(storage)) {
      throw new Error(`property ${definition.name} does not apply to ${storage}`);
    }
    if (value.kind !== definition.dataType && !(definition.dataType === "select" && value.kind === "select")) {
      if (definition.dataType === "multi_select" && value.kind === "multi_select") {
        /* ok */
      } else if (value.kind !== definition.dataType) {
        throw new Error(`value kind ${value.kind} does not match ${definition.dataType}`);
      }
    }
    const row = this.#writeRow(receipt.entityId, storage, definitionId, value, ctx);
    this.#syncSlice(receipt, definitionId, value, ctx);
    return row;
  }

  #syncSlice(receipt: Receipt, definitionId: string, value: PropertyValue, ctx: RequestContext): void {
    const writeCtx = requestContext(ctx.actor, { receipt, correlationId: ctx.correlationId });
    const tasks = this.tasks;
    if (definitionId === SYSTEM_DEFINITION_IDS.status && value.kind === "select") {
      const key = optionKeyFromId(value.optionId) ?? "todo";
      tasks.setStatus(key, writeCtx);
      tasks.markDone(key === "completed", writeCtx);
    }
    if (definitionId === SYSTEM_DEFINITION_IDS.priority && value.kind === "select") {
      const key = optionKeyFromId(value.optionId);
      if (key) tasks.setPriority(key, writeCtx);
    }
    if (definitionId === SYSTEM_DEFINITION_IDS.assignees && value.kind === "user") {
      const current = this.slice.access.get(receipt.entityId);
      if (current) this.slice.access.put(receipt.entityId, { ...current, assigneeIds: [...value.userIds] });
      if (value.userIds[0]) tasks.setAssignee(value.userIds[0], writeCtx);
    }
  }

  #writeRow(
    entityId: string,
    storageType: EntityPropertyRow["storageType"],
    definitionId: string,
    values: PropertyValue,
    ctx: RequestContext,
  ): EntityPropertyRow {
    const key = `${entityId}:${definitionId}`;
    const previous = this.#values.get(key);
    const row: EntityPropertyRow = {
      entityId,
      storageType,
      definitionId,
      values,
      version: (previous?.version ?? 0) + 1,
    };
    this.#values.set(key, row);
    this.index.put(row);
    this.#publishValue(row, ctx);
    return row;
  }

  #publishValue(row: EntityPropertyRow, ctx: RequestContext): void {
    const occurredAt = this.#now();
    const record = this.slice.registry.get(row.entityId);
    this.outbox.append(
      envelope({
        eventId: `prop:${row.entityId}:${row.definitionId}:${row.version}`,
        topic: "properties",
        entityType: record?.type ?? "document",
        entityId: row.entityId,
        tenantId: record?.tenantId ?? ctx.actor.actor.tenantId ?? "",
        actorId: ctx.actor.actor.id,
        onBehalfOfId: ctx.actor.onBehalfOf?.id ?? null,
        occurredAt,
        version: row.version,
        payload: {
          storageType: row.storageType,
          definitionId: row.definitionId,
          values: row.values,
          facet: record?.facet ?? null,
          optionIds: optionIdsOf(row.values),
        },
        receipt: {
          level: ctx.receipt?.level ?? "owner",
          entityType: record?.type ?? "document",
          entityId: row.entityId,
          actorId: ctx.actor.actor.id,
        },
        correlationId: ctx.correlationId,
      }),
    );
    this.activity.append({
      id: `property_changed:${row.entityId}:${row.definitionId}:${row.version}`,
      action: "property_changed",
      entityType: record?.type ?? "document",
      entityId: row.entityId,
      actorId: ctx.actor.actor.id,
      tenantId: record?.tenantId ?? ctx.actor.actor.tenantId ?? "",
      occurredAt,
    });
    this.drain();
  }

  #publishSchema(definition: PropertyDefinition, ctx: RequestContext): void {
    const occurredAt = this.#now();
    this.outbox.append(
      envelope({
        eventId: `pdef:${definition.id}:${definition.version}`,
        topic: "properties",
        entityType: "team",
        entityId: ctx.actor.actor.tenantId ?? definition.id,
        tenantId: ctx.actor.actor.tenantId ?? "",
        actorId: ctx.actor.actor.id,
        onBehalfOfId: ctx.actor.onBehalfOf?.id ?? null,
        occurredAt,
        version: definition.version,
        payload: { definitionId: definition.id, name: definition.name, dataType: definition.dataType, schema: true },
        receipt: null,
        correlationId: ctx.correlationId,
      }),
    );
    this.drain();
  }

  #requireDefinition(id: string): PropertyDefinition {
    const definition = this.#definitions.get(id);
    if (!definition) throw new Error(`unknown property ${id}`);
    return definition;
  }

  #requireTenant(ctx: RequestContext): void {
    if (!ctx.actor.actor.tenantId) throw new AuthzError("denied", "property schema requires a tenant-scoped actor");
  }

  #now(): number {
    this.#clock += 1;
    return this.#clock;
  }
}

function optionsValue(dataType: PropertyDefinition["dataType"], optionIds: readonly string[]): PropertyValue {
  if (dataType === "multi_select") return { kind: "multi_select", optionIds: [...optionIds] };
  return { kind: "select", optionId: optionIds[0] ?? null };
}

export { actorContext, requestContext };
export type { ActorContext };
