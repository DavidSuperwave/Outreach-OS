export type MailboxFlavor = "personal" | "shared";

export interface EmailAccount {
  id: string;
  tenantId: string;
  ownerId: string;
  email: string;
  provider: "gmail";
  createdAt: number;
}

export interface MailboxRecord {
  id: string;
  accountId: string;
  tenantId: string;
  flavor: MailboxFlavor;
  address: string;
}

export interface EmailThreadRecord {
  id: string;
  tenantId: string;
  accountId: string;
  mailboxId: string;
  gmailThreadId: string;
  subject: string;
  snippet: string;
  unread: boolean;
  done: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface EmailMessageRecord {
  id: string;
  threadId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  historyId: string;
  from: string;
  to: readonly string[];
  cc: readonly string[];
  subject: string;
  body: string;
  direction: "inbound" | "outbound";
  createdAt: number;
}

export interface MailboxSyncCheckpoint {
  accountId: string;
  historyId: string;
  updatedAt: number;
}

export interface GmailHistoryRecord {
  gmailMessageId: string;
  gmailThreadId: string;
  historyId: string;
  from: string;
  to: readonly string[];
  subject: string;
  body: string;
}

export interface PubSubPush {
  accountId: string;
  historyId: string;
  records: readonly GmailHistoryRecord[];
}

export interface ComposeInput {
  accountId: string;
  threadId?: string | null;
  to: readonly string[];
  cc?: readonly string[];
  bcc?: readonly string[];
  subject: string;
  body: string;
}

export interface GmailSendResult {
  gmailMessageId: string;
  gmailThreadId: string;
  historyId: string;
}

export type SendActionStatus = "pending" | "approved" | "rejected" | "applied";

export interface SendProposal {
  actionId: number;
  description: string;
  status: SendActionStatus;
  input: ComposeInput;
  result: GmailSendResult | null;
}
