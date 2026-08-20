export { MailboxSlice, actorContext, requestContext, gmailHookPath } from "./slice.js";
export type { MailApi, MailThreadView, AccountView } from "./slice.js";
export { InMemoryGmailProvider } from "./gmail.js";
export { MailApprovalQueue } from "./approval.js";
export { SyncCheckpointStore } from "./sync.js";
export { dryRunIdentityMapping, mapLegacyEmailId, EMAIL_TABLES } from "./mapping.js";
export type { LegacyEmailRef, LegacyEmailTable, IdentityMappingResult, EmailMappingRole } from "./mapping.js";
export {
  MAILBOX_COMMAND_IDS,
  MAILBOX_COMMAND_FREEZE_COUNT,
  EMAIL_COMMAND_IDS,
  EMAIL_COMMAND_COUNT,
  THREAD_COMMAND_IDS,
  THREAD_COMMAND_COUNT,
  N11_PARITY_COMMAND_IDS,
  commandEnabled,
  defaultMailContext,
} from "./commands.js";
export type {
  MailboxCommandId,
  EmailCommandId,
  ThreadCommandId,
  N11ParityCommandId,
  MailCommandContext,
} from "./commands.js";
export { MailboxError } from "./errors.js";
export type {
  EmailAccount,
  MailboxRecord,
  EmailThreadRecord,
  EmailMessageRecord,
  MailboxSyncCheckpoint,
  GmailHistoryRecord,
  PubSubPush,
  ComposeInput,
  GmailSendResult,
  SendActionStatus,
  SendProposal,
  MailboxFlavor,
} from "./types.js";
export { MailComposePopover, InboxList, ThreadView, MailboxWorkspace } from "./ui.js";
