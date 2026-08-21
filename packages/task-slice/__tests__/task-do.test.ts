import { env } from "cloudflare:workers";
import { evictDurableObject, reset } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { emptyAccess, grantShare } from "authz";
import { requestContext } from "control-plane";
import { userPrincipal } from "identity/principal";
import { fixtureId, resetIdSequence } from "registry";
import { actorContext } from "../src/slice.js";
import { DurableTaskApi } from "../src/durable-task-api.js";
import { dryRunIdentityMapping } from "../src/mapping.js";
import type { TaskSliceDurableObject } from "../src/task-do.js";

const testEnv = env as unknown as {
  TASK_SLICE: DurableObjectNamespace<TaskSliceDurableObject>;
  SOUP: D1Database;
};

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);
const teammateId = fixtureId("user", 2);

function ownerActor() {
  return actorContext(userPrincipal(ownerId, tenant));
}

afterEach(async () => {
  await reset();
});

describe("N6 TaskSliceDurableObject + D1 lists (11 slice gates)", () => {
  it("maps legacy task ids without writing (migration fixture)", () => {
    const mapped = dryRunIdentityMapping([{ table: "tasks", pgId: 42 }]);
    expect(mapped[0]?.wrote).toBe(false);
    expect(mapped[0]?.entityType).toBe("document");
    expect(mapped[0]?.facet).toBe("task");
  });

  it("creates, lists from D1, edits, and changes status through the RPC stub", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const ctx = requestContext(ownerActor(), { correlationId: "create-1" });
    const { task, receipt } = await api.createTask("Ship the slice", ctx);
    expect(task.facet).toBe("task");

    const listed = await api.listTasks([receipt]);
    expect(listed.map((item) => item.title)).toEqual(["Ship the slice"]);

    const writeCtx = requestContext(ownerActor(), { receipt, correlationId: "edit-1" });
    await api.updateTitle("Ship the slice v2", writeCtx);
    await api.setStatus("in_progress", writeCtx);
    await api.setPriority("high", writeCtx);
    await api.setAssignee(ownerId, writeCtx);
    await api.markDone(true, writeCtx);

    expect((await api.listTasks([receipt]))[0]?.title).toBe("Ship the slice v2");
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    expect((await stub.get(task.id))?.status).toBe("in_progress");
    expect((await stub.get(task.id))?.done).toBe(true);
    expect(await api.listTasks([])).toHaveLength(0);
  });

  it("authoritative writes and D1 projection survive DO eviction", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const { task, receipt } = await api.createTask("Keep me", requestContext(ownerActor(), { correlationId: "p1" }));
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    await evictDurableObject(stub);

    expect((await stub.get(task.id))?.title).toBe("Keep me");
    expect((await api.listTasks([receipt])).map((item) => item.title)).toEqual(["Keep me"]);

    await api.updateTitle("Kept after eviction", requestContext(ownerActor(), { receipt, correlationId: "p2" }));
    expect((await api.listTasks([receipt]))[0]?.title).toBe("Kept after eviction");
  });

  it("live-subscribes and reconnects from cursor after eviction (no loss or duplication)", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const { receipt } = await api.createTask("One", requestContext(ownerActor(), { correlationId: "s1" }));
    const cursor = await api.seq();
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    await evictDurableObject(stub);
    await api.updateTitle("Two", requestContext(ownerActor(), { receipt, correlationId: "s2" }));
    const missed = await api.replayFrom(cursor);
    expect(missed.map((delta) => delta.item.title)).toEqual(["Two"]);
    expect(missed).toHaveLength(1);
  });

  it("rebuilds D1 from the outbox after a projection drop", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const { receipt } = await api.createTask("Keep me", requestContext(ownerActor(), { correlationId: "r1" }));
    await testEnv.SOUP.prepare("DELETE FROM entity_row").run();
    expect(await api.listTasks([receipt])).toHaveLength(0);
    await api.rebuildProjection();
    expect((await api.listTasks([receipt]))[0]?.title).toBe("Keep me");
  });

  it("duplicate create with the same idempotency key is a no-op across eviction", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const ctx = requestContext(ownerActor(), { idempotencyKey: "task-once", correlationId: "id1" });
    const first = await api.createTask("Once", ctx);
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    await evictDurableObject(stub);
    const second = await api.createTask(
      "Once",
      requestContext(ownerActor(), { idempotencyKey: "task-once", correlationId: "id2" }),
    );
    expect(second.task.id).toBe(first.task.id);
    expect(await api.listTasks([first.receipt])).toHaveLength(1);
  });

  it("share then revoke hides the D1 row (SEC-1)", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    const { task, receipt } = await api.createTask("Secret", requestContext(ownerActor(), { correlationId: "sec" }));
    const shared = grantShare(emptyAccess(ownerId, tenant), teammateId, "comment");
    await stub.shareState(task.id, shared);
    const teammateMint = await stub.mintView(actorContext(userPrincipal(teammateId, tenant)), task.id, "view");
    expect(teammateMint.ok).toBe(true);
    if (!teammateMint.ok) throw new Error("expected teammate view");
    expect(await api.listTasks([teammateMint.receipt])).toHaveLength(1);
    await stub.shareState(task.id, emptyAccess(ownerId, tenant));
    const denied = await stub.mintView(actorContext(userPrincipal(teammateId, tenant)), task.id, "view");
    expect(denied.ok).toBe(false);
    if (denied.ok) throw new Error("expected deny");
    expect(denied.message).toMatch(/lacks view/);
    expect(await api.listTasks([])).toHaveLength(0);
    expect(await api.listTasks([receipt])).toHaveLength(1);
  });
});
