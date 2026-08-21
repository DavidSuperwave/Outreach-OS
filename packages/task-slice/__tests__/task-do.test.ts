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
import { handleTaskOutboxBatch } from "../src/outbox-queue.js";
import type { TaskSliceDurableObject } from "../src/task-do.js";

const testEnv = env as unknown as {
  TASK_SLICE: DurableObjectNamespace<TaskSliceDurableObject>;
  SOUP: D1Database;
};

const tenant = fixtureId("team", 1);
const tenantB = fixtureId("team", 2);
const ownerId = fixtureId("user", 1);
const teammateId = fixtureId("user", 2);
const ownerBId = fixtureId("user", 3);

function ownerActor() {
  return actorContext(userPrincipal(ownerId, tenant));
}

function ownerBActor() {
  return actorContext(userPrincipal(ownerBId, tenantB));
}

function teammateActor() {
  return actorContext(userPrincipal(teammateId, tenant));
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
    expect((await stub.get(task.id, ownerActor()))?.status).toBe("in_progress");
    expect((await api.listTasks([receipt]))[0]?.status).toBe("in_progress");
    expect((await api.listTasks([receipt]))[0]?.priority).toBe("high");
    expect((await api.listTasks([receipt]))[0]?.assigneeIds).toEqual([ownerId]);
    expect((await stub.get(task.id, ownerActor()))?.done).toBe(true);
    expect(await api.listTasks([])).toHaveLength(0);
  });

  it("authoritative writes and D1 projection survive DO eviction", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const { task, receipt } = await api.createTask("Keep me", requestContext(ownerActor(), { correlationId: "p1" }));
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    await evictDurableObject(stub);

    expect((await stub.get(task.id, ownerActor()))?.title).toBe("Keep me");
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
    const missed = await api.replayFrom(cursor, ownerActor());
    expect(missed.map((delta) => delta.item.title)).toEqual(["Two"]);
    expect(missed).toHaveLength(1);
  });

  it("pushes live websocket deltas and replays from cursor", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const { receipt } = await api.createTask("Wired", requestContext(ownerActor(), { correlationId: "ws1" }));
    const cursor = await api.seq();
    const res = await api.subscribe(cursor, ownerActor());
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    expect(ws).toBeTruthy();
    if (!ws) throw new Error("expected websocket");
    const messages: Array<{ type: string; deltas?: Array<{ item: { title: string } }> }> = [];
    ws.accept();
    const got = new Promise<void>((resolve) => {
      ws.addEventListener("message", (event) => {
        messages.push(JSON.parse(String(event.data)) as (typeof messages)[number]);
        if (messages.some((msg) => msg.deltas?.some((delta) => delta.item.title === "Wired v2"))) resolve();
      });
    });
    await api.updateTitle("Wired v2", requestContext(ownerActor(), { receipt, correlationId: "ws2" }));
    await Promise.race([
      got,
      new Promise((_, reject) => setTimeout(() => reject(new Error("no websocket delta")), 2000)),
    ]);
    const titles = messages.flatMap((msg) => (msg.deltas ?? []).map((delta) => delta.item.title));
    expect(titles).toContain("Wired v2");
  });

  it("rebuilds D1 from the outbox after a projection drop", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const { receipt } = await api.createTask("Keep me", requestContext(ownerActor(), { correlationId: "r1" }));
    await testEnv.SOUP.prepare("DELETE FROM entity_row").run();
    await api.rebuildProjection(ownerActor());
    expect((await api.listTasks([receipt]))[0]?.title).toBe("Keep me");
  });

  it("re-projects D1 when the outbox queue consumer drains the DO", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const { receipt } = await api.createTask("Queued", requestContext(ownerActor(), { correlationId: "q1" }));
    await testEnv.SOUP.prepare("DELETE FROM entity_row").run();
    const acked: string[] = [];
    await handleTaskOutboxBatch(
      {
        messages: [
          {
            body: { tenantId: tenant },
            ack: () => {
              acked.push(tenant);
            },
          },
        ],
      },
      testEnv,
    );
    expect(acked).toEqual([tenant]);
    expect((await api.listTasks([receipt]))[0]?.title).toBe("Queued");
    expect(await api.drainOutbox()).toEqual({ pending: 0 });
  });

  it("poisons failing publishes on the DO and skips them on rebuild", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const { receipt } = await api.createTask("Keep me", requestContext(ownerActor(), { correlationId: "poi" }));
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    expect(await stub.poisonPending(5)).toBe(1);
    await evictDurableObject(stub);
    await api.rebuildProjection(ownerActor());
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

  it("share then revoke hides the D1 row (SEC-1); non-owners cannot overwrite ACL", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    const { task, receipt } = await api.createTask("Secret", requestContext(ownerActor(), { correlationId: "sec" }));
    const shared = grantShare(emptyAccess(ownerId, tenant), teammateId, "comment");
    const deniedShare = await stub.shareState(task.id, shared, actorContext(userPrincipal(teammateId, tenant)));
    expect(deniedShare.ok).toBe(false);
    if (deniedShare.ok) throw new Error("expected owner-only share");
    expect(deniedShare.message).toMatch(/lacks owner/);
    const sharedOk = await stub.shareState(task.id, shared, ownerActor());
    expect(sharedOk.ok).toBe(true);
    const teammateMint = await stub.mintView(actorContext(userPrincipal(teammateId, tenant)), task.id, "view");
    expect(teammateMint.ok).toBe(true);
    if (!teammateMint.ok) throw new Error("expected teammate view");
    expect(await api.listTasks([teammateMint.receipt])).toHaveLength(1);
    await stub.shareState(task.id, emptyAccess(ownerId, tenant), ownerActor());
    const denied = await stub.mintView(actorContext(userPrincipal(teammateId, tenant)), task.id, "view");
    expect(denied.ok).toBe(false);
    if (denied.ok) throw new Error("expected deny");
    expect(denied.message).toMatch(/lacks view/);
    expect(await api.listTasks([])).toHaveLength(0);
    expect(await api.listTasks([receipt])).toHaveLength(1);
  });

  it("tenant A projection does not wipe tenant B D1 rows", async () => {
    resetIdSequence();
    const apiA = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const apiB = new DurableTaskApi(testEnv.TASK_SLICE, tenantB);
    const a = await apiA.createTask("Alpha", requestContext(ownerActor(), { correlationId: "a1" }));
    const b = await apiB.createTask("Bravo", requestContext(ownerBActor(), { correlationId: "b1" }));
    await apiA.updateTitle("Alpha v2", requestContext(ownerActor(), { receipt: a.receipt, correlationId: "a2" }));
    expect((await apiA.listTasks([a.receipt])).map((item) => item.title)).toEqual(["Alpha v2"]);
    expect((await apiB.listTasks([b.receipt])).map((item) => item.title)).toEqual(["Bravo"]);
    const { results } = await testEnv.SOUP.prepare(
      "SELECT tenant_id, title FROM entity_row WHERE facet = 'task' ORDER BY title",
    ).all<{ tenant_id: string; title: string }>();
    expect(results.map((row) => `${row.tenant_id}:${row.title}`)).toEqual([
      `${tenant}:Alpha v2`,
      `${tenantB}:Bravo`,
    ]);
  });

  it("rejects subscribe without an actor and hides revoked rows on the socket (SEC-1)", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    const missing = await stub.fetch("https://task-slice/subscribe?cursor=0", {
      headers: { Upgrade: "websocket" },
    });
    expect(missing.status).toBe(401);

    const { task, receipt } = await api.createTask("Secret", requestContext(ownerActor(), { correlationId: "ws-sec" }));
    await stub.shareState(task.id, grantShare(emptyAccess(ownerId, tenant), teammateId, "comment"), ownerActor());
    const shared = await api.subscribe(0, teammateActor());
    expect(shared.status).toBe(101);
    shared.webSocket?.accept();
    await stub.shareState(task.id, emptyAccess(ownerId, tenant), ownerActor());
    const revoked = await api.subscribe(0, teammateActor());
    expect(revoked.status).toBe(101);
    const ws = revoked.webSocket;
    if (!ws) throw new Error("expected websocket");
    const replay = new Promise<string[]>((resolve) => {
      ws.addEventListener("message", (event) => {
        const payload = JSON.parse(String(event.data)) as { deltas?: Array<{ item: { title: string } }> };
        resolve((payload.deltas ?? []).map((delta) => delta.item.title));
      });
    });
    ws.accept();
    expect(await Promise.race([replay, new Promise<string[]>((r) => setTimeout(() => r(["timeout"]), 500))])).toEqual(
      [],
    );
    expect(await stub.get(task.id, teammateActor())).toBeNull();
    expect(await stub.get(task.id, ownerActor())).not.toBeNull();
    void receipt;
  });

  it("re-mints at the DO boundary so a forged edit receipt cannot write", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const { task, receipt } = await api.createTask("Guard", requestContext(ownerActor(), { correlationId: "forge" }));
    const forged = {
      level: "edit" as const,
      entityType: "document" as const,
      entityId: task.id,
      actorId: teammateId,
      tenantId: tenant,
    };
    const denied = api
      .updateTitle(
        "pwned",
        requestContext(teammateActor(), { receipt: forged as typeof receipt, correlationId: "forge-w" }),
      )
      .then(
        () => "wrote",
        (error: Error) => error.message,
      );
    expect(await denied).toMatch(/lacks edit|lacks view/);
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    expect((await stub.get(task.id, ownerActor()))?.title).toBe("Guard");
  });

  it("rejects a foreign-tenant actor on this DO", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    await api.createTask("Home", requestContext(ownerActor(), { correlationId: "home" }));
    const denied = api.createTask("Away", requestContext(ownerBActor(), { correlationId: "away" })).then(
      () => "created",
      (error: Error) => error.message,
    );
    expect(await denied).toMatch(/tenant mismatch/);
  });
});
