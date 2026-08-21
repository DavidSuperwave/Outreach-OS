import type { ReactNode } from "react";
import { encodeSplits, type SplitPane } from "./splits.js";
import { isWebServed, wellKnownResponse } from "./routes.js";
import { SettingsChrome, settingsTabFromPath } from "./settings.js";
import { TaskPane, type TaskPaneActivity, type TaskPaneItem } from "./task-pane.js";
import { OKLCH_TOKENS, THEME_LABELS, type ThemeId } from "./theme.js";

export interface ShellProps {
  path: string;
  panes?: readonly SplitPane[];
  theme?: ThemeId;
  username?: string;
  children?: ReactNode;
  taskItems?: readonly TaskPaneItem[];
  taskComposeOpen?: boolean;
  taskDraft?: string;
  activityFacts?: readonly TaskPaneActivity[];
}

const NAV = [
  { href: "/", label: "Home" },
  { href: "/tasks", label: "Tasks" },
  { href: "/documents", label: "Documents" },
  { href: "/inbox", label: "Inbox" },
  { href: "/mail", label: "Mail" },
  { href: "/file", label: "Files" },
  { href: "/search", label: "Search" },
  { href: "/activity", label: "Activity" },
  { href: "/settings", label: "Settings" },
  { href: "/mcp", label: "MCP" },
  { href: "/channels", label: "Channels" },
  { href: "/calendar", label: "Calendar" },
  { href: "/calls", label: "Calls" },
  { href: "/companies", label: "Companies" },
];

/** Original React shell (OD-11). Not a SolidJS port and not a workshop-frontend fork. */
export function Shell({
  path,
  panes,
  theme = "outreach-dark",
  username = "admin",
  children,
  taskItems = [],
  taskComposeOpen = true,
  taskDraft = "",
  activityFacts = [],
}: ShellProps) {
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
            {pane.type === "tasks" && !children ? (
              <TaskPane
                items={taskItems}
                composeOpen={taskComposeOpen}
                draft={taskDraft}
                activity={activityFacts}
              />
            ) : null}
            {pane.type === "documents" ? <p>Documents (N7): create / version / move / restore. Project = folder.</p> : null}
            {pane.type === "channel" ? (
              <p>Channels (N9): messages, DMs, threads, presence. Ordered delivery + reconnect.</p>
            ) : null}
            {pane.type === "companies" ? (
              <p>Companies (N12): CRM directory, contacts, enrichment. Kanban by Stage.</p>
            ) : null}
            {pane.type === "calendar" ? (
              <p>Calendar (N13): events, reminders. Provider-mirrored; Soup list + receipts.</p>
            ) : null}
            {pane.type === "call" ? (
              <p>Calls (N13): records, transcripts, LiveKit stub. Preview is OD-8/N15.</p>
            ) : null}
            {pane.type === "email" ? (
              <p>Mailbox (N11): inbox, threads, compose. Gmail-API send via approval queue. No SMTP.</p>
            ) : null}
            {pane.type === "inbox" ? (
              <p>Inbox (N11): company mailbox threads. Pub/Sub push sync with checkpoints.</p>
            ) : null}
            {pane.type === "files" || (pane.type === "home" && path === "/file") ? (
              <p>Files (N14): upload pending→ready, safe unfurl. Image proxy deferred.</p>
            ) : null}
            {pane.type === "search" || (pane.type === "home" && path === "/search") ? (
              <p>Search (N16): 7-entity coverage, title-boost ranking. Vectorize deferred.</p>
            ) : null}
            {path === "/activity" ? (
              <p>Activity (N17): facts, frecency recents, favorites. No retention job (OD-19).</p>
            ) : null}
          </section>
        ))}
        {children}
        {path === "/onboarding" || path === "/getting-started" ? (
          <section data-surface="n19.parked" data-spec="needed" data-path={path}>
            <p>Onboarding, getting-started, and billing are parked pending owner spec (SUP-566 / OD-5). Sign-in stays N1. No paywall, tutorial, or billing chrome.</p>
          </section>
        ) : null}
        {showSettings ? <SettingsChrome tab={settingsTabFromPath(path)} /> : null}
      </main>
      <footer data-actor={username} style={{ padding: "0.75rem 1.25rem", borderTop: `1px solid ${tokens.border}` }}>
        {username}
      </footer>
    </div>
  );
}
