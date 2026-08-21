import { describe, expect, it } from "vitest";
import { fixtureId } from "registry";
import { userPrincipal } from "identity/principal";
import { ALL_TOPICS, FORBIDDEN_TOPICS, PRODUCT_TOPICS, isProductTopic } from "./topics.js";
import { ACTIVITY_ACTIONS, ActivityLog } from "./activity.js";
import { deterministicEventId, envelope } from "./envelope.js";
import { requestContext } from "./context.js";
import { IdempotencyStore, runOnce } from "./idempotency.js";
import { Outbox } from "./outbox.js";
import { REDIS_SUCCESSORS, redisSuccessor } from "./redis-map.js";
import { redactSecrets, assertNoSecretInLogs } from "./secrets.js";
import { STORAGE_OWNERS, ownerOf } from "./ownership.js";

const tenant = fixtureId("team", 1);
const actorId = fixtureId("user", 1);
const docId = fixtureId("document", 1);

function actor() {
  return {
    actor: userPrincipal(actorId, tenant),
    kernelUsername: "admin",
    isDeploymentAdmin: true,
  };
}

describe("bus topics (corrected E3)", () => {
  it("freezes 12 product topics and forbids com/activity_events", () => {
    expect(PRODUCT_TOPICS).toHaveLength(12);
    expect(ALL_TOPICS).toHaveLength(13);
    expect(isProductTopic("documents")).toBe(true);
    expect(isProductTopic("activity_events")).toBe(false);
    expect(FORBIDDEN_TOPICS).toEqual(["com", "activity_events"]);
  });
});

describe("activity fact log", () => {
  it("freezes the OD-21 10-action vocabulary and dedupes by id", () => {
    expect(ACTIVITY_ACTIONS).toHaveLength(10);
    const log = new ActivityLog();
    const fact = {
      id: "a1",
      action: "created" as const,
      entityType: "document",
      entityId: docId,
      actorId,
      tenantId: tenant,
      occurredAt: 1,
    };
    log.append(fact);
    log.append(fact);
    expect(log.list()).toHaveLength(1);
  });
});

describe("envelope + receipts as control-plane type", () => {
  it("mints deterministic event ids (entity+version) and optional receipt context", () => {
    const a = envelope({
      topic: "documents",
      entityType: "document",
      entityId: docId,
      tenantId: tenant,
      actorId,
      onBehalfOfId: null,
      occurredAt: 1,
      version: 3,
      payload: { op: "share" },
      receipt: { level: "owner", entityType: "document", entityId: docId, actorId },
      correlationId: "c1",
    });
    const b = envelope({
      topic: "documents",
      entityType: "document",
      entityId: docId,
      tenantId: tenant,
      actorId,
      onBehalfOfId: null,
      occurredAt: 9,
      version: 3,
      payload: { op: "other" },
      receipt: null,
      correlationId: "c2",
    });
    expect(a.eventId).toBe(b.eventId);
    expect(a.eventId).toBe(deterministicEventId("document", docId, 3));
    expect(a.receipt?.level).toBe("owner");
    const ctx = requestContext(actor(), { correlationId: "c1" });
    expect(ctx.receipt).toBeNull();
    expect(ctx.actor.actor.id).toBe(actorId);
  });
});

describe("idempotency and outbox replay (release gate 4)", () => {
  it("duplicate delivery is a no-op", () => {
    const store = new IdempotencyStore();
    let calls = 0;
    const first = runOnce(store, "k1", () => {
      calls += 1;
      return 42;
    });
    const second = runOnce(store, "k1", () => {
      calls += 1;
      return 99;
    });
    expect(first).toBe(42);
    expect(second).toBe(42);
    expect(calls).toBe(1);
  });

  it("outbox append is idempotent by eventId; poison is marked-and-skipped", () => {
    const box = new Outbox();
    const env = envelope({
      topic: "teams",
      entityType: "team",
      entityId: tenant,
      tenantId: tenant,
      actorId,
      onBehalfOfId: null,
      occurredAt: 1,
      version: 1,
      payload: {},
      receipt: null,
      correlationId: "c",
    });
    box.append(env);
    box.append(env);
    expect(box.pending()).toHaveLength(1);

    let fail = true;
    const published: string[] = [];
    const publish = () => {
      if (fail) throw new Error("boom");
      published.push("ok");
    };
    for (let i = 0; i < 5; i += 1) box.drain(publish);
    expect(box.poison()).toHaveLength(1);
    expect(published).toHaveLength(0);

    fail = false;
    const env2 = envelope({
      topic: "teams",
      entityType: "team",
      entityId: tenant,
      tenantId: tenant,
      actorId,
      onBehalfOfId: null,
      occurredAt: 2,
      version: 2,
      payload: {},
      receipt: null,
      correlationId: "c",
    });
    box.append(env2);
    box.drain(publish);
    expect(published).toEqual(["ok"]);
    box.checkpoint("soup", env2.eventId, 2);
    expect(box.getCheckpoint("soup")?.lastVersion).toBe(2);
    expect(box.replay(env.eventId).map((item) => item.version)).toEqual([2]);
  });
});

describe("OD-20 redis map, secrets, ownership", () => {
  it("ratifies the four redis successor roles", () => {
    expect(redisSuccessor("stream_transport")).toBe("queues_or_kernel_sessions");
    expect(redisSuccessor("cancellation_pubsub")).toBe("do_alarms");
    expect(redisSuccessor("counters")).toBe("do_storage_or_d1");
    expect(redisSuccessor("work_sets")).toBe("do_storage_or_d1");
    expect(Object.keys(REDIS_SUCCESSORS)).toHaveLength(4);
  });

  it("redacts secrets and refuses bearer tokens in logs", () => {
    const redacted = redactSecrets({ apiKey: "abc", nested: { token: "x" }, ok: 1 });
    expect(redacted).toEqual({ apiKey: "[redacted]", nested: { token: "[redacted]" }, ok: 1 });
    expect(() => assertNoSecretInLogs({ h: "Bearer abcdefghijklmno" })).toThrow(/secret leaked/);
  });

  it("every storage row has an owner", () => {
    expect(STORAGE_OWNERS.length).toBeGreaterThan(0);
    expect(ownerOf("entity_registry").owner).toBe("registry");
    expect(ownerOf("document_authority").owner).toBe("documents.DocumentsSlice");
    expect(ownerOf("folder_edges").kind).toBe("d1");
    expect(() => ownerOf("mystery")).toThrow(/unowned/);
  });
});
