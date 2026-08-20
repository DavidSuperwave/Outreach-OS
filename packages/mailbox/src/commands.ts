/**
 * N11 command freeze is 34 rows (05-GRAPH §N11): email 25 + thread 9.
 * `email.reply-all-opt` (opt+r) stays dormant unless the owner rules otherwise (OD-23).
 */
export const MAILBOX_COMMAND_FREEZE_COUNT = 34;
export const EMAIL_COMMAND_COUNT = 25;
export const THREAD_COMMAND_COUNT = 9;

/** Full 25-row `email.*` freeze, harvested from CMD-L. */
export const EMAIL_COMMAND_IDS = [
  "email.reply-all-opt",
  "email.reply",
  "email.forward",
  "email.mark-done",
  "email.mark-not-done",
  "email.mark-unread",
  "email.mark-read",
  "email.block-sender",
  "email.mark-sender-signal",
  "email.mark-sender-noise",
  "email.previous-message",
  "email.next-message",
  "email.focus-reply",
  "email.collapse-message",
  "email.send",
  "email.send-mark-done",
  "email.compose-arrowup-to-thread",
  "email.close-reply",
  "email.toggle-side-panel",
  "email.compose.edit-to",
  "email.compose.edit-cc",
  "email.compose.edit-bcc",
  "email.compose.edit-subject",
  "email.compose.edit-message",
  "email.compose.send",
] as const;

export type EmailCommandId = (typeof EMAIL_COMMAND_IDS)[number];

/** Full 9-row `thread.*` freeze (email threads, not channel threads). */
export const THREAD_COMMAND_IDS = [
  "thread.enter",
  "thread.previous-reply",
  "thread.next-reply",
  "thread.collapse",
  "thread.exit",
  "thread.reply",
  "thread.edit-reply",
  "thread.delete-reply",
  "thread.cancel-reply",
] as const;

export type ThreadCommandId = (typeof THREAD_COMMAND_IDS)[number];

export const MAILBOX_COMMAND_IDS = [...EMAIL_COMMAND_IDS, ...THREAD_COMMAND_IDS] as const;

export type MailboxCommandId = (typeof MAILBOX_COMMAND_IDS)[number];

/**
 * Surface identities exercised end-to-end by N11 (05-MAP row 8 + chrome).
 * `email.*` / `thread.*` live here; create-menu / go-to / launcher chrome lives on N5.
 */
export const N11_PARITY_COMMAND_IDS = [
  "create-menu.email",
  "launcher.email",
  "go-to.mail",
  "go-to.inbox",
  "email.send",
  "email.reply",
  "thread.enter",
  "thread.reply",
] as const;

export type N11ParityCommandId = (typeof N11_PARITY_COMMAND_IDS)[number];

export interface MailCommandContext {
  signedIn: boolean;
  composeOpen: boolean;
  threadFocused: boolean;
}

/**
 * Enablement freeze. `email.reply-all-opt` (opt+r) is dormant — Email.tsx never
 * registered it; `r` is wired to reply-all instead (OD-23 bundle).
 */
export function commandEnabled(id: MailboxCommandId, ctx: MailCommandContext): boolean {
  if (id === "email.reply-all-opt") return false;
  if (!ctx.signedIn) return false;
  if (id.startsWith("email.compose.")) return ctx.composeOpen;
  if (id.startsWith("thread.")) return ctx.threadFocused;
  return true;
}

export function defaultMailContext(overrides: Partial<MailCommandContext> = {}): MailCommandContext {
  return {
    signedIn: true,
    composeOpen: false,
    threadFocused: true,
    ...overrides,
  };
}
