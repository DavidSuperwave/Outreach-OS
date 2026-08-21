import { describe, expect, it } from "vitest";
import { fixtureId } from "registry";
import { ensureListSchema, projectListSnapshot, queryFacetRows, type SoupD1 } from "./d1-lists.js";
import type { SoupItem } from "./item.js";

class MemoryD1 implements SoupD1 {
  #rows = new Map<string, Record<string, unknown>>();
  #ready = false;

  prepare(query: string): any {
    const sql = query.trim();
    return {
      bind: (...values: unknown[]) => ({
        run: async () => {
          if (sql.includes("projection_failure_injection")) {
            throw new Error("injected batch failure");
          }
          if (sql.startsWith("CREATE")) {
            this.#ready = true;
            return;
          }
          if (sql.startsWith("DELETE FROM entity_row")) {
            if (values.length === 0) throw new Error("unscoped delete");
            const tenantId = values[0];
            const facet = values[1];
            const drop: string[] = [];
            for (const [id, row] of this.#rows) {
              const tenantOk = tenantId === undefined || row.tenant_id === tenantId;
              const facetOk = facet === undefined || row.facet === facet;
              if (tenantOk && facetOk) drop.push(id);
            }
            for (const id of drop) this.#rows.delete(id);
            return;
          }
          if (sql.startsWith("INSERT OR REPLACE INTO entity_row")) {
            const [
              entity_id,
              entity_type,
              tenant_id,
              title,
              updated_at,
              created_at,
              version,
              facet,
              project_id,
              body,
              unread,
              done,
              tombstoned,
              status,
              priority,
              assignee_ids,
              tags,
            ] = values;
            this.#rows.set(`${String(tenant_id)}:${String(entity_id)}`, {
              entity_id,
              entity_type,
              tenant_id,
              title,
              updated_at,
              created_at,
              version,
              facet,
              project_id,
              body,
              unread,
              done,
              tombstoned,
              status,
              priority,
              assignee_ids,
              tags,
            });
          }
        },
        all: async <T>() => {
          if (sql === "PRAGMA table_info(entity_row)") {
            return {
              results: [
                { name: "tenant_id", pk: 1 },
                { name: "entity_id", pk: 2 },
                { name: "status", pk: 0 },
                { name: "priority", pk: 0 },
                { name: "assignee_ids", pk: 0 },
                { name: "tags", pk: 0 },
              ] as T[],
            };
          }
          if (sql === "PRAGMA table_info(entity_access_index)") {
            return {
              results: [
                { name: "tenant_id", pk: 1 },
                { name: "actor_id", pk: 2 },
                { name: "entity_id", pk: 3 },
              ] as T[],
            };
          }
          const tenantId = values[0];
          const facet = values[1];
          const results = [...this.#rows.values()].filter(
            (row) => row.tenant_id === tenantId && row.facet === facet && row.tombstoned === 0,
          ) as T[];
          return { results };
        },
      }),
    };
  }

  async batch(statements: any[]): Promise<unknown[]> {
    const before = new Map(
      [...this.#rows.entries()].map(([key, row]) => [key, { ...row }]),
    );
    try {
      const results: unknown[] = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    } catch (error) {
      this.#rows = before;
      throw error;
    }
  }
}

describe("D1 lists projector (OD-27)", () => {
  it("propagates unrelated schema initialization failures", async () => {
    const db = {
      prepare: () => ({
        bind() {
          return this;
        },
        run: async () => {
          throw new Error("D1 storage unavailable");
        },
        all: async () => ({ results: [] }),
      }),
      batch: async () => [],
    } satisfies SoupD1;
    await expect(ensureListSchema(db)).rejects.toThrow("D1 storage unavailable");
  });

  it("applies list DDL and round-trips a task document row", async () => {
    const db = new MemoryD1();
    await ensureListSchema(db);
    const item: SoupItem = {
      entityType: "document",
      entityId: fixtureId("document", 1),
      tenantId: fixtureId("team", 1),
      title: "Ship",
      body: "Ship",
      updatedAt: 2,
      createdAt: 1,
      version: 1,
      facet: "task",
      projectId: null,
      unread: false,
      done: false,
      tombstoned: false,
      status: "todo",
      priority: "high",
      assigneeIds: [fixtureId("user", 1)],
      tags: ["acceptance"],
    };
    await projectListSnapshot(db, [item]);
    const listed = await queryFacetRows(db, item.tenantId, "task");
    expect(listed).toEqual([item]);
    const other: SoupItem = { ...item, entityId: fixtureId("document", 2), tenantId: fixtureId("team", 2), title: "Other" };
    await projectListSnapshot(db, [other]);
    expect(await queryFacetRows(db, item.tenantId, "task")).toEqual([item]);
    expect(await queryFacetRows(db, other.tenantId, "task")).toEqual([other]);
  });

  it("rolls back every MemoryD1 batch mutation on a mid-batch failure", async () => {
    const db = new MemoryD1();
    const item: SoupItem = {
      entityType: "document",
      entityId: fixtureId("document", 1),
      tenantId: fixtureId("team", 1),
      title: "Complete",
      body: "Complete",
      updatedAt: 1,
      createdAt: 1,
      version: 1,
      facet: "task",
      projectId: null,
      unread: false,
      done: false,
      tombstoned: false,
      status: "todo",
      priority: null,
      assigneeIds: [],
      tags: [],
    };
    await projectListSnapshot(db, [item]);
    await expect(
      projectListSnapshot(
        db,
        [{ ...item, title: "Partial", version: 2 }],
        item.tenantId,
        [],
        { injectFailure: true },
      ),
    ).rejects.toThrow("injected batch failure");
    expect(await queryFacetRows(db, item.tenantId, "task")).toEqual([item]);
  });
});
