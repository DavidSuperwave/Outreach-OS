import { AccessStore, AuthzError, PolicyEngine, emptyAccess, requireReceipt, type Receipt } from "authz";
import {
  ActivityLog,
  IdempotencyStore,
  Outbox,
  envelope,
  requestContext,
  runOnce,
  type ActivityAction,
  type EventEnvelope,
  type RequestContext,
  type Topic,
} from "control-plane";
import type { ActorContext } from "identity/principal";
import { EntityRegistry, nextId } from "registry";
import { ProjectionPlane, type SoupItem, type SoupListener } from "soup";
import { CalendarProviderStore } from "./connectors.js";
import { CalendarError } from "./errors.js";
import { LiveKitStub, mintRoomHandle, preview, type LiveKitRoomHandle } from "./livekit.js";
import { TranscriptSidecar, type TranscriptRecord } from "./transcripts.js";
import type {
  CalendarEventRecord,
  CallRecord,
  CallStatus,
  CreateCallInput,
  CreateEventInput,
  CreateReminderInput,
  ProviderEventInput,
  ReminderRecord,
} from "./types.js";

export interface EventView {
  event: CalendarEventRecord;
  receipt: Receipt;
}

export interface CallView {
  call: CallRecord;
  receipt: Receipt;
  transcript: TranscriptRecord | null;
}

export interface ReminderView {
  reminder: ReminderRecord;
  receipt: Receipt;
}

export interface CalendarApi {
  createEvent(input: CreateEventInput, ctx: RequestContext): EventView;
  editEvent(patch: { title?: string; startsAt?: number; endsAt?: number }, ctx: RequestContext): CalendarEventRecord;
  openEvent(entityId: string, ctx: RequestContext): EventView;
  listEvents(receipts: readonly Receipt[]): SoupItem[];
  createCall(input: CreateCallInput, ctx: RequestContext): CallView;
  joinCall(ctx: RequestContext): CallView;
  mintLiveKitRoom(ctx: RequestContext): LiveKitRoomHandle;
  attachTranscript(body: string, ctx: RequestContext): TranscriptRecord;
  finalizeCall(ctx: RequestContext): CallRecord;
  openCall(entityId: string, ctx: RequestContext): CallView;
  listCalls(receipts: readonly Receipt[]): SoupItem[];
  preview(): never;
  createReminder(input: CreateReminderInput, ctx: RequestContext): ReminderView;
  fireReminder(ctx: RequestContext): ReminderRecord;
  connectProvider(displayName: string, ctx: RequestContext, credentialHandle?: string): ReturnType<CalendarProviderStore["connect"]>;
  syncProviderEvents(connectionId: string, events: readonly ProviderEventInput[], ctx: RequestContext): EventView[];
  subscribeLists(listener: SoupListener): () => void;
}

/**
 * Authoritative calendar/call store. Account-DO lane for event mirrors;
 * one in-process call map stands in for per-call DOs. Transcript sidecar
 * is internal. LiveKit is a handle stub.
 */
export class CalendarSlice {
  readonly registry = new EntityRegistry();
  readonly access = new AccessStore();
  readonly engine = new PolicyEngine(this.registry, this.access);
  outbox = new Outbox();
  plane = new ProjectionPlane();
  readonly activity = new ActivityLog();
  readonly idempotency = new IdempotencyStore();
  readonly providers = new CalendarProviderStore();
  readonly transcripts = new TranscriptSidecar();
  readonly livekit = new LiveKitStub();
  #events = new Map<string, CalendarEventRecord>();
  #calls = new Map<string, CallRecord>();
  #reminders = new Map<string, ReminderRecord>();
  #clock = 0;

  openApi(): CalendarApi {
    return {
      createEvent: (input, ctx) => this.createEvent(input, ctx),
      editEvent: (patch, ctx) => this.editEvent(patch, ctx),
      openEvent: (entityId, ctx) => this.openEvent(entityId, ctx),
      listEvents: (receipts) => this.listEvents(receipts),
      createCall: (input, ctx) => this.createCall(input, ctx),
      joinCall: (ctx) => this.joinCall(ctx),
      mintLiveKitRoom: (ctx) => this.mintLiveKitRoom(ctx),
      attachTranscript: (body, ctx) => this.attachTranscript(body, ctx),
      finalizeCall: (ctx) => this.finalizeCall(ctx),
      openCall: (entityId, ctx) => this.openCall(entityId, ctx),
      listCalls: (receipts) => this.listCalls(receipts),
      preview: () => this.preview(),
      createReminder: (input, ctx) => this.createReminder(input, ctx),
      fireReminder: (ctx) => this.fireReminder(ctx),
      connectProvider: (displayName, ctx, credentialHandle) => this.connectProvider(displayName, ctx, credentialHandle),
      syncProviderEvents: (connectionId, events, ctx) => this.syncProviderEvents(connectionId, events, ctx),
      subscribeLists: (listener) => this.plane.lists.subscribe(listener),
    };
  }

  createEvent(input: CreateEventInput, ctx: RequestContext): EventView {
    const tenantId = ctx.actor.actor.tenantId;
    if (!tenantId) throw new CalendarError("denied", "createEvent requires a tenant-scoped actor");
    const run = () => {
      const id = nextId("calendar_event");
      const createdAt = this.#now();
      this.registry.register({ type: "calendar_event", id, tenantId, createdAt, facet: null });
      this.access.put(id, emptyAccess(ctx.actor.actor.id, tenantId));
      const event: CalendarEventRecord = {
        id,
        tenantId,
        title: input.title,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        providerEventId: input.providerEventId ?? null,
        connectionId: input.connectionId ?? null,
        recurrenceRule: input.recurrenceRule ?? null,
        deleted: false,
        version: 1,
        createdAt,
      };
      this.#events.set(id, event);
      this.#publishEvent(event, ctx, "created");
      const receipt = this.engine.mint({
        actor: ctx.actor,
        entityType: "calendar_event",
        entityId: id,
        need: "owner",
      });
      return { event, receipt };
    };
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  editEvent(patch: { title?: string; startsAt?: number; endsAt?: number }, ctx: RequestContext): CalendarEventRecord {
    const receipt = ctx.receipt;
    if (!receipt) throw new CalendarError("missing_receipt", "editEvent requires a receipt");
    requireReceipt(receipt, "edit", receipt.entityId);
    const current = this.#requireEvent(receipt.entityId);
    const next: CalendarEventRecord = {
      ...current,
      title: patch.title ?? current.title,
      startsAt: patch.startsAt ?? current.startsAt,
      endsAt: patch.endsAt ?? current.endsAt,
      version: current.version + 1,
    };
    this.#events.set(next.id, next);
    this.#publishEvent(next, ctx, "edited");
    return next;
  }

  openEvent(entityId: string, ctx: RequestContext): EventView {
    const event = this.#requireEvent(entityId);
    const receipt = this.#mintOrRequire(ctx, "calendar_event", entityId, "view");
    requireReceipt(receipt, "view", entityId);
    this.activity.append({
      id: `opened:${entityId}:${event.version}:${ctx.actor.actor.id}`,
      action: "opened",
      entityType: "calendar_event",
      entityId,
      actorId: ctx.actor.actor.id,
      tenantId: event.tenantId,
      occurredAt: this.#now(),
    });
    return { event, receipt };
  }

  listEvents(receipts: readonly Receipt[]): SoupItem[] {
    return this.plane.lists.query({ types: ["calendar_event"] }, receipts).items;
  }

  createCall(input: CreateCallInput, ctx: RequestContext): CallView {
    const tenantId = ctx.actor.actor.tenantId;
    if (!tenantId) throw new CalendarError("denied", "createCall requires a tenant-scoped actor");
    const run = () => {
      const id = nextId("call");
      const createdAt = this.#now();
      const participantIds = unique([ctx.actor.actor.id, ...(input.participantIds ?? [])]);
      this.registry.register({ type: "call", id, tenantId, createdAt, facet: null });
      this.access.put(id, {
        ...emptyAccess(ctx.actor.actor.id, tenantId),
        participantIds,
        callChannelId: input.channelId ?? null,
      });
      const call: CallRecord = {
        id,
        tenantId,
        title: input.title,
        status: "scheduled",
        participantIds,
        channelId: input.channelId ?? null,
        calendarEventId: input.calendarEventId ?? null,
        room: null,
        transcriptId: null,
        recordingHandle: null,
        finalized: false,
        version: 1,
        createdAt,
      };
      this.#calls.set(id, call);
      this.#publishCall(call, ctx, "created");
      const receipt = this.engine.mint({
        actor: ctx.actor,
        entityType: "call",
        entityId: id,
        need: "owner",
      });
      return { call, receipt, transcript: null };
    };
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  joinCall(ctx: RequestContext): CallView {
    const receipt = ctx.receipt;
    if (!receipt) throw new CalendarError("missing_receipt", "joinCall requires a receipt");
    requireReceipt(receipt, "view", receipt.entityId);
    const current = this.#requireCall(receipt.entityId);
    if (current.finalized) throw new CalendarError("call_finalized", `${current.id} is finalized`);
    const actorId = ctx.actor.actor.id;
    const participantIds = unique([...current.participantIds, actorId]);
    const room = current.room ?? mintRoomHandle(current.id);
    const next: CallRecord = {
      ...current,
      status: "live",
      participantIds,
      room,
      version: current.version + 1,
    };
    this.access.put(next.id, {
      ...this.access.require(next.id),
      participantIds,
    });
    this.#calls.set(next.id, next);
    this.#publishCall(next, ctx, "call_started", "joined");
    const joined = this.engine.mint({
      actor: ctx.actor,
      entityType: "call",
      entityId: next.id,
      need: "view",
    });
    return { call: next, receipt: joined, transcript: this.transcripts.get(next.id) ?? null };
  }

  mintLiveKitRoom(ctx: RequestContext): LiveKitRoomHandle {
    const receipt = ctx.receipt;
    if (!receipt) throw new CalendarError("missing_receipt", "mintLiveKitRoom requires a receipt");
    requireReceipt(receipt, "view", receipt.entityId);
    const call = this.#requireCall(receipt.entityId);
    if (call.finalized) throw new CalendarError("call_finalized", `${call.id} is finalized`);
    const room = this.livekit.mintRoomToken(call.id);
    const next = { ...call, room, version: call.version + 1 };
    this.#calls.set(call.id, next);
    this.#publishCall(next, ctx, "edited");
    return room;
  }

  attachTranscript(body: string, ctx: RequestContext): TranscriptRecord {
    const receipt = ctx.receipt;
    if (!receipt) throw new CalendarError("missing_receipt", "attachTranscript requires a receipt");
    requireReceipt(receipt, "edit", receipt.entityId);
    const call = this.#requireCall(receipt.entityId);
    const transcript = this.transcripts.attach(call.id, body, this.#now());
    const next: CallRecord = {
      ...call,
      transcriptId: transcript.id,
      version: call.version + 1,
    };
    this.#calls.set(call.id, next);
    this.#publishCall(next, ctx, "edited", transcript.body);
    return transcript;
  }

  finalizeCall(ctx: RequestContext): CallRecord {
    const receipt = ctx.receipt;
    if (!receipt) throw new CalendarError("missing_receipt", "finalizeCall requires a receipt");
    requireReceipt(receipt, "edit", receipt.entityId);
    const current = this.#requireCall(receipt.entityId);
    if (current.finalized) return current;
    const next: CallRecord = {
      ...current,
      status: "finalized",
      finalized: true,
      recordingHandle: current.recordingHandle ?? `r2:calls/${current.id}/recording`,
      version: current.version + 1,
    };
    this.#calls.set(next.id, next);
    this.#publishCall(next, ctx, "edited");
    return next;
  }

  openCall(entityId: string, ctx: RequestContext): CallView {
    const call = this.#requireCall(entityId);
    const receipt = this.#mintOrRequire(ctx, "call", entityId, "view");
    requireReceipt(receipt, "view", entityId);
    this.activity.append({
      id: `opened:${entityId}:${call.version}:${ctx.actor.actor.id}`,
      action: "opened",
      entityType: "call",
      entityId,
      actorId: ctx.actor.actor.id,
      tenantId: call.tenantId,
      occurredAt: this.#now(),
    });
    return { call, receipt, transcript: this.transcripts.get(entityId) ?? null };
  }

  listCalls(receipts: readonly Receipt[]): SoupItem[] {
    return this.plane.lists.query({ types: ["call"] }, receipts).items;
  }

  /**
   * OD-8/N15: ffmpeg preview is out of scope. Always unsupported.
   */
  preview(): never {
    return preview();
  }

  createReminder(input: CreateReminderInput, ctx: RequestContext): ReminderView {
    const tenantId = ctx.actor.actor.tenantId;
    if (!tenantId) throw new CalendarError("denied", "createReminder requires a tenant-scoped actor");
    const run = () => {
      const id = nextId("reminder");
      const createdAt = this.#now();
      this.registry.register({ type: "reminder", id, tenantId, createdAt, facet: null });
      this.access.put(id, emptyAccess(ctx.actor.actor.id, tenantId));
      const reminder: ReminderRecord = {
        id,
        tenantId,
        title: input.title,
        fireAt: input.fireAt,
        timezone: input.timezone ?? "UTC",
        fired: false,
        entityId: input.entityId ?? null,
        version: 1,
        createdAt,
      };
      this.#reminders.set(id, reminder);
      this.#publishReminder(reminder, ctx, "created");
      const receipt = this.engine.mint({
        actor: ctx.actor,
        entityType: "reminder",
        entityId: id,
        need: "owner",
      });
      return { reminder, receipt };
    };
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  fireReminder(ctx: RequestContext): ReminderRecord {
    const receipt = ctx.receipt;
    if (!receipt) throw new CalendarError("missing_receipt", "fireReminder requires a receipt");
    requireReceipt(receipt, "edit", receipt.entityId);
    const current = this.#requireReminder(receipt.entityId);
    if (current.fired) return current;
    const next = { ...current, fired: true, version: current.version + 1 };
    this.#reminders.set(next.id, next);
    this.#publishReminder(next, ctx, "edited");
    return next;
  }

  connectProvider(displayName: string, ctx: RequestContext, credentialHandle = "handle"): ReturnType<CalendarProviderStore["connect"]> {
    return this.providers.connect({
      vendorId: "google-calendar",
      displayName,
      scope: "user",
      actor: ctx.actor,
      credentialHandle,
    });
  }

  syncProviderEvents(
    connectionId: string,
    events: readonly ProviderEventInput[],
    ctx: RequestContext,
  ): EventView[] {
    this.providers.mintSession(connectionId, ctx.actor);
    return events.map((row) =>
      this.createEvent(
        {
          title: row.title,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          providerEventId: row.providerEventId,
          connectionId,
          recurrenceRule: row.recurrenceRule ?? null,
        },
        ctx,
      ),
    );
  }

  /**
   * Explicitly not implemented. Instantly send/activate is N10-out-of-scope and
   * stays out of N13.
   */
  sendInstantly(): never {
    throw new CalendarError("send_forbidden", "N13 does not send Instantly");
  }

  getEvent(id: string): CalendarEventRecord | undefined {
    return this.#events.get(id);
  }

  getCall(id: string): CallRecord | undefined {
    return this.#calls.get(id);
  }

  getReminder(id: string): ReminderRecord | undefined {
    return this.#reminders.get(id);
  }

  rebuildProjection(): void {
    this.plane = new ProjectionPlane();
    this.plane.rebuild(this.outbox);
  }

  drain(publish: (env: EventEnvelope) => void = () => undefined): void {
    this.outbox.drain(publish);
    this.plane.ingest(this.outbox);
  }

  #mintOrRequire(
    ctx: RequestContext,
    entityType: "calendar_event" | "call",
    entityId: string,
    need: "view",
  ): Receipt {
    if (ctx.receipt && ctx.receipt.entityId === entityId) return ctx.receipt;
    try {
      return this.engine.mint({ actor: ctx.actor, entityType, entityId, need });
    } catch (error) {
      if (error instanceof AuthzError) throw error;
      throw new CalendarError("denied", error instanceof Error ? error.message : "denied");
    }
  }

  #requireEvent(id: string): CalendarEventRecord {
    const event = this.#events.get(id);
    if (!event) throw new CalendarError("unknown_event", `unknown event ${id}`);
    return event;
  }

  #requireCall(id: string): CallRecord {
    const call = this.#calls.get(id);
    if (!call) throw new CalendarError("unknown_call", `unknown call ${id}`);
    return call;
  }

  #requireReminder(id: string): ReminderRecord {
    const reminder = this.#reminders.get(id);
    if (!reminder) throw new CalendarError("unknown_reminder", `unknown reminder ${id}`);
    return reminder;
  }

  #publishEvent(
    event: CalendarEventRecord,
    ctx: RequestContext,
    action: Extract<ActivityAction, "created" | "edited" | "deleted">,
  ): void {
    this.#publish({
      topic: "calls",
      entityType: "calendar_event",
      entityId: event.id,
      tenantId: event.tenantId,
      version: event.version,
      ctx,
      action,
      payload: {
        title: event.title,
        facet: null,
        body: "",
        tombstoned: event.deleted,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        providerEventId: event.providerEventId,
        createdAt: event.createdAt,
      },
    });
  }

  #publishCall(
    call: CallRecord,
    ctx: RequestContext,
    action: Extract<ActivityAction, "created" | "edited" | "deleted" | "call_started">,
    body = "",
  ): void {
    this.#publish({
      topic: "calls",
      entityType: "call",
      entityId: call.id,
      tenantId: call.tenantId,
      version: call.version,
      ctx,
      action,
      payload: {
        title: call.title,
        facet: null,
        body,
        tombstoned: false,
        status: call.status as CallStatus,
        finalized: call.finalized,
        createdAt: call.createdAt,
      },
    });
  }

  #publishReminder(
    reminder: ReminderRecord,
    ctx: RequestContext,
    action: Extract<ActivityAction, "created" | "edited" | "deleted">,
  ): void {
    this.#publish({
      topic: "calls",
      entityType: "reminder",
      entityId: reminder.id,
      tenantId: reminder.tenantId,
      version: reminder.version,
      ctx,
      action,
      payload: {
        title: reminder.title,
        facet: null,
        body: "",
        tombstoned: false,
        fireAt: reminder.fireAt,
        fired: reminder.fired,
        createdAt: reminder.createdAt,
      },
    });
  }

  #publish(input: {
    topic: Topic;
    entityType: "calendar_event" | "call" | "reminder";
    entityId: string;
    tenantId: string;
    version: number;
    ctx: RequestContext;
    action: Extract<ActivityAction, "created" | "edited" | "deleted" | "call_started">;
    payload: Record<string, unknown>;
  }): void {
    const occurredAt = this.#now();
    this.outbox.append(
      envelope({
        topic: input.topic,
        entityType: input.entityType,
        entityId: input.entityId,
        tenantId: input.tenantId,
        actorId: input.ctx.actor.actor.id,
        onBehalfOfId: input.ctx.actor.onBehalfOf?.id ?? null,
        occurredAt,
        version: input.version,
        payload: input.payload,
        receipt: {
          level: input.ctx.receipt?.level ?? "owner",
          entityType: input.entityType,
          entityId: input.entityId,
          actorId: input.ctx.actor.actor.id,
        },
        correlationId: input.ctx.correlationId,
      }),
    );
    this.activity.append({
      id: `${input.action}:${input.entityId}:${input.version}`,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.ctx.actor.actor.id,
      tenantId: input.tenantId,
      occurredAt,
    });
    this.drain();
  }

  #now(): number {
    this.#clock += 1;
    return this.#clock;
  }
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function actorContext(actor: ActorContext["actor"], kernelUsername = "admin"): ActorContext {
  return { actor, kernelUsername, isDeploymentAdmin: false };
}

export { requestContext };
export type { CallStatus };
