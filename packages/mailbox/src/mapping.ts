import { fixtureId } from "registry";

/**
 * OD-1 Branch A migration fixture: identity-mapping dry run for 23 live `email_*`
 * tables (corrected count, 01 §2.9 I3). Never writes authorities. Dropped tables
 * (`email_attachments_macro`, `email_backfill_messages`, `email_backfill_threads`,
 * `email_contact_search_index`) are not mapped.
 */
export const EMAIL_TABLES = [
  "email_accounts",
  "email_mailboxes",
  "email_threads",
  "email_messages",
  "email_message_payloads",
  "email_attachments",
  "email_links",
  "email_labels",
  "email_thread_labels",
  "email_drafts",
  "email_scheduled_sends",
  "email_send_queue",
  "email_undo",
  "email_suppression",
  "email_delegates",
  "email_sync_state",
  "email_history_cursors",
  "email_watches",
  "email_signatures",
  "email_filters",
  "email_shared_inboxes",
  "email_contacts",
  "email_account_grants",
] as const;

export type LegacyEmailTable = (typeof EMAIL_TABLES)[number];

export interface LegacyEmailRef {
  table: LegacyEmailTable;
  pgId: number;
}

export type EmailMappingRole =
  | "account"
  | "mailbox"
  | "thread"
  | "message"
  | "payload"
  | "attachment"
  | "link"
  | "label"
  | "thread_label"
  | "draft"
  | "scheduled_send"
  | "send_queue"
  | "undo"
  | "suppression"
  | "delegate"
  | "sync_state"
  | "history_cursor"
  | "watch"
  | "signature"
  | "filter"
  | "shared_inbox"
  | "contact"
  | "account_grant";

export interface IdentityMappingResult {
  legacy: LegacyEmailRef;
  mappedId: string;
  entityType: "email_thread";
  role: EmailMappingRole;
  wrote: false;
}

const TABLE_ROLE: Record<LegacyEmailTable, EmailMappingRole> = {
  email_accounts: "account",
  email_mailboxes: "mailbox",
  email_threads: "thread",
  email_messages: "message",
  email_message_payloads: "payload",
  email_attachments: "attachment",
  email_links: "link",
  email_labels: "label",
  email_thread_labels: "thread_label",
  email_drafts: "draft",
  email_scheduled_sends: "scheduled_send",
  email_send_queue: "send_queue",
  email_undo: "undo",
  email_suppression: "suppression",
  email_delegates: "delegate",
  email_sync_state: "sync_state",
  email_history_cursors: "history_cursor",
  email_watches: "watch",
  email_signatures: "signature",
  email_filters: "filter",
  email_shared_inboxes: "shared_inbox",
  email_contacts: "contact",
  email_account_grants: "account_grant",
};

export function mapLegacyEmailId(ref: LegacyEmailRef): IdentityMappingResult {
  return {
    legacy: ref,
    mappedId: fixtureId("email_thread", ref.pgId),
    entityType: "email_thread",
    role: TABLE_ROLE[ref.table],
    wrote: false,
  };
}

export function dryRunIdentityMapping(refs: readonly LegacyEmailRef[]): IdentityMappingResult[] {
  return refs.map(mapLegacyEmailId);
}
