import { CONNECTOR_CATALOG, HARVESTED_OAUTH_STRATEGIES, N10_COMMAND_IDS } from "connectivity/browser";
import type { ConnectorCatalogEntry } from "connectivity/browser";

export const SETTINGS_TABS = ["connections", "mcp", "bots"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const SETTINGS_TAB_COMMAND: Record<SettingsTab, (typeof N10_COMMAND_IDS)[number]> = {
  connections: "settings.connections",
  mcp: "settings.mcp",
  bots: "settings.bots",
};

export function settingsTabFromPath(path: string): SettingsTab {
  if (path === "/mcp") return "mcp";
  if (path.includes("bots")) return "bots";
  return "connections";
}

export function SettingsChrome({
  tab,
  catalog = CONNECTOR_CATALOG,
  strategies = HARVESTED_OAUTH_STRATEGIES,
  mcpServerEnabled = true,
}: {
  tab: SettingsTab
  catalog?: readonly ConnectorCatalogEntry[]
  strategies?: readonly string[]
  mcpServerEnabled?: boolean
}) {
  return (
    <section data-surface="settings" data-settings-tab={tab} data-command={SETTINGS_TAB_COMMAND[tab]}>
      <p>
        <a href="/" data-command="settings.close">
          Back
        </a>
      </p>
      <nav data-settings-tabs="" aria-label="Settings">
        {SETTINGS_TABS.map((id) => (
          <a
            key={id}
            href={id === "mcp" ? "/mcp" : id === "bots" ? "/settings?tab=bots" : "/settings"}
            data-tab={id}
            data-command={SETTINGS_TAB_COMMAND[id]}
            data-active={id === tab ? "true" : "false"}
          >
            {id === "connections" ? "Connections" : id === "mcp" ? "MCP" : "Bots"}
          </a>
        ))}
      </nav>
      {tab === "connections" ? (
        <ul data-catalog="connectors" role="list" style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
          {catalog.map((row) => (
            <li
              key={row.vendorId}
              data-vendor={row.vendorId}
              data-read-only={row.readOnly ? "true" : "false"}
              data-binding={row.kernelBinding}
              style={{
                border: "1px solid currentColor",
                borderRadius: "8px",
                padding: "0.85rem 1rem",
                display: "grid",
                gap: "0.25rem",
              }}
            >
              <strong>{row.displayName}</strong>
              <span>{row.tagline}</span>
              <code>{row.kernelBinding}</code>
              {row.readOnly ? <em data-posture="reads-only">reads only</em> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "mcp" ? (
        <div data-catalog="mcp">
          <p data-mcp-server={mcpServerEnabled ? "on" : "off"}>
            MCP server surface {mcpServerEnabled ? "enabled" : "killed"}
          </p>
          <ul data-oauth-strategies="" role="list">
            {strategies.map((strategy) => (
              <li key={strategy} data-strategy={strategy}>{strategy}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {tab === "bots" ? (
        <p data-bot-owner="xor">Webhook owner is user XOR bot. Channel bots wait on N9.</p>
      ) : null}
    </section>
  );
}
