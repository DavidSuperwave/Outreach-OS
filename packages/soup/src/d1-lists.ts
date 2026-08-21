import { LIST_SCHEMA_DDL } from "./schemas.js";
import type { SoupItem, SoupItemType } from "./item.js";
import type { DocumentFacet } from "registry";

/** Minimal D1 surface used by the lists projector (OD-27 / ADR-006). */
export interface SoupD1 {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    };
  };
}

export interface EntityRowRecord {
  entity_id: string;
  entity_type: string;
  tenant_id: string;
  title: string;
  updated_at: number;
  created_at: number;
  version: number;
  facet: string | null;
  project_id: string | null;
  body: string;
  unread: number;
  done: number;
  tombstoned: number;
}

function statements(ddl: string): string[] {
  return ddl
    .split(";")
    .map((part) =>
      part
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

export async function ensureListSchema(db: SoupD1): Promise<void> {
  for (const sql of statements(LIST_SCHEMA_DDL)) {
    try {
      await db.prepare(sql).bind().run();
    } catch {
      // Idempotent apply: CREATE INDEX is not IF NOT EXISTS in the frozen DDL.
    }
  }
}

export async function upsertEntityRow(db: SoupD1, item: SoupItem): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO entity_row (
        entity_id, entity_type, tenant_id, title, updated_at, created_at, version,
        facet, project_id, body, unread, done, tombstoned
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      item.entityId,
      item.entityType,
      item.tenantId,
      item.title,
      item.updatedAt,
      item.createdAt,
      item.version,
      item.facet,
      item.projectId,
      item.body,
      item.unread ? 1 : 0,
      item.done ? 1 : 0,
      item.tombstoned ? 1 : 0,
    )
    .run();
}

export async function clearEntityRows(db: SoupD1): Promise<void> {
  await db.prepare("DELETE FROM entity_row").bind().run();
}

export function rowToItem(row: EntityRowRecord): SoupItem {
  return {
    entityType: row.entity_type as SoupItemType,
    entityId: row.entity_id,
    tenantId: row.tenant_id,
    title: row.title,
    body: row.body,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    version: row.version,
    facet: (row.facet as DocumentFacet | null) ?? null,
    projectId: row.project_id,
    unread: row.unread === 1,
    done: row.done === 1,
    tombstoned: row.tombstoned === 1,
  };
}

export async function queryFacetRows(
  db: SoupD1,
  tenantId: string,
  facet: string,
): Promise<SoupItem[]> {
  const { results } = await db
    .prepare(
      `SELECT entity_id, entity_type, tenant_id, title, updated_at, created_at, version,
              facet, project_id, body, unread, done, tombstoned
       FROM entity_row
       WHERE tenant_id = ? AND facet = ? AND tombstoned = 0
       ORDER BY updated_at DESC, entity_id`,
    )
    .bind(tenantId, facet)
    .all<EntityRowRecord>();
  return results.map(rowToItem);
}

export async function projectListSnapshot(db: SoupD1, items: readonly SoupItem[]): Promise<void> {
  await ensureListSchema(db);
  await clearEntityRows(db);
  for (const item of items) await upsertEntityRow(db, item);
}
