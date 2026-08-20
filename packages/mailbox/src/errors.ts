export class MailboxError extends Error {
  constructor(
    readonly code:
      | "denied"
      | "missing_receipt"
      | "unknown_thread"
      | "unknown_account"
      | "unknown_action"
      | "not_approved"
      | "smtp_forbidden"
      | "instantly_forbidden"
      | "live_gmail_forbidden",
    message: string,
  ) {
    super(message);
    this.name = "MailboxError";
  }
}
