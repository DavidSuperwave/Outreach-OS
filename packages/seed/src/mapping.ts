import { dryRunIdentityMapping as mapCalendar } from "calendar";
import { dryRunIdentityMapping as mapChannels } from "channels";
import { dryRunIdentityMapping as mapCrm } from "crm";
import { dryRunIdentityMapping as mapDocuments } from "documents";
import { dryRunIdentityMapping as mapFiles } from "files";
import { dryRunIdentityMapping as mapMailbox } from "mailbox";
import { dryRunIdentityMapping as mapNotifications } from "notifications";

export interface MappingRow {
  domain: string;
  wrote: boolean;
}

/** OD-1 Branch A: every harvested table maps to a typed id and never writes. */
export function dryRunAllDomains(): MappingRow[] {
  const documents = mapDocuments([
    { table: "documents", pgId: 1 },
    { table: "projects", pgId: 1 },
  ]).map((row) => ({ domain: "documents" as const, wrote: row.wrote }));
  const channels = mapChannels([{ table: "comms_channels", pgId: 1 }]).map((row) => ({
    domain: "channels" as const,
    wrote: row.wrote,
  }));
  const mailbox = mapMailbox([{ table: "email_threads", pgId: 1 }]).map((row) => ({
    domain: "mailbox" as const,
    wrote: row.wrote,
  }));
  const crm = mapCrm([{ table: "crm_companies", pgId: 1 }]).map((row) => ({
    domain: "crm" as const,
    wrote: row.wrote,
  }));
  const calendar = mapCalendar([{ table: "calendar_events", pgId: 1 }]).map((row) => ({
    domain: "calendar" as const,
    wrote: row.wrote,
  }));
  const files = mapFiles([{ table: "static_files", dynamoKey: "SF#1", n: 1 }]).map((row) => ({
    domain: "files" as const,
    wrote: row.wrote,
  }));
  const notifications = mapNotifications([{ table: "notification", pgId: 1 }]).map((row) => ({
    domain: "notifications" as const,
    wrote: row.wrote,
  }));
  return [...documents, ...channels, ...mailbox, ...crm, ...calendar, ...files, ...notifications];
}
