import { CALENDAR_TABLES, dryRunIdentityMapping as mapCalendar } from "calendar";
import { COMMS_TABLES, dryRunIdentityMapping as mapChannels } from "channels";
import { CRM_TABLES, dryRunIdentityMapping as mapCrm } from "crm";
import { DOCUMENT_TABLES, dryRunIdentityMapping as mapDocuments } from "documents";
import { LEGACY_FILE_TABLES, dryRunIdentityMapping as mapFiles } from "files";
import { EMAIL_TABLES, dryRunIdentityMapping as mapMailbox } from "mailbox";
import { NOTIFICATION_TABLES, dryRunIdentityMapping as mapNotifications } from "notifications";
import { PROPERTY_TABLES, dryRunIdentityMapping as mapProperties } from "task-properties";

export interface MappingRow {
  domain: string;
  table: string;
  wrote: boolean;
}

/** OD-1 Branch A: every harvested table maps to a typed id and never writes. */
export function dryRunAllDomains(): MappingRow[] {
  const documents = mapDocuments(DOCUMENT_TABLES.map((table, index) => ({ table, pgId: index + 1 }))).map(
    (row) => ({ domain: "documents" as const, table: row.legacy.table, wrote: row.wrote }),
  );
  const channels = mapChannels(COMMS_TABLES.map((table, index) => ({ table, pgId: index + 1 }))).map((row) => ({
    domain: "channels" as const,
    table: row.legacy.table,
    wrote: row.wrote,
  }));
  const mailbox = mapMailbox(EMAIL_TABLES.map((table, index) => ({ table, pgId: index + 1 }))).map((row) => ({
    domain: "mailbox" as const,
    table: row.legacy.table,
    wrote: row.wrote,
  }));
  const crm = mapCrm(CRM_TABLES.map((table, index) => ({ table, pgId: index + 1 }))).map((row) => ({
    domain: "crm" as const,
    table: row.legacy.table,
    wrote: row.wrote,
  }));
  const calendar = mapCalendar(CALENDAR_TABLES.map((table, index) => ({ table, pgId: index + 1 }))).map((row) => ({
    domain: "calendar" as const,
    table: row.legacy.table,
    wrote: row.wrote,
  }));
  const files = mapFiles(
    LEGACY_FILE_TABLES.map((table, index) => ({ table, dynamoKey: `SF#${index + 1}`, n: index + 1 })),
  ).map((row) => ({ domain: "files" as const, table: row.legacy.table, wrote: row.wrote }));
  const notifications = mapNotifications(
    NOTIFICATION_TABLES.map((table, index) => ({ table, pgId: index + 1 })),
  ).map((row) => ({ domain: "notifications" as const, table: row.legacy.table, wrote: row.wrote }));
  const properties = mapProperties(PROPERTY_TABLES.map((table, index) => ({ table, pgId: index + 1 }))).map(
    (row) => ({ domain: "properties" as const, table: row.legacy.table, wrote: row.wrote }),
  );
  return [...documents, ...channels, ...mailbox, ...crm, ...calendar, ...files, ...notifications, ...properties];
}
