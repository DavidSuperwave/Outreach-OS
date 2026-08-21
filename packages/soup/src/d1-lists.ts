import { LIST_SCHEMA_DDL, LIST_SCHEMA_MIGRATIONS } from "./schemas.js";
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
  status: string | null;
  priority: string | null;
  assignee_ids: string;
  tags: string;
}

export interface AccessProjectionRow {
  actorId: string;
  entityId: string;
  entityType: string;
  tenantId: string;
  level: string;
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
  for (const sql of LIST_SCHEMA_MIGRATIONS) {
    try {
      await db.prepare(sql).bind().run();
    } catch (error) {
      // SQLite reports duplicate-column errors when an additive migration was
      // already applied. Do not hide any other migration failure.
      if (!String(error).toLowerCase().includes("duplicate column name")) throw error;
    }
  }
}

export async function upsertEntityRow(db: SoupD1, item: SoupItem): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO entity_row (
        entity_id, entity_type, tenant_id, title, updated_at, created_at, version,
        facet, project_id, body, unread, done, tombstoned, status, priority,
        assignee_ids, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      item.status ?? null,
      item.priority ?? null,
      JSON.stringify(item.assigneeIds ?? []),
      JSON.stringify(item.tags ?? []),
    )
    .run();
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
    status: row.status,
    priority: row.priority,
    assigneeIds: parseStringArray(row.assignee_ids),
    tags: parseStringArray(row.tags),
  };
}

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

export async function queryFacetRows(
  db: SoupD1,
  tenantId: string,
  facet: string,
): Promise<SoupItem[]> {
  const { results } = await db
    .prepare(
      `SELECT entity_id, entity_type, tenant_id, title, updated_at, created_at, version,
              facet, project_id, body, unread, done, tombstoned, status, priority,
              assignee_ids, tags
       FROM entity_row
       WHERE tenant_id = ? AND facet = ? AND tombstoned = 0
       ORDER BY updated_at DESC, entity_id`,
    )
    .bind(tenantId, facet)
    .all<EntityRowRecord>();
  return results.map(rowToItem);
}

export async function queryVisibleFacetRows(
  db: SoupD1,
  tenantId: string,
  actorId: string,
  facet: string,
): Promise<SoupItem[]> {
  const { results } = await db
    .prepare(
      `SELECT r.entity_id, r.entity_type, r.tenant_id, r.title, r.updated_at,
              r.created_at, r.version, r.facet, r.project_id, r.body, r.unread,
              r.done, r.tombstoned, r.status, r.priority, r.assignee_ids, r.tags
       FROM entity_row AS r
       INNER JOIN entity_access_index AS a
         ON a.entity_id = r.entity_id AND a.tenant_id = r.tenant_id
       WHERE r.tenant_id = ? AND a.actor_id = ? AND r.facet = ?
         AND r.tombstoned = 0
       ORDER BY r.updated_at DESC, r.entity_id`,
    )
    .bind(tenantId, actorId, facet)
    .all<EntityRowRecord>();
  return results.map(rowToItem);
}

export async function queryVisibleEntityIds(
  db: SoupD1,
  tenantId: string,
  actorId: string,
): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT entity_id FROM entity_access_index
       WHERE tenant_id = ? AND actor_id = ?`,
    )
    .bind(tenantId, actorId)
    .all<{ entity_id: string }>();
  return results.map((row) => row.entity_id);
}

/** Tenant-scoped wipe. Never DELETE FROM entity_row with no WHERE (shared D1). */
export async function clearEntityRows(db: SoupD1, tenantId: string, facet = "task"): Promise<void> {
  if (!tenantId) throw new Error("clearEntityRows requires tenantId");
  await db.prepare("DELETE FROM entity_row WHERE tenant_id = ? AND facet = ?").bind(tenantId, facet).run();
}

export async function replaceAccessProjection(
  db: SoupD1,
  tenantId: string,
  rows: readonly AccessProjectionRow[],
): Promise<void> {
  if (!tenantId) throw new Error("replaceAccessProjection requires tenantId");
  // Clear first: a failed rebuild may hide rows temporarily but can never leak
  // a revoked entity.
  await db.prepare("DELETE FROM entity_access_index WHERE tenant_id = ?").bind(tenantId).run();
  for (const row of rows) {
    if (row.tenantId !== tenantId) {
      throw new Error(`refusing to project cross-tenant access ${row.entityId} into ${tenantId}`);
    }
    await db
      .prepare(
        `INSERT OR REPLACE INTO entity_access_index
          (actor_id, entity_id, entity_type, level, tenant_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(row.actorId, row.entityId, row.entityType, row.level, row.tenantId)
      .run();
  }
}

export async function projectListSnapshot(
  db: SoupD1,
  items: readonly SoupItem[],
  tenantId?: string,
  accessRows: readonly AccessProjectionRow[] = [],
): Promise<void> {
  await ensureListSchema(db);
  const scope = tenantId ?? items[0]?.tenantId;
  if (!scope) return;
  await replaceAccessProjection(db, scope, accessRows);
  await clearEntityRows(db, scope, "task");
  for (const item of items) {
    if (item.tenantId !== scope) {
      throw new Error(`refusing to project cross-tenant row ${item.entityId} into ${scope}`);
    }
    await upsertEntityRow(db, item);
  }
}
