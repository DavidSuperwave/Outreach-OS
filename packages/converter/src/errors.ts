export type ConverterErrorCode =
  | "convert_failed"
  | "preview_unsupported"
  | "missing_blob"
  | "unknown_job";

export class ConverterError extends Error {
  constructor(
    readonly code: ConverterErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ConverterError";
  }
}
