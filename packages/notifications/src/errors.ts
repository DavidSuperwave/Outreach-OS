export class NotificationsError extends Error {
  constructor(
    readonly code:
      | "push_deferred"
      | "unknown_notification"
      | "unknown_recipient"
      | "invalid_unsubscribe"
      | "unknown_type"
      | "instantly_forbidden"
      | "device_registration_parked",
    message: string,
  ) {
    super(message);
    this.name = "NotificationsError";
  }
}
