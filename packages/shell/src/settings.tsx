import { CONNECTOR_CATALOG, HARVESTED_OAUTH_STRATEGIES } from "connectivity/browser";
import type { ConnectorCatalogEntry } from "connectivity/browser";

/** The ledger exposes direct keys 1–9. Billing and other parked tabs remain outside this commandable set. */
export const SETTINGS_TABS = [
  "connections",
  "mcp",
  "bots",
  "account",
  "appearance",
  "people",
  "notifications",
  "security",
  "advanced",
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const SETTINGS_TAB_COMMAND: Record<SettingsTab, string> = {
  connections: "settings.connections",
  mcp: "settings.mcp",
  bots: "settings.bots",
  account: "settings.tab-4",
  appearance: "settings.tab-5",
  people: "settings.tab-6",
  notifications: "settings.tab-7",
  security: "settings.tab-8",
  advanced: "settings.tab-9",
};

export function settingsTabFromPath(path: string): SettingsTab {
  if (path === "/mcp") return "mcp";
  const tab = new URL(path, "https://outreach.invalid").searchParams.get("tab");
  if (tab && (SETTINGS_TABS as readonly string[]).includes(tab)) return tab as SettingsTab;
  return "connections";
}

export function settingsTabPath(tab: SettingsTab): string {
  if (tab === "connections") return "/settings";
  if (tab === "mcp") return "/mcp";
  return `/settings?tab=${tab}`;
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
            href={settingsTabPath(id)}
            data-tab={id}
            data-command={SETTINGS_TAB_COMMAND[id]}
            data-active={id === tab ? "true" : "false"}
          >
            {id === "mcp" ? "MCP" : id[0]!.toUpperCase() + id.slice(1)}
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
      {!["connections", "mcp", "bots"].includes(tab) ? (
        <p data-settings-boundary={tab}>
          {tab[0]!.toUpperCase() + tab.slice(1)} settings are routed by N5; their owning domain is not built in this shell pass.
        </p>
      ) : null}
    </section>
  );
}
