/**
 * Harvested from the killed in-house mcp_client (ledger:64 rider) before deletion.
 * Kernel `gatekeeper-mcp` is the runtime; this catalog is the wrapper design input.
 */
export const HARVESTED_OAUTH_STRATEGIES = [
  "authorization_code_pkce",
  "dynamic_client_registration",
  "static_client",
] as const;

export type HarvestedOAuthStrategy = (typeof HARVESTED_OAUTH_STRATEGIES)[number];

export interface ToolCatalogEntry {
  serverId: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
  /** MCP annotations are untrusted unless the portal marks the server vetted. */
  readOnlyHint: boolean | null
  trusted: boolean
  searchableText: string
}

export function searchableToolText(entry: Pick<ToolCatalogEntry, "name" | "description">): string {
  return `${entry.name} ${entry.description}`.toLowerCase();
}

export function searchToolCatalog(catalog: readonly ToolCatalogEntry[], query: string): ToolCatalogEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...catalog];
  return catalog.filter((entry) => entry.searchableText.includes(needle));
}

export function classifyObservation(entry: ToolCatalogEntry): "observe" | "approve" {
  if (entry.trusted && entry.readOnlyHint === true) return "observe";
  return "approve";
}
