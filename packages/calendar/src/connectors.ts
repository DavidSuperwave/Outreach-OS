import type { ActorContext } from "identity/principal";
import { CalendarError } from "./errors.js";

/**
 * N10 connector pattern (ADR-002): catalog, connect, mint session, revoke.
 * Catalog entry is local to N13 — not added to N10 CONNECTOR_CATALOG.
 * Instantly writes are forbidden.
 */
export type CalendarVendorId = "google-calendar";

export type ConnectionScope = "user" | "team";

export interface CalendarConnectorCatalogEntry {
  vendorId: CalendarVendorId;
  displayName: string;
  tagline: string;
  readOnly: boolean;
  kernelBinding: string;
}

export const CALENDAR_CONNECTOR_CATALOG: readonly CalendarConnectorCatalogEntry[] = [
  {
    vendorId: "google-calendar",
    displayName: "Google Calendar",
    tagline: "Mirror events from the mail-coupled provider account. No Instantly writes.",
    readOnly: false,
    kernelBinding: "GATEKEEPER_GOOGLE",
  },
];

export interface CalendarConnection {
  id: string;
  vendorId: CalendarVendorId;
  displayName: string;
  scope: ConnectionScope;
  ownerId: string;
  tenantId: string;
  /** Ciphertext handle only — never logged. */
  credentialHandle: string;
  createdAt: number;
  revokedAt: number | null;
}

export class CalendarProviderStore {
  #rows = new Map<string, CalendarConnection>();
  #seq = 0;

  catalog(): readonly CalendarConnectorCatalogEntry[] {
    return CALENDAR_CONNECTOR_CATALOG;
  }

  connect(input: {
    vendorId: CalendarVendorId;
    displayName: string;
    scope: ConnectionScope;
    actor: ActorContext;
    credentialHandle: string;
    at?: number;
  }): CalendarConnection {
    const tenantId = input.actor.actor.tenantId;
    if (!tenantId) throw new CalendarError("denied", "calendar connector install requires a tenant");
    if (input.scope === "team") {
      const roleOk = input.actor.isDeploymentAdmin || input.actor.actor.kind === "user";
      if (!roleOk) throw new CalendarError("denied", "team calendar connector requires a user admin");
    }
    this.#seq += 1;
    const id = `calconn_${this.#seq.toString(16).padStart(32, "0")}`;
    const record: CalendarConnection = {
      id,
      vendorId: input.vendorId,
      displayName: input.displayName,
      scope: input.scope,
      ownerId: input.actor.actor.id,
      tenantId,
      credentialHandle: input.credentialHandle,
      createdAt: input.at ?? this.#seq,
      revokedAt: null,
    };
    this.#rows.set(id, record);
    return record;
  }

  mintSession(connectionId: string, actor: ActorContext): CalendarConnection {
    const record = this.require(connectionId);
    if (record.revokedAt !== null) throw new CalendarError("denied", "connection revoked");
    if (record.scope === "team") {
      if (actor.actor.tenantId !== record.tenantId) {
        throw new CalendarError("denied", "cross-tenant calendar connector session");
      }
    } else if (actor.actor.id !== record.ownerId) {
      throw new CalendarError("denied", "user-scoped calendar connection");
    }
    return record;
  }

  revoke(connectionId: string, actor: ActorContext, at = Date.now()): CalendarConnection {
    const record = this.mintSession(connectionId, actor);
    const next = { ...record, revokedAt: at };
    this.#rows.set(connectionId, next);
    return next;
  }

  require(connectionId: string): CalendarConnection {
    const record = this.#rows.get(connectionId);
    if (!record) throw new CalendarError("unknown_connector", `unknown connection ${connectionId}`);
    return record;
  }

  list(tenantId: string): CalendarConnection[] {
    return [...this.#rows.values()].filter((row) => row.tenantId === tenantId && row.revokedAt === null);
  }
}
