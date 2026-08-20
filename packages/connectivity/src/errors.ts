export class ConnectivityError extends Error {
  constructor(
    readonly code:
      | "denied"
      | "read_only"
      | "od6_blocked"
      | "unknown_event"
      | "paused"
      | "xor_owner"
      | "model_not_allowed"
      | "kill_switch"
      | "duplicate"
      | "invalid_cron"
      | "unknown_connector"
      | "rate_limited"
      | "secret_spent"
      | "not_forwarded",
    message: string,
  ) {
    super(message);
    this.name = "ConnectivityError";
  }
}
