export class SearchError extends Error {
  constructor(
    readonly code: "denied" | "unknown_type" | "index_failed",
    message: string,
  ) {
    super(message);
    this.name = "SearchError";
  }
}
