import type { CSSProperties, ReactNode } from "react";
import { encodeSplits, type SplitPane } from "./splits.js";
import { isFullCoverRoute, isWebServed, wellKnownResponse } from "./routes.js";
import { panesFromPath } from "./path-panes.js";
import { LoginPane } from "./login-pane.js";
import { SettingsChrome, settingsTabFromPath } from "./settings.js";
import { TaskPane, type TaskPaneActivity, type TaskPaneAlert, type TaskPaneItem } from "./task-pane.js";
import { THEME_LABELS, tokenVars, type ThemeId } from "./theme.js";
import type { LeaderKey } from "./registry.js";
import {
  COMMAND_MENU_CATEGORIES,
  CREATE_MENU_ITEMS,
  SIDEBAR_NAV,
  commandMenuScopeLabel,
  filterCommandMenuItems,
  type CommandMenuCategory,
  type CommandMenuScope,
} from "./n5-hotkeys.js";

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
  commandQuery?: string;
  commandCategory?: CommandMenuCategory;
  commandSelectedIndex?: number;
  commandScope?: CommandMenuScope;
  onCommandQueryChange?: (query: string) => void;
  onCommandMenuSelect?: (id: string) => void;
  onCreateMenuSelect?: (id: string) => void;
  sidebarCollapsed?: boolean;
  armedLeader?: LeaderKey | null;
  onToggleCommandMenu?: () => void;
  onToggleCreateMenu?: () => void;
  onToggleSidebar?: () => void;
}

function navActive(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

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
  commandQuery = "",
  commandCategory = "all",
  commandSelectedIndex = 0,
  commandScope = "root",
  onCommandQueryChange,
  onCommandMenuSelect,
  onCreateMenuSelect,
  sidebarCollapsed = false,
  armedLeader = null,
  onToggleCommandMenu,
  onToggleCreateMenu,
  onToggleSidebar,
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
  const paletteItems = filterCommandMenuItems(commandQuery, commandCategory, commandScope);
  const selectedIndex =
    paletteItems.length === 0 ? 0 : Math.min(Math.max(0, commandSelectedIndex), paletteItems.length - 1);
  const fullCover = isFullCoverRoute(path);
  const sidebarWidth = sidebarCollapsed ? "3.75rem" : "15.5rem";
  const goToHintsVisible = armedLeader === "g";
  const goToHintKbd: CSSProperties = {
    color: goToHintsVisible ? "var(--outreach-accent)" : "var(--outreach-muted)",
    opacity: goToHintsVisible ? 1 : 0,
    outline: goToHintsVisible ? "1px solid var(--outreach-accent)" : "none",
    borderRadius: "0.25rem",
    padding: "0 0.2rem",
    minWidth: "1.1rem",
    textAlign: "center",
  };
  const collapsedGoToHint: CSSProperties = goToHintsVisible
    ? {
        color: "var(--outreach-accent)",
        outline: "1px solid var(--outreach-accent)",
        borderRadius: "0.25rem",
        padding: "0 0.25rem",
      }
    : {};
  const chromeLink: CSSProperties = {
    ...chromeButton,
    display: "flex",
    width: "100%",
    textAlign: "left",
    textDecoration: "none",
    padding: sidebarCollapsed ? "0.45rem 0" : "0.4rem 0.55rem",
    justifyContent: sidebarCollapsed ? "center" : "space-between",
    alignItems: "center",
    gap: "0.5rem",
    borderRadius: "0.4rem",
    boxSizing: "border-box",
  };
  return (
    <div
      data-shell="outreach-os"
      data-theme={theme}
      data-theme-label={THEME_LABELS[theme] ?? theme}
      data-path={encodeSplits(layout)}
      data-session-ready={sessionReady ? "true" : "false"}
      data-layout={fullCover ? "full-cover" : "app"}
      data-armed-leader={armedLeader ?? undefined}
      style={
        {
          ...vars,
          minHeight: "100vh",
          display: "flex",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "var(--outreach-surface)",
          color: "var(--outreach-text)",
          borderColor: "var(--outreach-border)",
        } as CSSProperties
      }
    >
      {fullCover ? null : (
        <aside
          data-chrome="sidebar"
          data-collapsed={sidebarCollapsed ? "true" : "false"}
          data-leader={goToHintsVisible ? "g" : undefined}
          style={{
            display: "flex",
            flexDirection: "column",
            width: sidebarWidth,
            flexShrink: 0,
            minHeight: "100vh",
            padding: sidebarCollapsed ? "0.85rem 0.45rem" : "0.85rem 0.7rem",
            borderRight: "1px solid var(--outreach-border)",
            boxSizing: "border-box",
            gap: "0.65rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: sidebarCollapsed ? "center" : "space-between",
              gap: "0.35rem",
            }}
          >
            {sidebarCollapsed ? null : <strong>Outreach OS</strong>}
            <button
              type="button"
              data-command="global.toggle-sidebar"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title="Toggle sidebar"
              onClick={onToggleSidebar}
              style={chromeButton}
            >
              {sidebarCollapsed ? "»" : "«"}
            </button>
          </div>
          <button type="button" data-command="global.create" onClick={onToggleCreateMenu} style={chromeLink}>
            <span>{sidebarCollapsed ? "+" : "Create"}</span>
            {sidebarCollapsed ? null : <kbd style={{ color: "var(--outreach-muted)" }}>c</kbd>}
          </button>
          <button type="button" data-command="global.command-menu" onClick={onToggleCommandMenu} style={chromeLink}>
            <span>{sidebarCollapsed ? "⌘" : "Command menu"}</span>
            {sidebarCollapsed ? null : <kbd style={{ color: "var(--outreach-muted)" }}>⌘K</kbd>}
          </button>
          <nav
            aria-label="Primary"
            style={{ display: "flex", flexDirection: "column", gap: "0.15rem", flex: 1, minHeight: 0 }}
          >
            {SIDEBAR_NAV.map((item) => {
              const active = navActive(path, item.href);
              return (
                <a
                  key={item.id}
                  href={item.href}
                  data-nav={item.href}
                  data-command={item.id}
                  data-hint={item.hint}
                  title={item.label}
                  style={{
                    ...chromeLink,
                    textDecoration: active ? "underline" : "none",
                    background: active ? "var(--outreach-popover)" : "none",
                    color: "var(--outreach-accent)",
                  }}
                >
                  <span style={sidebarCollapsed ? collapsedGoToHint : undefined}>
                    {sidebarCollapsed ? item.hint : item.label}
                  </span>
                  {sidebarCollapsed ? null : (
                    <kbd data-goto-hint="" data-armed={goToHintsVisible ? "true" : "false"} style={goToHintKbd}>
                      {item.hint}
                    </kbd>
                  )}
                </a>
              );
            })}
          </nav>
          <div data-chrome="sidebar-utility" style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
            <a href="/settings" data-command="global.toggle-settings" data-nav="/settings" style={chromeLink}>
              {sidebarCollapsed ? "S" : "Settings"}
            </a>
            <a href="/mcp" data-command="global.mcp-setup" data-nav="/mcp" style={chromeLink}>
              {sidebarCollapsed ? "M" : "MCP"}
            </a>
            <span data-actor={username} style={{ color: "var(--outreach-muted)", padding: "0.35rem 0.55rem" }}>
              {sidebarCollapsed ? username.slice(0, 1).toUpperCase() : username}
            </span>
          </div>
        </aside>
      )}
      <main data-route={layout[0]?.type ?? "home"} style={{ padding: "1.25rem", flex: 1, minWidth: 0 }}>
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
        {armedLeader === "o" && !commandMenuOpen ? (
          <div
            data-surface="open-category-hints"
            data-leader="o"
            role="status"
            aria-label="Open category"
            style={{
              position: "fixed",
              left: sidebarCollapsed ? "4.25rem" : "16.25rem",
              top: "4.5rem",
              zIndex: 19,
              ...popover,
              minWidth: "14rem",
              width: "auto",
            }}
          >
            <p style={{ color: "var(--outreach-muted)", margin: "0 0 0.75rem" }}>Open category</p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {COMMAND_MENU_CATEGORIES.map((row) => (
                <li
                  key={row.id}
                  data-command={row.command}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    padding: "0.3rem 0",
                  }}
                >
                  <span>{row.label}</span>
                  <kbd style={{ color: "var(--outreach-muted)" }}>{row.hint}</kbd>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
          <div data-surface="command-menu" data-command-scope={commandScope} role="dialog" aria-label="Command menu" style={overlay}>
            <div style={{ ...popover, maxWidth: "32rem" }}>
              <p style={{ color: "var(--outreach-muted)", margin: "0 0 0.75rem" }}>{commandMenuScopeLabel(commandScope)}</p>
              {commandScope !== "root" ? (
                <button
                  type="button"
                  data-command="command-menu.backspace-back"
                  onClick={() => onCommandMenuSelect?.("command-menu.backspace-back")}
                  style={{ ...chromeButton, marginBottom: "0.75rem" }}
                >
                  Back
                </button>
              ) : null}
              <input
                name="command-query"
                aria-label="Command search"
                value={commandQuery}
                onChange={(event) => onCommandQueryChange?.(event.currentTarget.value)}
                placeholder="Search"
                autoComplete="off"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  marginBottom: "0.75rem",
                  padding: "0.45rem 0.6rem",
                  background: "var(--outreach-surface)",
                  color: "var(--outreach-text)",
                  border: "1px solid var(--outreach-border)",
                  borderRadius: "0.45rem",
                }}
              />
              {commandScope === "root" ? (
              <div data-surface="command-menu.categories" role="tablist" aria-label="Command categories">
                {COMMAND_MENU_CATEGORIES.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    role="tab"
                    aria-selected={commandCategory === row.id}
                    data-command={row.command}
                    data-category={row.id}
                    onClick={() => onCommandMenuSelect?.(row.command)}
                    style={{
                      ...chromeButton,
                      padding: "0.25rem 0.5rem",
                      textDecoration: commandCategory === row.id ? "underline" : "none",
                    }}
                  >
                    {row.label}
                  </button>
                ))}
              </div>
              ) : null}
              <ul role="listbox" aria-label="Command results" style={{ listStyle: "none", margin: "0.75rem 0 0", padding: 0 }}>
                {paletteItems.map((item, index) => (
                  <li key={item.id} role="option" aria-selected={index === selectedIndex}>
                    <button
                      type="button"
                      data-command={item.id}
                      data-selected={index === selectedIndex ? "true" : "false"}
                      onClick={() => onCommandMenuSelect?.(item.id)}
                      style={{
                        ...chromeButton,
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "0.45rem 0.35rem",
                        background: index === selectedIndex ? "var(--outreach-surface)" : "none",
                        borderRadius: "0.35rem",
                      }}
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
    </div>
  );
}
