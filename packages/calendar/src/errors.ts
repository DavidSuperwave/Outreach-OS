export class CalendarError extends Error {
  constructor(
    readonly code:
      | "denied"
      | "missing_receipt"
      | "unknown_event"
      | "unknown_call"
      | "unknown_reminder"
      | "unknown_connector"
      | "preview_unsupported"
      | "transcript_attached"
      | "call_finalized"
      | "livekit_unavailable"
      | "send_forbidden",
    message: string,
  ) {
    super(message);
    this.name = "CalendarError";
  }
}
