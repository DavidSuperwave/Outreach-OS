import type { ActorContext } from "identity/principal";
import { ConnectivityError } from "./errors.js";

export type ConnectionScope = "user" | "team";

export type ConnectorVendorId = "instantly" | "github" | "mcp" | "mcp-portal";

export interface ConnectionRecord {
  id: string
  vendorId: ConnectorVendorId
  displayName: string
  scope: ConnectionScope
  ownerId: string
  tenantId: string
  /** Ciphertext handle only — never logged. */
  credentialHandle: string
  createdAt: number
  revokedAt: number | null
}

export interface ConnectorCatalogEntry {
  vendorId: ConnectorVendorId
  displayName: string
  tagline: string
  readOnly: boolean
  kernelBinding: string
}

export const CONNECTOR_CATALOG: readonly ConnectorCatalogEntry[] = [
  {
    vendorId: "instantly",
    displayName: "Instantly",
    tagline: "Read campaigns, accounts, leads, and analytics. No send/activate.",
    readOnly: true,
    kernelBinding: "GATEKEEPER_INSTANTLY",
  },
  {
    vendorId: "github",
    displayName: "GitHub",
    tagline: "Reference connector: PRs as foreign_entity, inbound /hooks/github/*.",
    readOnly: false,
    kernelBinding: "GATEKEEPER_GITHUB",
  },
  {
    vendorId: "mcp",
    displayName: "MCP (BYO)",
    tagline: "Kernel gatekeeper-mcp. Old mcp_client is killed.",
    readOnly: false,
    kernelBinding: "GATEKEEPER_MCP",
  },
  {
    vendorId: "mcp-portal",
    displayName: "MCP portal",
    tagline: "Admin-configured upstream MCP portal.",
    readOnly: false,
    kernelBinding: "GATEKEEPER_MCP_PORTAL",
  },
];

/**
 * OD-29 recommendation (a): wrapper-owned team-connection model.
 * Gatekeeper sessions are minted per use. No kernel grant table.
 */
export class TeamConnectionStore {
  #rows = new Map<string, ConnectionRecord>();
  #seq = 0;

  catalog(): readonly ConnectorCatalogEntry[] {
    return CONNECTOR_CATALOG;
  }

  connect(input: {
    vendorId: ConnectorVendorId
    displayName: string
    scope: ConnectionScope
    actor: ActorContext
    credentialHandle: string
    at?: number
  }): ConnectionRecord {
    const tenantId = input.actor.actor.tenantId;
    if (!tenantId) throw new ConnectivityError("denied", "connector install requires a tenant");
    if (input.scope === "team") {
      const roleOk = input.actor.isDeploymentAdmin || input.actor.actor.kind === "user";
      if (!roleOk) throw new ConnectivityError("denied", "team connector install requires a user admin");
    }
    this.#seq += 1;
    const id = `conn_${this.#seq.toString(16).padStart(32, "0")}`;
    const record: ConnectionRecord = {
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

  mintSession(connectionId: string, actor: ActorContext): ConnectionRecord {
    const record = this.require(connectionId);
    if (record.revokedAt !== null) throw new ConnectivityError("denied", "connection revoked");
    if (record.scope === "team") {
      if (actor.actor.tenantId !== record.tenantId) {
        throw new ConnectivityError("denied", "cross-tenant connector session");
      }
    } else if (actor.actor.id !== record.ownerId) {
      throw new ConnectivityError("denied", "user-scoped connection");
    }
    return record;
  }

  revoke(connectionId: string, actor: ActorContext, at = Date.now()): ConnectionRecord {
    const record = this.mintSession(connectionId, actor);
    const next = { ...record, revokedAt: at };
    this.#rows.set(connectionId, next);
    return next;
  }

  require(connectionId: string): ConnectionRecord {
    const record = this.#rows.get(connectionId);
    if (!record) throw new ConnectivityError("unknown_connector", `unknown connection ${connectionId}`);
    return record;
  }

  list(tenantId: string): ConnectionRecord[] {
    return [...this.#rows.values()].filter((row) => row.tenantId === tenantId && row.revokedAt === null);
  }
}
