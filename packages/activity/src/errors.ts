export class ActivityError extends Error {
  constructor(
    readonly code: "denied" | "missing_receipt" | "poison" | "unknown_favorite" | "cap",
    message: string,
  ) {
    super(message);
    this.name = "ActivityError";
  }
}
