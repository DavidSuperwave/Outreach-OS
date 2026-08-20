import type { EntityType } from "registry";
import type { AccessLevel } from "./levels.js";

const ReceiptBrand = Symbol("authz.receipt");

/**
 * In-process branded receipt. Never serialized over RPC (ADR-004).
 * Only PolicyEngine.mint() can produce a value with the brand.
 */
export interface Receipt<L extends AccessLevel = AccessLevel, T extends EntityType = EntityType> {
  readonly level: L;
  readonly entityType: T;
  readonly entityId: string;
  readonly actorId: string;
  readonly tenantId: string;
}

export class AuthzError extends Error {
  constructor(
    readonly code: "denied" | "tombstoned" | "cross_tenant" | "unregistered" | "forged",
    message: string,
  ) {
    super(message);
    this.name = "AuthzError";
  }
}

export function isReceipt(value: unknown): value is Receipt {
  return typeof value === "object" && value !== null && ReceiptBrand in value;
}

/** Package-internal constructor — do not export from the public barrel. */
export function mintReceipt<L extends AccessLevel, T extends EntityType>(
  fields: Omit<Receipt<L, T>, never>,
): Receipt<L, T> {
  return Object.assign({ [ReceiptBrand]: true }, fields) as Receipt<L, T>;
}
