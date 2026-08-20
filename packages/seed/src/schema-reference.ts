import { CALENDAR_TABLES } from "calendar";
import { COMMS_TABLES } from "channels";
import { CRM_TABLES } from "crm";
import { DOCUMENT_TABLES } from "documents";
import { LEGACY_FILE_TABLES } from "files";
import { EMAIL_TABLES } from "mailbox";
import { NOTIFICATION_TABLES } from "notifications";
import { PROPERTY_TABLES } from "task-properties";

/**
 * Corrected mechanical live-table count from 01-plan-gap-review I2
 * (202 CREATE − 8 created-then-dropped). Frozen design-reference gate for N20.
 * This wrapper does not invent the remaining unmapped names.
 */
export const SCHEMA_REFERENCE_LIVE_TABLE_COUNT = 194;

/** 23 live `email_*` tables (01 §2.9 I3). Dropped email_* tables are not mapped. */
export const EMAIL_LIVE_TABLE_COUNT = 23;

/**
 * Created-then-dropped in forward migrations (I2). Not live; not identity-mapped.
 */
export const SCHEMA_REFERENCE_DROPPED_TABLES = [
  "Macrotation",
  "UserItemAccess",
  "document_task",
  "email_attachments_macro",
  "email_backfill_messages",
  "email_backfill_threads",
  "email_contact_search_index",
  "github_app_installation_team",
] as const;

/** DynamoDB / S3 shapes reconstructed in N14 — not Postgres live tables. */
export const NON_POSTGRES_HARVEST = ["static_files", "s3_objects"] as const;

export const HARVESTED_SCHEMA_FAMILIES = {
  documents: DOCUMENT_TABLES,
  channels: COMMS_TABLES,
  mailbox: EMAIL_TABLES,
  crm: CRM_TABLES,
  calendar: CALENDAR_TABLES,
  files: LEGACY_FILE_TABLES,
  notifications: NOTIFICATION_TABLES,
  properties: PROPERTY_TABLES,
} as const;

export type HarvestedSchemaFamily = keyof typeof HARVESTED_SCHEMA_FAMILIES;

export function harvestedTableNames(): string[] {
  const names = new Set<string>();
  for (const tables of Object.values(HARVESTED_SCHEMA_FAMILIES)) {
    for (const name of tables) names.add(name);
  }
  return [...names].sort();
}

export function harvestedPostgresTables(): string[] {
  const skip = new Set<string>(NON_POSTGRES_HARVEST);
  return harvestedTableNames().filter((name) => !skip.has(name));
}

/** Live tables named in 01 I2 but not yet listed per-domain in this wrapper. */
export function unmappedLiveTableRemainder(): number {
  return SCHEMA_REFERENCE_LIVE_TABLE_COUNT - harvestedPostgresTables().length;
}
