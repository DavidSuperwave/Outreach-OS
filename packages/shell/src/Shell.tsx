import { encodeSplits, type SplitPane } from "./splits.js";
import { isWebServed, wellKnownResponse } from "./routes.js";
import { SettingsChrome, settingsTabFromPath } from "./settings.js";
import { OKLCH_TOKENS, THEME_LABELS, type ThemeId } from "./theme.js";

export interface ShellProps {
  path: string;
  panes?: readonly SplitPane[];
  theme?: ThemeId;
  username?: string;
}

const NAV = [
  { href: "/", label: "Home" },
  { href: "/tasks", label: "Tasks" },
  { href: "/documents", label: "Documents" },
  { href: "/settings", label: "Settings" },
  { href: "/mcp", label: "MCP" },
  { href: "/channels", label: "Channels" },
];

/** Original React shell (OD-11). Not a SolidJS port and not a workshop-frontend fork. */
export function Shell({ path, panes, theme = "outreach-dark", username = "admin" }: ShellProps) {
  if (!isWebServed(path) || wellKnownResponse() !== null) {
    return <div data-shell="outreach-os" data-unserved="true" />;
  }
  const layout = panes ?? [{ type: "home", id: "_" }];
  const tokens = theme === "outreach-light" ? OKLCH_TOKENS["outreach-light"] : OKLCH_TOKENS["outreach-dark"];
  const showSettings = path === "/settings" || path === "/mcp" || path.startsWith("/settings");
  return (
    <div
      data-shell="outreach-os"
      data-theme={theme}
      data-theme-label={THEME_LABELS[theme] ?? theme}
      data-path={encodeSplits(layout)}
      style={{
        minHeight: "100vh",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        background: tokens.surface,
        color: tokens.text,
        borderColor: tokens.border,
      }}
    >
      <header
        data-chrome="sidebar"
        style={{
          display: "flex",
          gap: "1.25rem",
          alignItems: "center",
          padding: "0.85rem 1.25rem",
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        <strong>Outreach OS</strong>
        <nav aria-label="Primary" style={{ display: "flex", gap: "0.85rem" }}>
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              data-nav={item.href}
              style={{ color: tokens.accent, textDecoration: path === item.href ? "underline" : "none" }}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main data-route={layout[0]?.type ?? "home"} style={{ padding: "1.25rem" }}>
        {layout.map((pane) => (
          <section key={`${pane.type}:${pane.id}`} data-split={pane.type} data-split-id={pane.id}>
            {pane.type === "home" && path === "/" ? (
              <p>Playbooks, inspect, ask, table gadget. Governed connectors on Settings.</p>
            ) : null}
            {pane.type === "tasks" ? (
              <p>Tasks (N8): properties, bulk edit, kanban/grid. One Task Database.</p>
            ) : null}
            {pane.type === "documents" ? <p>Documents (N7): create / version / move / restore. Project = folder.</p> : null}
            {pane.type === "channel" ? <p>Channels (N9) not wired yet.</p> : null}
          </section>
        ))}
        {showSettings ? <SettingsChrome tab={settingsTabFromPath(path)} /> : null}
      </main>
      <footer data-actor={username} style={{ padding: "0.75rem 1.25rem", borderTop: `1px solid ${tokens.border}` }}>
        {username}
      </footer>
    </div>
  );
}
