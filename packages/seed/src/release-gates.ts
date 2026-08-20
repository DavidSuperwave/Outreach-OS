import { REQUIRED_DOMAIN_PACKAGES } from "./catalog.js";

/**
 * The ten wave release gates from `09-TESTING-PARITY-AND-RELEASE-GATES.md`.
 * N21 Branch A sign-off is per-domain at the N1–N6 in-process bar — not live
 * Cloudflare traffic.
 */
export const RELEASE_GATE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type ReleaseGateId = (typeof RELEASE_GATE_IDS)[number];

export const RELEASE_GATE_NAMES: Record<ReleaseGateId, string> = {
  1: "source and owner-ruling traceability",
  2: "contract compatibility",
  3: "authorization and tenant isolation",
  4: "failure/retry/idempotency tests",
  5: "projection reconciliation",
  6: "accessibility and keyboard tests",
  7: "visual parity where applicable",
  8: "observability and alert proof",
  9: "migration/rollback proof",
  10: "operator runbook review",
};

export interface DomainReleaseSignoff {
  domain: string;
  pkg: (typeof REQUIRED_DOMAIN_PACKAGES)[number];
  node: string;
  gates: readonly ReleaseGateId[];
  leftover: string;
}

/** Every kept domain node signs the gates it owns at the in-process Done bar. */
export const DOMAIN_RELEASE_SIGNOFF: readonly DomainReleaseSignoff[] = [
  { domain: "identity", pkg: "identity", node: "N1", gates: [1, 2, 3], leftover: "live Cloudflare Access" },
  { domain: "registry", pkg: "registry", node: "N2", gates: [1, 2, 3], leftover: "none at this bar" },
  { domain: "authz", pkg: "authz", node: "N2", gates: [3], leftover: "none at this bar" },
  { domain: "control-plane", pkg: "control-plane", node: "N3", gates: [1, 2, 4, 8], leftover: "live tracing backend" },
  { domain: "soup", pkg: "soup", node: "N4", gates: [5], leftover: "live D1 FTS5" },
  { domain: "shell", pkg: "shell", node: "N5", gates: [6, 7, 10], leftover: "1:1 visual golden beyond fixtures" },
  { domain: "task-slice", pkg: "task-slice", node: "N6", gates: [1, 2, 3, 4, 5, 6, 7, 9], leftover: "none at this bar" },
  { domain: "documents", pkg: "documents", node: "N7", gates: [2, 4, 5, 7, 9], leftover: "live Loro / R2" },
  { domain: "task-properties", pkg: "task-properties", node: "N8", gates: [5, 6, 7], leftover: "live D1 property index" },
  { domain: "channels", pkg: "channels", node: "N9", gates: [4, 5, 10], leftover: "live DO websocket" },
  { domain: "connectivity", pkg: "connectivity", node: "N10", gates: [2, 3, 4, 8], leftover: "live MCP OAuth; Instantly writes closed" },
  { domain: "mailbox", pkg: "mailbox", node: "N11", gates: [2, 3, 4, 5], leftover: "live Gmail / Pub/Sub" },
  { domain: "crm", pkg: "crm", node: "N12", gates: [5, 7], leftover: "live enrichment feeds" },
  { domain: "calendar", pkg: "calendar", node: "N13", gates: [2, 3, 5], leftover: "live LiveKit" },
  { domain: "files", pkg: "files", node: "N14", gates: [3, 9], leftover: "live R2; OD-6 DoH" },
  { domain: "converter", pkg: "converter", node: "N15", gates: [4, 8], leftover: "live LibreOffice container" },
  { domain: "search", pkg: "search", node: "N16", gates: [5], leftover: "live D1 FTS5; Vectorize deferred" },
  { domain: "activity", pkg: "activity", node: "N17", gates: [4, 5], leftover: "live D1 fact log" },
  { domain: "notifications", pkg: "notifications", node: "N18", gates: [4, 5], leftover: "live digest mail; no APNS/FCM" },
];

export function signedGateIds(): ReleaseGateId[] {
  const seen = new Set<ReleaseGateId>();
  for (const row of DOMAIN_RELEASE_SIGNOFF) {
    for (const gate of row.gates) seen.add(gate);
  }
  return [...seen].sort((a, b) => a - b);
}
