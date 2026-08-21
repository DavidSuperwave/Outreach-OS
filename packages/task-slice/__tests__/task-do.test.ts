import { env } from "cloudflare:workers";
import { evictDurableObject, reset, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { emptyAccess, grantShare, withMembers } from "authz";
import { requestContext } from "control-plane";
import { userPrincipal } from "identity/principal";
import { fixtureId, resetIdSequence } from "registry";
import { ensureListSchema } from "soup";
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
const replacementId = fixtureId("user", 4);

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

  it("migrates populated v1 rows and rebuilds the projection without orphan access", async () => {
    await testEnv.SOUP.prepare(`CREATE TABLE entity_row (
      entity_id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      title TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      version INTEGER NOT NULL,
      facet TEXT,
      project_id TEXT,
      body TEXT NOT NULL DEFAULT '',
      unread INTEGER NOT NULL DEFAULT 0,
      done INTEGER NOT NULL DEFAULT 0,
      tombstoned INTEGER NOT NULL DEFAULT 0
    )`).run();
    await testEnv.SOUP.prepare(`CREATE TABLE entity_access_index (
      actor_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      level TEXT NOT NULL,
      PRIMARY KEY (actor_id, entity_id)
    )`).run();
    await testEnv.SOUP.prepare(
      `INSERT INTO entity_row
        (entity_id, entity_type, tenant_id, title, updated_at, created_at, version, facet)
       VALUES ('legacy-doc', 'document', ?, 'Legacy', 2, 1, 1, 'task')`,
    ).bind(tenant).run();
    await testEnv.SOUP.prepare(
      `INSERT INTO entity_access_index (actor_id, entity_id, entity_type, level)
       VALUES (?, 'legacy-doc', 'document', 'owner')`,
    ).bind(ownerId).run();

    await ensureListSchema(testEnv.SOUP);
    const { results: accessInfo } = await testEnv.SOUP.prepare(
      "PRAGMA table_info(entity_access_index)",
    ).all<{ name: string; pk: number }>();
    expect(
      accessInfo
        .filter((column) => column.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((column) => column.name),
    ).toEqual(["tenant_id", "actor_id", "entity_id"]);
    const migrated = await testEnv.SOUP.prepare(
      `SELECT tenant_id, actor_id, entity_id, level FROM entity_access_index`,
    ).first<{ tenant_id: string; actor_id: string; entity_id: string; level: string }>();
    expect(migrated).toEqual({
      tenant_id: tenant,
      actor_id: ownerId,
      entity_id: "legacy-doc",
      level: "owner",
    });

    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const created = await api.createTask(
      "Post migration",
      requestContext(ownerActor(), { correlationId: "post-migration" }),
    );
    await api.rebuildProjection(ownerActor());
    expect((await api.listVisible(ownerActor())).map((item) => item.title)).toEqual(["Post migration"]);
    const blank = await testEnv.SOUP.prepare(
      "SELECT COUNT(*) AS count FROM entity_access_index WHERE tenant_id = ''",
    ).first<{ count: number }>();
    expect(blank?.count).toBe(0);
    expect(created.task.id).toBe(fixtureId("document", 1));
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
    const row = await testEnv.SOUP.prepare(
      `SELECT title, status, priority, version, assignee_ids, tags, done
       FROM entity_row WHERE tenant_id = ? AND entity_id = ?`,
    ).bind(tenant, task.id).first<{
      title: string;
      status: string;
      priority: string;
      version: number;
      assignee_ids: string;
      tags: string;
      done: number;
    }>();
    expect(row).toEqual({
      title: "Ship the slice v2",
      status: "in_progress",
      priority: "high",
      version: 6,
      assignee_ids: JSON.stringify([ownerId]),
      tags: "[]",
      done: 1,
    });
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
    const { ticket } = await api.createSubscribeTicket(ownerActor());
    const res = await api.subscribe(cursor, ticket);
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
    const { task, receipt } = await api.createTask("Keep me", requestContext(ownerActor(), { correlationId: "r1" }));
    const edit = requestContext(ownerActor(), { receipt, correlationId: "r2" });
    await api.setStatus("in_progress", edit);
    await api.setPriority("urgent", edit);
    await testEnv.SOUP.prepare("DELETE FROM entity_row").run();
    await testEnv.SOUP.prepare("DELETE FROM entity_access_index").run();
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    await evictDurableObject(stub);
    await api.rebuildProjection(ownerActor());
    expect((await api.listVisible(ownerActor()))[0]).toMatchObject({
      entityId: task.id,
      title: "Keep me",
      status: "in_progress",
      priority: "urgent",
      version: 3,
    });
  });

  it("re-projects D1 when the outbox queue consumer drains the DO", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const { receipt } = await api.createTask("Queued", requestContext(ownerActor(), { correlationId: "q1" }));
    await testEnv.SOUP.prepare("DELETE FROM entity_row").run();
    const acked: string[] = [];
    const retried: string[] = [];
    await handleTaskOutboxBatch(
      {
        messages: [
          {
            body: { tenantId: tenant },
            ack: () => {
              acked.push(tenant);
            },
            retry: () => {
              retried.push(tenant);
            },
          },
        ],
      },
      testEnv,
    );
    expect(acked).toEqual([tenant]);
    expect(retried).toEqual([]);
    expect((await api.listTasks([receipt]))[0]?.title).toBe("Queued");
    expect(await api.drainOutbox()).toEqual({ pending: 0 });
  });

  it("retries rather than ACKing transient queue failures", async () => {
    const acked: string[] = [];
    const retried: string[] = [];
    await handleTaskOutboxBatch(
      {
        messages: [{
          body: { tenantId: tenant },
          ack: () => acked.push(tenant),
          retry: () => retried.push(tenant),
        }],
      },
      {
        TASK_SLICE: {
          idFromName: (name) => ({ toString: () => name }),
          get: () => ({
            drainOutbox: async () => {
              throw new Error("D1 unavailable");
            },
          }),
        },
      },
    );
    expect(acked).toEqual([]);
    expect(retried).toEqual([tenant]);
  });

  it("recovers projected task properties by alarm after queue send fails", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    await stub.failNextOutboxSend();
    const failedCreate = api.createTask(
      "Alarm recovery",
      requestContext(ownerActor(), {
        correlationId: "alarm-create",
        idempotencyKey: "alarm-create",
      }),
    ).then(
      () => "created",
      (error: Error) => error.message,
    );
    expect(await failedCreate).toMatch(/TASK_OUTBOX/);
    const entityId = fixtureId("document", 1);
    const minted = await stub.mintView(ownerActor(), entityId, "edit");
    expect(minted.ok).toBe(true);
    if (!minted.ok) throw new Error("expected edit receipt");

    await stub.failNextOutboxSend();
    const failedStatus = api.setStatus(
      "in_progress",
      requestContext(ownerActor(), {
        receipt: minted.receipt,
        correlationId: "alarm-status",
        idempotencyKey: "alarm-status",
      }),
    ).then(
      () => "updated",
      (error: Error) => error.message,
    );
    expect(await failedStatus).toMatch(/TASK_OUTBOX/);
    await stub.failNextOutboxSend();

    const failedPriority = api.setPriority(
      "high",
      requestContext(ownerActor(), {
        receipt: minted.receipt,
        correlationId: "alarm-priority",
        idempotencyKey: "alarm-priority",
      }),
    ).then(
      () => "created",
      (error: Error) => error.message,
    );
    expect(await failedPriority).toMatch(/TASK_OUTBOX/);

    expect((await stub.get(entityId, ownerActor()))?.priority).toBe("high");

    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect((await api.listVisible(ownerActor()))[0]).toMatchObject({
      title: "Alarm recovery",
      status: "in_progress",
      priority: "high",
      version: 3,
    });
    await runInDurableObject(stub, (instance) => instance.alarm());
    const row = await testEnv.SOUP.prepare(
      `SELECT title, status, priority, version FROM entity_row
       WHERE tenant_id = ? AND entity_id = ?`,
    ).bind(tenant, entityId).first<{
      title: string;
      status: string;
      priority: string;
      version: number;
    }>();
    expect(row).toEqual({
      title: "Alarm recovery",
      status: "in_progress",
      priority: "high",
      version: 3,
    });
  });

  it("keeps the previous complete D1 generation on mid-projection failure", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    const { task, receipt } = await api.createTask(
      "Complete generation",
      requestContext(ownerActor(), { correlationId: "atomic-create" }),
    );
    await stub.failProjectionUntilAlarm();
    const failed = api.updateTitle(
      "Partial generation",
      requestContext(ownerActor(), {
        receipt,
        correlationId: "atomic-update",
        idempotencyKey: "atomic-update",
      }),
    ).then(
      () => "updated",
      (error: Error) => error.message,
    );
    expect(await failed).toMatch(/projection_failure_injection/);

    const before = await testEnv.SOUP.prepare(
      `SELECT title, version FROM entity_row WHERE tenant_id = ? AND entity_id = ?`,
    ).bind(tenant, task.id).first<{ title: string; version: number }>();
    expect(before).toEqual({ title: "Complete generation", version: 1 });
    const ownerAccess = await testEnv.SOUP.prepare(
      `SELECT level FROM entity_access_index
       WHERE tenant_id = ? AND actor_id = ? AND entity_id = ?`,
    ).bind(tenant, ownerId, task.id).first<{ level: string }>();
    expect(ownerAccess?.level).toBe("owner");

    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const after = await testEnv.SOUP.prepare(
      `SELECT title, version FROM entity_row WHERE tenant_id = ? AND entity_id = ?`,
    ).bind(tenant, task.id).first<{ title: string; version: number }>();
    expect(after).toEqual({ title: "Partial generation", version: 2 });
  });

  it.each(["marker", "alarm", "close", "authority", "enqueue", "project"] as const)(
    "recovers a fail-closed access transition across eviction at the %s boundary",
    async (boundary) => {
      resetIdSequence();
      const index = ["marker", "alarm", "close", "authority", "enqueue", "project"].indexOf(boundary) + 20;
      const scopedTenant = fixtureId("team", index);
      const scopedOwner = fixtureId("user", index * 2);
      const scopedViewer = fixtureId("user", index * 2 + 1);
      const owner = actorContext(userPrincipal(scopedOwner, scopedTenant));
      const viewer = actorContext(userPrincipal(scopedViewer, scopedTenant));
      const api = new DurableTaskApi(testEnv.TASK_SLICE, scopedTenant);
      const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(scopedTenant));
      const { task } = await api.createTask(
        `Boundary ${boundary}`,
        requestContext(owner, { correlationId: `${boundary}-create` }),
      );
      expect(
        (await stub.shareState(
          task.id,
          grantShare(emptyAccess(scopedOwner, scopedTenant), scopedViewer, "comment"),
          owner,
        )).ok,
      ).toBe(true);
      expect(await api.listVisible(viewer)).toHaveLength(1);
      await api.drainOutbox();

      if (boundary === "enqueue") await stub.failNextOutboxSend();
      else if (boundary === "project") await stub.failProjectionUntilAlarm();
      else await stub.failNextTransitionBoundary(boundary);
      const result = await stub.shareState(
        task.id,
        emptyAccess(scopedOwner, scopedTenant),
        owner,
      );
      expect(result.ok).toBe(false);

      const authorityBeforeRestart = await stub.get(task.id, viewer);
      const visibleBeforeRestart = await api.listVisible(viewer);
      if (authorityBeforeRestart === null) expect(visibleBeforeRestart).toEqual([]);
      if (boundary === "marker") {
        expect(authorityBeforeRestart).not.toBeNull();
        expect(visibleBeforeRestart).toHaveLength(1);
      }

      await evictDurableObject(stub);
      await runInDurableObject(stub, (instance) => instance.alarm());
      const raw = await testEnv.SOUP.prepare(
        `SELECT level FROM entity_access_index
         WHERE tenant_id = ? AND actor_id = ? AND entity_id = ?`,
      ).bind(scopedTenant, scopedViewer, task.id).first<{ level: string }>();
      if (boundary === "marker") {
        expect(await stub.get(task.id, viewer)).not.toBeNull();
        expect(await api.listVisible(viewer)).toHaveLength(1);
        expect(raw?.level).toBe("comment");
      } else {
        expect(await stub.get(task.id, viewer)).toBeNull();
        expect(await api.listVisible(viewer)).toEqual([]);
        expect(raw).toBeNull();
      }
      const ownerRow = await testEnv.SOUP.prepare(
        `SELECT level FROM entity_access_index
         WHERE tenant_id = ? AND actor_id = ? AND entity_id = ?`,
      ).bind(scopedTenant, scopedOwner, task.id).first<{ level: string }>();
      expect(ownerRow?.level).toBe("owner");
    },
  );

  it("keeps a newer mutation when it arrives while alarm recovery is pending", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    await stub.failNextOutboxSend();
    const failedCreate = api.createTask(
      "First snapshot",
      requestContext(ownerActor(), {
        correlationId: "pending-create",
        idempotencyKey: "pending-create",
      }),
    ).then(
      () => "created",
      (error: Error) => error.message,
    );
    expect(await failedCreate).toMatch(/TASK_OUTBOX/);

    const entityId = fixtureId("document", 1);
    const minted = await stub.mintView(ownerActor(), entityId, "edit");
    expect(minted.ok).toBe(true);
    if (!minted.ok) throw new Error("expected edit receipt");
    const updated = await api.updateTitle(
      "Newest snapshot",
      requestContext(ownerActor(), {
        receipt: minted.receipt,
        correlationId: "newer-edit",
        idempotencyKey: "newer-edit",
      }),
    );
    expect(updated.version).toBe(2);

    await runInDurableObject(stub, (instance) => instance.alarm());
    await runInDurableObject(stub, (instance) => instance.alarm());
    expect((await api.listTasks([minted.receipt]))[0]?.title).toBe("Newest snapshot");
    expect((await stub.get(entityId, ownerActor()))?.version).toBe(2);
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
    const edit = requestContext(ownerActor(), {
      receipt: first.receipt,
      idempotencyKey: "edit-once",
      correlationId: "edit-once",
    });
    expect((await api.setStatus("in_progress", edit)).version).toBe(2);
    await evictDurableObject(stub);
    expect((await api.setStatus("in_progress", edit)).version).toBe(2);
    expect((await stub.get(first.task.id, ownerActor()))?.version).toBe(2);
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
    await api.drainOutbox();
    expect(await api.listVisible(teammateActor())).toHaveLength(1);
    await testEnv.SOUP.prepare("DELETE FROM entity_access_index").run();
    await evictDurableObject(stub);
    await api.rebuildProjection(ownerActor());
    expect(await api.listVisible(teammateActor())).toHaveLength(1);
    const rebuiltAccess = await testEnv.SOUP.prepare(
      `SELECT level FROM entity_access_index
       WHERE tenant_id = ? AND actor_id = ? AND entity_id = ?`,
    ).bind(tenant, teammateId, task.id).first<{ level: string }>();
    expect(rebuiltAccess?.level).toBe("comment");
    await stub.shareState(task.id, emptyAccess(ownerId, tenant), ownerActor());
    const denied = await stub.mintView(actorContext(userPrincipal(teammateId, tenant)), task.id, "view");
    expect(denied.ok).toBe(false);
    if (denied.ok) throw new Error("expected deny");
    expect(denied.message).toMatch(/lacks view/);
    await evictDurableObject(stub);
    expect(await api.listVisible(teammateActor())).toHaveLength(0);
    const projected = await testEnv.SOUP.prepare(
      `SELECT COUNT(*) AS count FROM entity_access_index
       WHERE tenant_id = ? AND actor_id = ? AND entity_id = ?`,
    ).bind(tenant, teammateId, task.id).first<{ count: number }>();
    expect(projected?.count).toBe(0);
    expect(await api.listTasks([receipt])).toHaveLength(1);
  });

  it("projects exact owner/share levels and denies membership-only document access", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    const { task } = await api.createTask(
      "Policy rows",
      requestContext(ownerActor(), { correlationId: "policy-create" }),
    );
    const membersOnly = withMembers(emptyAccess(ownerId, tenant), [ownerId, teammateId]);
    expect((await stub.shareState(task.id, membersOnly, ownerActor())).ok).toBe(true);
    const memberRow = await testEnv.SOUP.prepare(
      `SELECT level FROM entity_access_index
       WHERE tenant_id = ? AND actor_id = ? AND entity_id = ?`,
    ).bind(tenant, teammateId, task.id).first<{ level: string }>();
    expect(memberRow).toBeNull();
    expect(await api.listVisible(teammateActor())).toEqual([]);

    const shared = grantShare(membersOnly, teammateId, "comment");
    expect((await stub.shareState(task.id, shared, ownerActor())).ok).toBe(true);
    const { results } = await testEnv.SOUP.prepare(
      `SELECT actor_id, level FROM entity_access_index
       WHERE tenant_id = ? AND entity_id = ? ORDER BY actor_id`,
    ).bind(tenant, task.id).all<{ actor_id: string; level: string }>();
    expect(results).toEqual([
      { actor_id: ownerId, level: "owner" },
      { actor_id: teammateId, level: "comment" },
    ]);
  });

  it("keeps colliding tenant/actor/entity ids isolated in rows and access PKs", async () => {
    resetIdSequence();
    const apiA = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const first = await apiA.createTask(
      "Tenant A",
      requestContext(ownerActor(), { correlationId: "collision-a" }),
    );
    resetIdSequence();
    const sameOwnerB = actorContext(userPrincipal(ownerId, tenantB));
    const apiB = new DurableTaskApi(testEnv.TASK_SLICE, tenantB);
    const second = await apiB.createTask(
      "Tenant B",
      requestContext(sameOwnerB, { correlationId: "collision-b" }),
    );
    expect(second.task.id).toBe(first.task.id);
    expect((await apiA.listVisible(ownerActor())).map((item) => item.title)).toEqual(["Tenant A"]);
    expect((await apiB.listVisible(sameOwnerB)).map((item) => item.title)).toEqual(["Tenant B"]);
    const { results: rows } = await testEnv.SOUP.prepare(
      `SELECT tenant_id, title FROM entity_row
       WHERE entity_id = ? ORDER BY tenant_id`,
    ).bind(first.task.id).all<{ tenant_id: string; title: string }>();
    expect(rows).toEqual([
      { tenant_id: tenant, title: "Tenant A" },
      { tenant_id: tenantB, title: "Tenant B" },
    ]);
    const { results: access } = await testEnv.SOUP.prepare(
      `SELECT tenant_id, actor_id, entity_id FROM entity_access_index
       WHERE actor_id = ? AND entity_id = ? ORDER BY tenant_id`,
    ).bind(ownerId, first.task.id).all<{
      tenant_id: string;
      actor_id: string;
      entity_id: string;
    }>();
    expect(access).toEqual([
      { tenant_id: tenant, actor_id: ownerId, entity_id: first.task.id },
      { tenant_id: tenantB, actor_id: ownerId, entity_id: first.task.id },
    ]);
  });

  it("projects assignee edit access and fail-closes replacement and removal", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    const { task, receipt } = await api.createTask(
      "Assign me",
      requestContext(ownerActor(), { correlationId: "assign-create" }),
    );
    await api.setAssignee(
      teammateId,
      requestContext(ownerActor(), {
        receipt,
        correlationId: "assign-add",
        idempotencyKey: "assign-add",
      }),
    );
    const assigned = await testEnv.SOUP.prepare(
      `SELECT level FROM entity_access_index
       WHERE tenant_id = ? AND actor_id = ? AND entity_id = ?`,
    ).bind(tenant, teammateId, task.id).first<{ level: string }>();
    expect(assigned?.level).toBe("edit");
    expect(await api.listVisible(teammateActor())).toHaveLength(1);

    await stub.failNextOutboxSend();
    const replace = api.setAssignee(
      replacementId,
      requestContext(ownerActor(), {
        receipt,
        correlationId: "assign-replace",
        idempotencyKey: "assign-replace",
      }),
    ).then(
      () => "updated",
      (error: Error) => error.message,
    );
    expect(await replace).toMatch(/TASK_OUTBOX/);
    expect(await api.listVisible(teammateActor())).toEqual([]);
    const replacementActor = actorContext(userPrincipal(replacementId, tenant));
    await runInDurableObject(stub, (instance) => instance.alarm());
    const replacement = await testEnv.SOUP.prepare(
      `SELECT actor_id, level FROM entity_access_index
       WHERE tenant_id = ? AND entity_id = ? AND actor_id IN (?, ?) ORDER BY actor_id`,
    ).bind(tenant, task.id, teammateId, replacementId).all<{ actor_id: string; level: string }>();
    expect(replacement.results).toEqual([{ actor_id: replacementId, level: "edit" }]);

    await stub.failNextOutboxSend();
    const remove = api.setAssignee(
      "",
      requestContext(ownerActor(), {
        receipt,
        correlationId: "assign-remove",
        idempotencyKey: "assign-remove",
      }),
    ).then(
      () => "updated",
      (error: Error) => error.message,
    );
    expect(await remove).toMatch(/TASK_OUTBOX/);
    expect(await api.listVisible(replacementActor)).toEqual([]);
    const closed = await testEnv.SOUP.prepare(
      `SELECT COUNT(*) AS count FROM entity_access_index
       WHERE tenant_id = ? AND entity_id = ? AND actor_id = ?`,
    ).bind(tenant, task.id, replacementId).first<{ count: number }>();
    expect(closed?.count).toBe(0);
    await runInDurableObject(stub, (instance) => instance.alarm());
    const authority = await stub.get(task.id, ownerActor());
    expect(authority?.assigneeIds).toEqual([]);
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
    const sharedTicket = await api.createSubscribeTicket(teammateActor());
    const shared = await api.subscribe(0, sharedTicket.ticket);
    expect(shared.status).toBe(101);
    shared.webSocket?.accept();
    await stub.shareState(task.id, emptyAccess(ownerId, tenant), ownerActor());
    const revokedTicket = await api.createSubscribeTicket(teammateActor());
    const revoked = await api.subscribe(0, revokedTicket.ticket);
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

  it("closes revoke access before failed enqueue across every query and an existing socket", async () => {
    resetIdSequence();
    const api = new DurableTaskApi(testEnv.TASK_SLICE, tenant);
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(tenant));
    const { task } = await api.createTask(
      "Fail closed",
      requestContext(ownerActor(), { correlationId: "revoke-create" }),
    );
    const shared = grantShare(emptyAccess(ownerId, tenant), teammateId, "comment");
    expect((await stub.shareState(task.id, shared, ownerActor())).ok).toBe(true);
    const stale = await stub.mintView(teammateActor(), task.id, "view");
    expect(stale.ok).toBe(true);
    if (!stale.ok) throw new Error("expected shared receipt");
    expect(await stub.poisonPending(5)).toBe(1);
    expect(await api.listVisible(teammateActor())).toHaveLength(1);
    expect(await api.listActivity(teammateActor())).not.toHaveLength(0);
    expect(await api.listAlerts(teammateActor())).toHaveLength(1);

    const ticket = await api.createSubscribeTicket(teammateActor());
    const response = await api.subscribe(0, ticket.ticket);
    const ws = response.webSocket;
    if (!ws) throw new Error("expected websocket");
    const closed = new Promise<Array<{ item: { entityId: string; tombstoned: boolean } }>>((resolve) => {
      ws.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as {
          deltas?: Array<{ item: { entityId: string; tombstoned: boolean } }>;
        };
        if (message.deltas?.some((delta) => delta.item.entityId === task.id && delta.item.tombstoned)) {
          resolve(message.deltas);
        }
      });
    });
    ws.accept();

    await stub.failNextOutboxSend();
    const revoked = await stub.shareState(task.id, emptyAccess(ownerId, tenant), ownerActor());
    expect(revoked.ok).toBe(false);
    if (revoked.ok) throw new Error("expected injected enqueue failure");
    expect(revoked.message).toMatch(/TASK_OUTBOX/);
    expect(await Promise.race([
      closed,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("no revoke tombstone")), 1000)),
    ])).toEqual(expect.arrayContaining([
      expect.objectContaining({ item: expect.objectContaining({ entityId: task.id, tombstoned: true }) }),
    ]));

    expect(await api.listVisible(teammateActor())).toEqual([]);
    expect(await api.listTasks([stale.receipt])).toEqual([]);
    expect(await api.replayFrom(0, teammateActor())).toEqual([]);
    expect(await api.listActivity(teammateActor())).toEqual([]);
    expect(await api.listAlerts(teammateActor())).toEqual([]);
    const access = await testEnv.SOUP.prepare(
      `SELECT level FROM entity_access_index
       WHERE tenant_id = ? AND actor_id = ? AND entity_id = ?`,
    ).bind(tenant, teammateId, task.id).first<{ level: string }>();
    expect(access).toBeNull();
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await api.listVisible(teammateActor())).toEqual([]);
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
