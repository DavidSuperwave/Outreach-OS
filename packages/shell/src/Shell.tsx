import type { CSSProperties, ReactNode } from "react";
import { encodeSplits, type SplitPane } from "./splits.js";
import { isWebServed, wellKnownResponse } from "./routes.js";
import { panesFromPath } from "./path-panes.js";
import { LoginPane } from "./login-pane.js";
import { SettingsChrome, settingsTabFromPath } from "./settings.js";
import { TaskPane, type TaskPaneActivity, type TaskPaneAlert, type TaskPaneItem } from "./task-pane.js";
import { THEME_LABELS, tokenVars, type ThemeId } from "./theme.js";
import { COMMAND_MENU_ITEMS, CREATE_MENU_ITEMS } from "./n5-hotkeys.js";

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
  operatorAlerts?: readonly TaskPaneAlert[];
  onCreateTask?: (title: string) => void;
  onMarkDone?: (entityId: string, done: boolean) => void;
  onRenameTask?: (entityId: string, title: string) => void;
  onSetStatus?: (entityId: string, status: string) => void;
  onSetPriority?: (entityId: string, priority: string) => void;
  onSetAssignee?: (entityId: string, assigneeId: string) => void;
  kernelAuthError?: string;
  onKernelAuth?: (fields: { username: string; password: string; displayName: string }) => void;
  sessionReady?: boolean;
  commandMenuOpen?: boolean;
  createMenuOpen?: boolean;
  onCommandMenuSelect?: (id: string) => void;
  onCreateMenuSelect?: (id: string) => void;
  sidebarCollapsed?: boolean;
  onToggleCommandMenu?: () => void;
  onToggleCreateMenu?: () => void;
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
  taskComposeOpen = false,
  taskDraft = "",
  activityFacts = [],
  operatorAlerts = [],
  onCreateTask,
  onMarkDone,
  onRenameTask,
  onSetStatus,
  onSetPriority,
  onSetAssignee,
  kernelAuthError,
  onKernelAuth,
  sessionReady,
  commandMenuOpen = false,
  createMenuOpen = false,
  onCommandMenuSelect,
  onCreateMenuSelect,
  sidebarCollapsed = false,
  onToggleCommandMenu,
  onToggleCreateMenu,
}: ShellProps) {
  if (!isWebServed(path) || wellKnownResponse() !== null) {
    return <div data-shell="outreach-os" data-unserved="true" />;
  }
  const layout = panes ?? panesFromPath(path);
  const vars = tokenVars(theme);
  const showSettings = path === "/settings" || path === "/mcp" || path.startsWith("/settings");
  const authPath = path === "/login" || path === "/signup";
  const chromeButton: CSSProperties = {
    color: "var(--outreach-accent)",
    background: "none",
    border: 0,
    cursor: "pointer",
  };
  const overlay: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "var(--outreach-overlay)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "12vh 1.25rem 1.25rem",
    zIndex: 20,
  };
  const popover: CSSProperties = {
    background: "var(--outreach-popover)",
    color: "var(--outreach-text)",
    border: "1px solid var(--outreach-border)",
    borderRadius: "0.75rem",
    minWidth: "18rem",
    maxWidth: "28rem",
    width: "100%",
    padding: "0.85rem 1rem",
    boxShadow: "0 12px 40px oklch(0.12 0.02 260 / 0.35)",
  };
  return (
    <div
      data-shell="outreach-os"
      data-theme={theme}
      data-theme-label={THEME_LABELS[theme] ?? theme}
      data-path={encodeSplits(layout)}
      data-session-ready={sessionReady ? "true" : "false"}
      style={
        {
          ...vars,
          minHeight: "100vh",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "var(--outreach-surface)",
          color: "var(--outreach-text)",
          borderColor: "var(--outreach-border)",
        } as CSSProperties
      }
    >
      <header
        data-chrome="sidebar"
        data-collapsed={sidebarCollapsed ? "true" : "false"}
        style={{
          display: "flex",
          gap: "1.25rem",
          alignItems: "center",
          padding: "0.85rem 1.25rem",
          borderBottom: "1px solid var(--outreach-border)",
        }}
      >
        <strong>Outreach OS</strong>
        <nav aria-label="Primary" style={{ display: "flex", gap: "0.85rem" }}>
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              data-nav={item.href}
              style={{ color: "var(--outreach-accent)", textDecoration: path === item.href ? "underline" : "none" }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          data-command="global.create"
          onClick={onToggleCreateMenu}
          style={{ ...chromeButton, marginLeft: "auto" }}
        >
          Create
        </button>
        <button type="button" data-command="global.command-menu" onClick={onToggleCommandMenu} style={chromeButton}>
          Command menu
        </button>
      </header>
      <main data-route={layout[0]?.type ?? "home"} style={{ padding: "1.25rem" }}>
        {kernelAuthError ? (
          <p
            data-auth-error=""
            data-permission={/lacks |denied|receipt/i.test(kernelAuthError) ? "denied" : undefined}
            role="alert"
          >
            {kernelAuthError}
          </p>
        ) : null}
        {layout.map((pane) => (
          <section key={`${pane.type}:${pane.id}`} data-split={pane.type} data-split-id={pane.id}>
            {pane.type === "home" && path === "/" ? (
              <p>Playbooks, inspect, ask, table gadget. Governed connectors on Settings.</p>
            ) : null}
            {authPath ? (
              <LoginPane
                mode={path === "/signup" ? "signup" : "login"}
                error={kernelAuthError}
                onAuth={onKernelAuth}
              />
            ) : null}
            {pane.type === "tasks" && !children ? (
              <TaskPane
                items={taskItems}
                composeOpen={taskComposeOpen}
                draft={taskDraft}
                activity={activityFacts}
                alerts={operatorAlerts}
                onCreate={onCreateTask}
                onMarkDone={onMarkDone}
                onRename={onRenameTask}
                onSetStatus={onSetStatus}
                onSetPriority={onSetPriority}
                onSetAssignee={onSetAssignee}
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
        {createMenuOpen ? (
          <div data-surface="create-menu" role="dialog" aria-label="Create" style={overlay}>
            <div style={popover}>
              <p style={{ color: "var(--outreach-muted)", margin: "0 0 0.75rem" }}>Create</p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {CREATE_MENU_ITEMS.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-command={item.id}
                      onClick={() => onCreateMenuSelect?.(item.id)}
                      style={{
                        ...chromeButton,
                        display: "flex",
                        width: "100%",
                        justifyContent: "space-between",
                        padding: "0.45rem 0",
                      }}
                    >
                      <span>{item.label}</span>
                      <kbd style={{ color: "var(--outreach-muted)" }}>{item.chord}</kbd>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        {commandMenuOpen ? (
          <div data-surface="command-menu" role="dialog" aria-label="Command menu" style={overlay}>
            <div style={popover}>
              <p style={{ color: "var(--outreach-muted)", margin: "0 0 0.75rem" }}>Command menu</p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {COMMAND_MENU_ITEMS.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-command={item.id}
                      onClick={() => onCommandMenuSelect?.(item.id)}
                      style={{ ...chromeButton, display: "block", width: "100%", textAlign: "left", padding: "0.45rem 0" }}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </main>
      <footer data-actor={username} style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid var(--outreach-border)" }}>
        {username}
      </footer>
    </div>
  );
}
