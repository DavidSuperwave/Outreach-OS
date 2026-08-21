import {
  HARVESTED_OAUTH_STRATEGIES,
  classifyObservation,
  searchToolCatalog,
  searchableToolText,
  type HarvestedOAuthStrategy,
  type ToolCatalogEntry,
} from "./oauth.js";
import { ConnectivityError } from "./errors.js";

export interface McpServerTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/**
 * Wrapper MCP surface. Client runtime is kernel gatekeeper-mcp.
 * Server expose path is the OD-2 exception, behind a kill switch.
 * mcp_auth_proxy is not recreated.
 */
export class McpSurface {
  readonly strategies: readonly HarvestedOAuthStrategy[] = HARVESTED_OAUTH_STRATEGIES;
  readonly catalog: ToolCatalogEntry[] = [];
  exposed = new Set<string>();
  serverEnabled = true;
  invocations: { tool: string; actorId: string; at: number }[] = [];

  harvestCatalog(serverId: string, tools: McpServerTool[], trusted = false): ToolCatalogEntry[] {
    const entries = tools.map((tool) => {
      const entry: ToolCatalogEntry = {
        serverId,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        readOnlyHint: null,
        trusted,
        searchableText: searchableToolText(tool),
      };
      return entry;
    });
    this.catalog.push(...entries);
    return entries;
  }

  search(query: string): ToolCatalogEntry[] {
    return searchToolCatalog(this.catalog, query);
  }

  expose(toolName: string): void {
    if (!this.catalog.some((entry) => entry.name === toolName)) {
      throw new ConnectivityError("unknown_connector", `unknown tool ${toolName}`);
    }
    this.exposed.add(toolName);
  }

  killServer(): void {
    this.serverEnabled = false;
    this.exposed.clear();
  }

  invokeServer(toolName: string, actorId: string, at = Date.now()): { observation: "observe" | "approve" } {
    if (!this.serverEnabled) throw new ConnectivityError("kill_switch", "MCP server surface disabled");
    if (!this.exposed.has(toolName)) throw new ConnectivityError("denied", `tool ${toolName} is not exposed`);
    const entry = this.catalog.find((row) => row.name === toolName);
    if (!entry) throw new ConnectivityError("unknown_connector", `unknown tool ${toolName}`);
    this.invocations.push({ tool: toolName, actorId, at });
    return { observation: classifyObservation(entry) };
  }
}
