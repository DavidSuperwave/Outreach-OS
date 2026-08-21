// Browser-safe exports for UI fixtures
export { MailComposePopover, InboxList, ThreadView, MailboxWorkspace } from "./ui.js";
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
export type { MailboxCommandId, EmailCommandId, ThreadCommandId, N11ParityCommandId, MailCommandContext } from "./commands.js";
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
