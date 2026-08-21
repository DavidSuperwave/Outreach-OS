import { LIST_SCHEMA_DDL } from "./schemas.js";
import type { SoupItem, SoupItemType } from "./item.js";
import type { DocumentFacet } from "registry";

/** Minimal D1 surface used by the lists projector (OD-27 / ADR-006). */
export interface SoupD1 {
  prepare(query: string): SoupD1Statement;
  batch(statements: SoupD1Statement[]): Promise<unknown[]>;
}

export interface SoupD1Statement {
  bind(...values: unknown[]): SoupD1Statement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
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

interface TableColumn {
  name: string;
  pk: number;
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
    } catch (error) {
      // Frozen v1 DDL predates IF NOT EXISTS. Ignore only SQLite's precise
      // idempotent replay error; storage/SQL/permission failures propagate.
      if (!/\balready exists\b/i.test(String(error))) throw error;
    }
  }

  let entityColumns = await tableColumns(db, "entity_row");
  if (!primaryKeyIs(entityColumns, ["tenant_id", "entity_id"])) {
    await migrateEntityRowsV2(db, entityColumns);
    entityColumns = await tableColumns(db, "entity_row");
  }
  for (const [name, ddl] of Object.entries({
    status: "TEXT",
    priority: "TEXT",
    assignee_ids: "TEXT NOT NULL DEFAULT '[]'",
    tags: "TEXT NOT NULL DEFAULT '[]'",
  })) {
    if (!entityColumns.some((column) => column.name === name)) {
      await db.prepare(`ALTER TABLE entity_row ADD COLUMN ${name} ${ddl}`).bind().run();
    }
  }

  const accessColumns = await tableColumns(db, "entity_access_index");
  if (!primaryKeyIs(accessColumns, ["tenant_id", "actor_id", "entity_id"])) {
    await migrateAccessRowsV2(db, accessColumns);
  }
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS entity_access_actor ON entity_access_index (tenant_id, actor_id, entity_id)",
    )
    .bind()
    .run();
}

async function tableColumns(db: SoupD1, table: string): Promise<TableColumn[]> {
  const { results } = await db.prepare(`PRAGMA table_info(${table})`).bind().all<TableColumn>();
  return results;
}

function primaryKeyIs(columns: readonly TableColumn[], expected: readonly string[]): boolean {
  const actual = columns
    .filter((column) => column.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((column) => column.name);
  return actual.length === expected.length && actual.every((name, index) => name === expected[index]);
}

function selectColumn(columns: readonly TableColumn[], name: string, fallback: string): string {
  return columns.some((column) => column.name === name) ? name : `${fallback} AS ${name}`;
}

async function migrateEntityRowsV2(db: SoupD1, columns: readonly TableColumn[]): Promise<void> {
  const copyColumns = [
    "entity_id",
    "entity_type",
    "tenant_id",
    "title",
    "updated_at",
    "created_at",
    "version",
    "facet",
    "project_id",
    "body",
    "unread",
    "done",
    "tombstoned",
    "status",
    "priority",
    "assignee_ids",
    "tags",
  ];
  const select = [
    selectColumn(columns, "entity_id", "NULL"),
    selectColumn(columns, "entity_type", "NULL"),
    selectColumn(columns, "tenant_id", "NULL"),
    selectColumn(columns, "title", "NULL"),
    selectColumn(columns, "updated_at", "0"),
    selectColumn(columns, "created_at", "0"),
    selectColumn(columns, "version", "0"),
    selectColumn(columns, "facet", "NULL"),
    selectColumn(columns, "project_id", "NULL"),
    selectColumn(columns, "body", "''"),
    selectColumn(columns, "unread", "0"),
    selectColumn(columns, "done", "0"),
    selectColumn(columns, "tombstoned", "0"),
    selectColumn(columns, "status", "NULL"),
    selectColumn(columns, "priority", "NULL"),
    selectColumn(columns, "assignee_ids", "'[]'"),
    selectColumn(columns, "tags", "'[]'"),
  ];
  await db.batch([
    db.prepare("DROP TABLE IF EXISTS entity_row_v2").bind(),
    db.prepare(`CREATE TABLE entity_row_v2 (
      entity_id TEXT NOT NULL,
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
      tombstoned INTEGER NOT NULL DEFAULT 0,
      status TEXT,
      priority TEXT,
      assignee_ids TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (tenant_id, entity_id)
    )`).bind(),
    db.prepare(
      `INSERT INTO entity_row_v2 (${copyColumns.join(", ")})
       SELECT ${select.join(", ")} FROM entity_row`,
    ).bind(),
    db.prepare("DROP TABLE entity_row").bind(),
    db.prepare("ALTER TABLE entity_row_v2 RENAME TO entity_row").bind(),
    db.prepare(
      "CREATE INDEX entity_row_updated ON entity_row (tenant_id, updated_at DESC, entity_id)",
    ).bind(),
    db.prepare("CREATE INDEX entity_row_type ON entity_row (tenant_id, entity_type, facet)").bind(),
  ]);
}

async function migrateAccessRowsV2(db: SoupD1, columns: readonly TableColumn[]): Promise<void> {
  const tenant = columns.some((column) => column.name === "tenant_id")
    ? "COALESCE(NULLIF(a.tenant_id, ''), r.tenant_id)"
    : "r.tenant_id";
  const tenantJoin = columns.some((column) => column.name === "tenant_id")
    ? "AND (a.tenant_id = '' OR a.tenant_id = r.tenant_id)"
    : "";
  await db.batch([
    db.prepare("DROP TABLE IF EXISTS entity_access_index_v2").bind(),
    db.prepare(`CREATE TABLE entity_access_index_v2 (
      tenant_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      level TEXT NOT NULL,
      PRIMARY KEY (tenant_id, actor_id, entity_id)
    )`).bind(),
    db.prepare(
      `INSERT OR REPLACE INTO entity_access_index_v2
        (tenant_id, actor_id, entity_id, entity_type, level)
       SELECT ${tenant}, a.actor_id, a.entity_id, a.entity_type, a.level
       FROM entity_access_index AS a
       INNER JOIN entity_row AS r ON r.entity_id = a.entity_id ${tenantJoin}`,
    ).bind(),
    db.prepare("DROP TABLE entity_access_index").bind(),
    db.prepare("ALTER TABLE entity_access_index_v2 RENAME TO entity_access_index").bind(),
  ]);
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
  const statements = [
    db.prepare("DELETE FROM entity_access_index WHERE tenant_id = ?").bind(tenantId),
  ];
  for (const row of rows) {
    if (row.tenantId !== tenantId) {
      throw new Error(`refusing to project cross-tenant access ${row.entityId} into ${tenantId}`);
    }
    statements.push(
      db.prepare(
        `INSERT OR REPLACE INTO entity_access_index
          (tenant_id, actor_id, entity_id, entity_type, level)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(row.tenantId, row.actorId, row.entityId, row.entityType, row.level),
    );
  }
  await db.batch(statements);
}

export async function closeAccessProjectionRows(
  db: SoupD1,
  rows: readonly Pick<AccessProjectionRow, "tenantId" | "actorId" | "entityId">[],
): Promise<void> {
  if (rows.length === 0) return;
  await ensureListSchema(db);
  await db.batch(
    rows.map((row) =>
      db
        .prepare(
          `DELETE FROM entity_access_index
           WHERE tenant_id = ? AND actor_id = ? AND entity_id = ?`,
        )
        .bind(row.tenantId, row.actorId, row.entityId),
    ),
  );
}

export async function projectListSnapshot(
  db: SoupD1,
  items: readonly SoupItem[],
  tenantId?: string,
  accessRows: readonly AccessProjectionRow[] = [],
  options: { injectFailure?: boolean } = {},
): Promise<void> {
  await ensureListSchema(db);
  const scope = tenantId ?? items[0]?.tenantId;
  if (!scope) return;
  const batch = [
    db.prepare("DELETE FROM entity_access_index WHERE tenant_id = ?").bind(scope),
    db.prepare("DELETE FROM entity_row WHERE tenant_id = ? AND facet = ?").bind(scope, "task"),
  ];
  for (const item of items) {
    if (item.tenantId !== scope) {
      throw new Error(`refusing to project cross-tenant row ${item.entityId} into ${scope}`);
    }
    batch.push(entityRowStatement(db, item));
  }
  for (const row of accessRows) {
    if (row.tenantId !== scope) {
      throw new Error(`refusing to project cross-tenant access ${row.entityId} into ${scope}`);
    }
    batch.push(
      db
        .prepare(
          `INSERT OR REPLACE INTO entity_access_index
            (tenant_id, actor_id, entity_id, entity_type, level)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(row.tenantId, row.actorId, row.entityId, row.entityType, row.level),
    );
  }
  if (options.injectFailure) {
    batch.push(db.prepare("INSERT INTO projection_failure_injection (value) VALUES (1)").bind());
  }
  await db.batch(batch);
}

function entityRowStatement(db: SoupD1, item: SoupItem): SoupD1Statement {
  return db
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
    );
}
