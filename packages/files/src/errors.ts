export class FilesError extends Error {
  constructor(
    readonly code: "not_ready" | "unknown_file" | "denied" | "missing_blob" | "proxy_deferred",
    message: string,
  ) {
    super(message);
    this.name = "FilesError";
  }
}
