import { describe, expect, it } from "vitest";
import { fixtureId } from "registry";
import { ensureListSchema, projectListSnapshot, queryFacetRows, type SoupD1 } from "./d1-lists.js";
import type { SoupItem } from "./item.js";

class MemoryD1 implements SoupD1 {
  #rows = new Map<string, Record<string, unknown>>();
  #ready = false;

  prepare(query: string) {
    const sql = query.trim();
    return {
      bind: (...values: unknown[]) => ({
        run: async () => {
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
          if (sql.startsWith("INSERT OR REPLACE")) {
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
            ] = values;
            this.#rows.set(String(entity_id), {
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
            });
          }
        },
        all: async <T>() => {
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
}

describe("D1 lists projector (OD-27)", () => {
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
    };
    await projectListSnapshot(db, [item]);
    const listed = await queryFacetRows(db, item.tenantId, "task");
    expect(listed).toEqual([item]);
    const other: SoupItem = { ...item, entityId: fixtureId("document", 2), tenantId: fixtureId("team", 2), title: "Other" };
    await projectListSnapshot(db, [other]);
    expect(await queryFacetRows(db, item.tenantId, "task")).toEqual([item]);
    expect(await queryFacetRows(db, other.tenantId, "task")).toEqual([other]);
  });
});
