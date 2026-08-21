import { createHmac, randomBytes } from "node:crypto";
import { IdempotencyStore, runOnce } from "control-plane";
import type { ActorContext } from "identity/principal";
import { ConnectivityError } from "./errors.js";
import type { SafeFetch } from "./safe-fetch.js";

/** First attempt is immediate; four retries use this ladder. Total attempts = 5. */
export const WEBHOOK_RETRY_DELAYS_SECONDS = [30, 60, 120, 300] as const;
export const WEBHOOK_MAX_ATTEMPTS = 5;

/** Wire headers renamed from legacy `x-macro-*` per OD-24 amendment (owner ruling, 2026-08-20). */
export const WEBHOOK_SIGNATURE_HEADER = "x-neuwave-signature";
export const WEBHOOK_TIMESTAMP_HEADER = "x-neuwave-timestamp";
export const WEBHOOK_EVENT_HEADER = "x-neuwave-event";
export const WEBHOOK_DELIVERY_HEADER = "x-neuwave-delivery";

export const DOCUMENT_EVENTS_ALL = [
  "created",
  "edited",
  "deleted",
  "moved",
  "restored",
  "content_uploaded",
  "sync_content_updated",
  "purged",
] as const;

export const DOCUMENT_EVENTS_NOT_FORWARDED = [
  "content_uploaded",
  "sync_content_updated",
  "purged",
] as const;

export const DOCUMENT_EVENTS_FORWARDED = [
  "created",
  "edited",
  "deleted",
  "moved",
  "restored",
] as const;

export const CHANNEL_WEBHOOK_EVENTS = [
  "message_created",
  "message_edited",
  "message_deleted",
  "reaction_added",
  "reaction_removed",
  "member_joined",
  "member_left",
  "channel_created",
  "channel_renamed",
  "thread_created",
  "pin_added",
] as const;

export const META_WEBHOOK_EVENTS = [
  "webhook.created",
  "webhook.updated",
  "webhook.paused",
  "webhook.disabled",
] as const;

export type WebhookStatus = "active" | "paused" | "disabled";
export type WebhookOwnerKind = "user" | "bot";

export interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
  status: WebhookStatus
  pauseReason: string | null
  ownerKind: WebhookOwnerKind
  ownerId: string
  tenantId: string
  orderingKey: number
}

export interface WebhookCreateResult {
  endpoint: WebhookEndpoint
  /** Read-once. Subsequent reads throw secret_spent. */
  secret: string
}

export interface DeliveryAttempt {
  attempt: number
  at: number
  delaySeconds: number
  status: number | "error"
  error?: string
}

export interface DeliveryRecord {
  webhookId: string
  eventId: string
  eventName: string
  orderingKey: number
  payload: string
  attempts: DeliveryAttempt[]
  status: "pending" | "delivered" | "poison"
}

export function signWebhook(secret: string, timestamp: string, rawBody: string): string {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `sha256=${digest}`;
}

export function verifyWebhookSignature(secret: string, timestamp: string, rawBody: string, signature: string): boolean {
  return signWebhook(secret, timestamp, rawBody) === signature;
}

export function assertForwardableEvent(eventName: string): void {
  if ((DOCUMENT_EVENTS_NOT_FORWARDED as readonly string[]).includes(eventName)) {
    throw new ConnectivityError("not_forwarded", `${eventName} is never forwarded`);
  }
}

function delayForAttempt(attempt: number): number {
  if (attempt <= 1) return 0;
  return WEBHOOK_RETRY_DELAYS_SECONDS[attempt - 2] ?? WEBHOOK_RETRY_DELAYS_SECONDS[WEBHOOK_RETRY_DELAYS_SECONDS.length - 1];
}

export class WebhookRegistry {
  readonly endpoints = new Map<string, WebhookEndpoint>();
  readonly secrets = new Map<string, string>();
  readonly revealed = new Set<string>();
  readonly deliveries = new Map<string, DeliveryRecord>();
  readonly idempotency = new IdempotencyStore();
  #seq = 0;
  #validateHits = new Map<string, number[]>();

  constructor(private readonly fetch: SafeFetch) {}

  create(input: {
    url: string
    events: string[]
    actor: ActorContext
    ownerKind?: WebhookOwnerKind
  }): WebhookCreateResult {
    const tenantId = input.actor.actor.tenantId;
    if (!tenantId) throw new ConnectivityError("denied", "webhook create requires a tenant");
    const ownerKind = input.ownerKind ?? (input.actor.actor.kind === "bot" ? "bot" : "user");
    if (ownerKind === "bot" && input.actor.actor.kind !== "bot") {
      throw new ConnectivityError("xor_owner", "bot-owned webhook requires a bot principal");
    }
    if (ownerKind === "user" && input.actor.actor.kind === "bot") {
      throw new ConnectivityError("xor_owner", "user-owned webhook cannot be created by a bot");
    }
    for (const eventName of input.events) assertForwardableEvent(eventName);
    this.#seq += 1;
    const id = `whk_${this.#seq.toString(16).padStart(32, "0")}`;
    const endpoint: WebhookEndpoint = {
      id,
      url: input.url,
      events: [...input.events],
      status: "active",
      pauseReason: null,
      ownerKind,
      ownerId: input.actor.actor.id,
      tenantId,
      orderingKey: 0,
    };
    const secret = randomBytes(32).toString("hex");
    this.endpoints.set(id, endpoint);
    this.secrets.set(id, secret);
    return { endpoint, secret };
  }

  readSecretOnce(webhookId: string, actor: ActorContext): string {
    this.#requireOwner(webhookId, actor);
    if (this.revealed.has(webhookId)) {
      throw new ConnectivityError("secret_spent", "signing secret is read-once");
    }
    this.revealed.add(webhookId);
    return this.secrets.get(webhookId)!;
  }

  pause(webhookId: string, actor: ActorContext, reason: string): WebhookEndpoint {
    const endpoint = this.#requireOwner(webhookId, actor);
    const next = { ...endpoint, status: "paused" as const, pauseReason: reason };
    this.endpoints.set(webhookId, next);
    return next;
  }

  disable(webhookId: string, actor: ActorContext): WebhookEndpoint {
    const endpoint = this.#requireOwner(webhookId, actor);
    const next = { ...endpoint, status: "disabled" as const, pauseReason: "disabled" };
    this.endpoints.set(webhookId, next);
    return next;
  }

  list(tenantId: string): WebhookEndpoint[] {
    return [...this.endpoints.values()].filter((row) => row.tenantId === tenantId);
  }

  validateUrl(actor: ActorContext, url: string, now = Date.now()): boolean {
    const key = actor.actor.id;
    const windowStart = now - 60_000;
    const hits = (this.#validateHits.get(key) ?? []).filter((at) => at >= windowStart);
    if (hits.length >= 5) throw new ConnectivityError("rate_limited", "validate is limited to 5/min");
    hits.push(now);
    this.#validateHits.set(key, hits);
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }

  enqueue(webhookId: string, eventName: string, eventId: string, payload: Record<string, unknown>): DeliveryRecord {
    assertForwardableEvent(eventName);
    const endpoint = this.endpoints.get(webhookId);
    if (!endpoint) throw new ConnectivityError("unknown_connector", `unknown webhook ${webhookId}`);
    if (endpoint.status !== "active") throw new ConnectivityError("paused", `webhook is ${endpoint.status}`);
    if (!endpoint.events.includes(eventName)) {
      throw new ConnectivityError("unknown_event", `${eventName} is not subscribed`);
    }
    const key = `${webhookId}:${eventId}`;
    return runOnce(this.idempotency, key, () => {
      endpoint.orderingKey += 1;
      const record: DeliveryRecord = {
        webhookId,
        eventId,
        eventName,
        orderingKey: endpoint.orderingKey,
        payload: JSON.stringify(payload),
        attempts: [],
        status: "pending",
      };
      this.deliveries.set(key, record);
      this.endpoints.set(webhookId, endpoint);
      return record;
    });
  }

  async drain(now = Date.now()): Promise<void> {
    const pending = [...this.deliveries.values()]
      .filter((row) => row.status === "pending")
      .sort((a, b) => a.orderingKey - b.orderingKey);
    for (const row of pending) {
      await this.#attempt(row, now);
    }
  }

  inspect(webhookId: string, eventId: string): DeliveryRecord | undefined {
    return this.deliveries.get(`${webhookId}:${eventId}`);
  }

  async #attempt(row: DeliveryRecord, now: number): Promise<void> {
    const attempt = row.attempts.length + 1;
    const delay = delayForAttempt(attempt);
    const secret = this.secrets.get(row.webhookId)!;
    const endpoint = this.endpoints.get(row.webhookId)!;
    const timestamp = String(now);
    const signature = signWebhook(secret, timestamp, row.payload);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
      [WEBHOOK_SIGNATURE_HEADER]: signature,
      [WEBHOOK_EVENT_HEADER]: row.eventName,
      [WEBHOOK_DELIVERY_HEADER]: row.eventId,
    };
    for (const name of Object.keys(headers)) {
      if (name.startsWith("x-neuwave-") && !isReservedWebhookHeader(name)) {
        throw new ConnectivityError("denied", `reserved header ${name}`);
      }
    }
    try {
      const response = await this.fetch.fetch(endpoint.url, { method: "POST", headers, body: row.payload });
      row.attempts.push({ attempt, at: now, delaySeconds: delay, status: response.status });
      if (response.status >= 200 && response.status < 300) {
        row.status = "delivered";
        return;
      }
      this.#fail(row, endpoint, attempt, `http ${response.status}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "fetch failed";
      row.attempts.push({ attempt, at: now, delaySeconds: delay, status: "error", error: message });
      if (error instanceof ConnectivityError && error.code === "od6_blocked") {
        this.#fail(row, endpoint, WEBHOOK_MAX_ATTEMPTS, message);
        return;
      }
      this.#fail(row, endpoint, attempt, message);
    }
  }

  #fail(row: DeliveryRecord, endpoint: WebhookEndpoint, attempt: number, reason: string): void {
    if (attempt >= WEBHOOK_MAX_ATTEMPTS) {
      row.status = "poison";
      const paused = {
        ...endpoint,
        status: "paused" as const,
        pauseReason: `auto-paused: ${reason}`,
      };
      this.endpoints.set(endpoint.id, paused);
    }
  }

  #requireOwner(webhookId: string, actor: ActorContext): WebhookEndpoint {
    const endpoint = this.endpoints.get(webhookId);
    if (!endpoint) throw new ConnectivityError("unknown_connector", `unknown webhook ${webhookId}`);
    if (endpoint.ownerId !== actor.actor.id) throw new ConnectivityError("denied", "webhook owner mismatch");
    if (actor.actor.tenantId !== endpoint.tenantId) {
      throw new ConnectivityError("denied", "cross-tenant webhook");
    }
    return endpoint;
  }
}

export function isReservedWebhookHeader(name: string): boolean {
  return [
    WEBHOOK_SIGNATURE_HEADER,
    WEBHOOK_TIMESTAMP_HEADER,
    WEBHOOK_EVENT_HEADER,
    WEBHOOK_DELIVERY_HEADER,
  ].includes(name);
}

export function webhookRetryPlan(): { attempt: number; delaySeconds: number }[] {
  return Array.from({ length: WEBHOOK_MAX_ATTEMPTS }, (_, index) => ({
    attempt: index + 1,
    delaySeconds: delayForAttempt(index + 1),
  }));
}
