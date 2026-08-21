import type { ActorContext } from "identity/principal";
import type { Receipt } from "authz";
import { randomUUID } from "node:crypto";

export interface RequestContext {
  actor: ActorContext;
  correlationId: string;
  /** In-process receipt when the handler already minted; never serialized. */
  receipt: Receipt | null;
  idempotencyKey: string | null;
}

export function requestContext(
  actor: ActorContext,
  extras: Partial<Pick<RequestContext, "receipt" | "idempotencyKey" | "correlationId">> = {},
): RequestContext {
  return {
    actor,
    correlationId: extras.correlationId ?? randomUUID(),
    receipt: extras.receipt ?? null,
    idempotencyKey: extras.idempotencyKey ?? null,
  };
}

export class ControlPlaneError extends Error {
  constructor(
    readonly code:
      | "duplicate"
      | "poison"
      | "untagged_secret"
      | "unknown_topic"
      | "checkpoint_gap"
      | "denied",
    message: string,
  ) {
    super(message);
    this.name = "ControlPlaneError";
  }
}
