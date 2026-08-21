/** OD-1 Branch A: dry-run only. N10 does not load Postgres. */
export interface LegacyConnectivityRef {
  table: "webhooks" | "github_app_installation" | "scheduled_actions" | "mcp_servers"
  pgId: number
}

export interface ConnectivityMappingResult {
  table: LegacyConnectivityRef["table"]
  pgId: number
  mappedKind: "webhook" | "github_install" | "automation" | "mcp_harvest"
  wrote: false
}

export function dryRunIdentityMapping(rows: readonly LegacyConnectivityRef[]): ConnectivityMappingResult[] {
  return rows.map((row) => ({
    table: row.table,
    pgId: row.pgId,
    mappedKind:
      row.table === "webhooks"
        ? "webhook"
        : row.table === "github_app_installation"
          ? "github_install"
          : row.table === "scheduled_actions"
            ? "automation"
            : "mcp_harvest",
    wrote: false,
  }));
}
