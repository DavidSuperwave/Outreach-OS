import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

export interface TaskPaneItem {
  entityId: string;
  title: string;
  facet?: string | null;
  done?: boolean;
  status?: string | null;
  priority?: string | null;
  assigneeIds?: readonly string[];
  tags?: readonly string[];
}

export interface TaskPaneActivity {
  id: string;
  action: string;
  entityId: string;
}

export interface TaskPaneAlert {
  id: string;
  kind: string;
  reason: string;
  entityId: string;
}

export const TASK_STATUS_OPTIONS = ["todo", "in_progress", "done"] as const;
export const TASK_PRIORITY_OPTIONS = ["none", "low", "medium", "high"] as const;
export const SOUP_TASK_TABS = [
  { id: "all", command: "soup.tab-1", chord: "1", label: "All" },
  { id: "open", command: "soup.tab-2", chord: "2", label: "Open" },
  { id: "done", command: "soup.tab-3", chord: "3", label: "Done" },
] as const;

export type SoupTaskTab = (typeof SOUP_TASK_TABS)[number]["id"];

const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "1.5rem",
  padding: "0 0.45rem",
  borderRadius: "0.35rem",
  border: "1px solid var(--outreach-border)",
  background: "var(--outreach-surface)",
  color: "var(--outreach-text)",
  fontSize: "0.8rem",
};

const field: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0.35rem 0.5rem",
  background: "var(--outreach-surface)",
  color: "var(--outreach-text)",
  border: "1px solid var(--outreach-border)",
  borderRadius: "0.4rem",
};

/** N5/N6 task split: compose popover + Soup list surface, no Macro chrome. */
export function TaskPane({
  items = [],
  composeOpen = false,
  draft = "",
  activity = [],
  alerts = [],
  onCreate,
  onMarkDone,
  onRename,
  onSetStatus,
  onSetPriority,
  onSetAssignee,
}: {
  items?: readonly TaskPaneItem[];
  composeOpen?: boolean;
  draft?: string;
  activity?: readonly TaskPaneActivity[];
  alerts?: readonly TaskPaneAlert[];
  onCreate?: (title: string) => void;
  onMarkDone?: (entityId: string, done: boolean) => void;
  onRename?: (entityId: string, title: string) => void;
  onSetStatus?: (entityId: string, status: string) => void;
  onSetPriority?: (entityId: string, priority: string) => void;
  onSetAssignee?: (entityId: string, assigneeId: string) => void;
}): ReactNode {
  const [tab, setTab] = useState<SoupTaskTab>("all");
  const [focusedId, setFocusedId] = useState<string | null>(items[0]?.entityId ?? null);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const visible = useMemo(() => {
    if (tab === "open") return items.filter((item) => !item.done);
    if (tab === "done") return items.filter((item) => item.done);
    return items;
  }, [items, tab]);
  const focused = visible.find((item) => item.entityId === focusedId) ?? visible[0] ?? null;

  const moveFocus = (delta: number) => {
    if (visible.length === 0) return;
    const current = Math.max(0, visible.findIndex((item) => item.entityId === focused?.entityId));
    const next = visible[(current + delta + visible.length) % visible.length];
    if (next) {
      setFocusedId(next.entityId);
      setRenamingId(null);
    }
  };

  useEffect(() => {
    if (!renamingId) return;
    const input = document.querySelector<HTMLInputElement>(
      `[data-entity-id="${renamingId}"] input[data-command='soup-entity.rename']`,
    );
    input?.focus();
    input?.select();
  }, [renamingId]);

  return (
    <div
      data-slice="task"
      data-soup-tab={tab}
      data-focused-id={focused?.entityId ?? ""}
      data-opened-id={openedId ?? ""}
      tabIndex={0}
      role="region"
      aria-label="Tasks"
    >
      <h1
        data-hint="create-menu.task"
        style={{ fontSize: "1.15rem", fontWeight: 600, margin: "0 0 0.85rem" }}
      >
        Tasks
      </h1>
      {composeOpen ? (
        <form
          data-scope="task-compose-popover"
          data-command="create-menu.task"
          role="dialog"
          aria-label="Create task"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 21,
            background: "var(--outreach-overlay)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "12vh 1.25rem 1.25rem",
          }}
          onSubmit={(event) => {
            if (!onCreate) return;
            event.preventDefault();
            const form = event.currentTarget;
            const value = String(new FormData(form).get("title") ?? "").trim();
            if (value) onCreate(value);
          }}
        >
          <div
            style={{
              background: "var(--outreach-popover)",
              color: "var(--outreach-text)",
              border: "1px solid var(--outreach-border)",
              borderRadius: "0.75rem",
              padding: "0.85rem 1rem",
              maxWidth: "28rem",
              width: "100%",
              boxShadow: "0 12px 40px oklch(0.12 0.02 260 / 0.35)",
            }}
          >
            <p style={{ color: "var(--outreach-muted)", margin: "0 0 0.75rem" }}>Create task</p>
            <label style={{ display: "block", marginBottom: "0.75rem" }}>
              Title
              <input
                name="title"
                defaultValue={draft}
                aria-label="Task title"
                autoComplete="off"
                style={{ ...field, marginTop: "0.35rem" }}
              />
            </label>
            <button
              type="submit"
              style={{
                color: "var(--outreach-surface)",
                background: "var(--outreach-accent)",
                border: 0,
                borderRadius: "0.4rem",
                padding: "0.4rem 0.75rem",
                cursor: "pointer",
              }}
            >
              Create task
            </button>
          </div>
        </form>
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          marginBottom: "0.65rem",
          flexWrap: "wrap",
        }}
      >
        <div data-surface="soup.tabs" role="tablist" aria-label="Soup tabs" style={{ display: "flex", gap: "0.15rem" }}>
          {SOUP_TASK_TABS.map((row) => (
            <button
              key={row.id}
              type="button"
              role="tab"
              aria-selected={tab === row.id}
              data-command={row.command}
              data-tab={row.id}
              onClick={() => setTab(row.id)}
              style={{
                color: "var(--outreach-accent)",
                background: "none",
                border: 0,
                cursor: "pointer",
                padding: "0.25rem 0.5rem",
                textDecoration: tab === row.id ? "underline" : "none",
              }}
            >
              {row.label}
            </button>
          ))}
        </div>
        <div data-surface="soup-nav" role="toolbar" aria-label="Soup navigation" style={{ display: "flex", gap: "0.2rem" }}>
          <button
            type="button"
            data-command="soup-nav.up-k"
            aria-label="Previous task"
            onClick={() => moveFocus(-1)}
            style={{ ...chip, cursor: "pointer", color: "var(--outreach-muted)" }}
          >
            k
          </button>
          <button
            type="button"
            data-command="soup-nav.down-j"
            aria-label="Next task"
            onClick={() => moveFocus(1)}
            style={{ ...chip, cursor: "pointer", color: "var(--outreach-muted)" }}
          >
            j
          </button>
        </div>
      </div>
      <table
        data-surface="soup.tasks"
        role="table"
        style={{
          borderCollapse: "collapse",
          width: "100%",
          color: "var(--outreach-text)",
        }}
      >
        <thead>
          <tr style={{ color: "var(--outreach-muted)", textAlign: "left", fontSize: "0.8rem" }}>
            <th style={{ padding: "0.35rem 0.45rem", width: "2.2rem" }} />
            <th style={{ padding: "0.35rem 0.45rem" }}>Title</th>
            <th style={{ padding: "0.35rem 0.45rem" }}>Status</th>
            <th style={{ padding: "0.35rem 0.45rem" }}>Priority</th>
            <th style={{ padding: "0.35rem 0.45rem" }}>Assignee</th>
            <th style={{ padding: "0.35rem 0.45rem" }}>Tags</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr data-empty="tasks">
              <td colSpan={6} style={{ padding: "0.85rem 0.45rem", color: "var(--outreach-muted)" }}>
                No tasks
              </td>
            </tr>
          ) : (
            visible.map((item) => {
              const isFocused = focused?.entityId === item.entityId;
              const renaming = renamingId === item.entityId;
              return (
                <tr
                  key={item.entityId}
                  data-entity-id={item.entityId}
                  data-facet={item.facet ?? "task"}
                  data-done={item.done ? "true" : "false"}
                  data-focused={isFocused ? "true" : "false"}
                  data-opened={openedId === item.entityId ? "true" : "false"}
                  data-editing={renaming ? "true" : "false"}
                  data-command-scope="soup-entity"
                  aria-selected={isFocused}
                  onClick={() => setFocusedId(item.entityId)}
                  style={{
                    background: isFocused ? "var(--outreach-popover)" : "transparent",
                    outline: isFocused ? "1px solid var(--outreach-border)" : "none",
                  }}
                >
                  <td style={{ padding: "0.4rem 0.45rem" }}>
                    <button
                      type="button"
                      data-command={item.done ? "soup-entity.mark-not-done" : "soup-entity.mark-done"}
                      aria-label={item.done ? "Mark not done" : "Mark done"}
                      onClick={() => onMarkDone?.(item.entityId, !item.done)}
                      style={{
                        width: "1.1rem",
                        height: "1.1rem",
                        borderRadius: "0.25rem",
                        border: "1px solid var(--outreach-border)",
                        background: item.done ? "var(--outreach-status)" : "transparent",
                        cursor: "pointer",
                        color: "transparent",
                      }}
                    >
                      {item.done ? "done" : "open"}
                    </button>
                  </td>
                  <td style={{ padding: "0.4rem 0.45rem" }}>
                    {renaming && onRename ? (
                      <form
                        data-command="soup-entity.rename"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
                          if (title) onRename(item.entityId, title);
                          setRenamingId(null);
                        }}
                      >
                        <input
                          name="title"
                          defaultValue={item.title}
                          aria-label={`Rename ${item.title}`}
                          data-command="soup-entity.rename"
                          style={field}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.stopPropagation();
                              setRenamingId(null);
                            }
                          }}
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        data-command="soup-entity.rename"
                        onClick={() => {
                          if (isFocused && onRename) setRenamingId(item.entityId);
                          else {
                            setFocusedId(item.entityId);
                            setRenamingId(null);
                          }
                        }}
                        style={{
                          background: "none",
                          border: 0,
                          padding: 0,
                          cursor: "text",
                          color: "var(--outreach-text)",
                          textDecoration: item.done ? "line-through" : "none",
                          textAlign: "left",
                        }}
                      >
                        {item.title}
                      </button>
                    )}
                  </td>
                  <td data-command="soup-entity.properties" data-surface="task.properties" style={{ padding: "0.4rem 0.45rem" }}>
                    {isFocused ? (
                      <select
                        aria-label="Status"
                        data-command="soup-entity.status"
                        value={item.status ?? "todo"}
                        onChange={(event) => onSetStatus?.(item.entityId, event.currentTarget.value)}
                        style={{ ...chip, cursor: "pointer" }}
                      >
                        {TASK_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span aria-label="Status" data-command="soup-entity.status" style={chip}>
                        {item.status ?? "todo"}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "0.4rem 0.45rem" }}>
                    {isFocused ? (
                      <select
                        aria-label="Priority"
                        data-command="soup-entity.priority"
                        value={item.priority ?? "none"}
                        onChange={(event) => onSetPriority?.(item.entityId, event.currentTarget.value)}
                        style={{ ...chip, cursor: "pointer" }}
                      >
                        {TASK_PRIORITY_OPTIONS.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span aria-label="Priority" data-command="soup-entity.priority" style={chip}>
                        {item.priority ?? "none"}
                      </span>
                    )}
                  </td>
                  <td data-command="soup-entity.assignee" style={{ padding: "0.4rem 0.45rem" }}>
                    {isFocused && onSetAssignee ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const assigneeId = String(new FormData(event.currentTarget).get("assignee") ?? "").trim();
                          if (assigneeId) onSetAssignee(item.entityId, assigneeId);
                        }}
                      >
                        <input
                          name="assignee"
                          defaultValue={item.assigneeIds?.[0] ?? ""}
                          aria-label="Assignee"
                          data-command="soup-entity.assignee"
                          style={field}
                        />
                      </form>
                    ) : (
                      <span aria-label="Assignee">{item.assigneeIds?.[0] ?? ""}</span>
                    )}
                  </td>
                  <td data-command="soup-entity.tags" style={{ padding: "0.4rem 0.45rem" }}>
                    {isFocused ? (
                      <input
                        name="tags"
                        defaultValue={(item.tags ?? []).join(", ")}
                        aria-label="Tags"
                        data-command="soup-entity.tags"
                        readOnly
                        style={field}
                      />
                    ) : (
                      <span aria-label="Tags">{(item.tags ?? []).join(", ")}</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {activity.length > 0 ? (
        <ol data-surface="activity.facts" aria-label="Task activity" style={{ color: "var(--outreach-muted)", fontSize: "0.85rem" }}>
          {activity.map((fact) => (
            <li key={fact.id} data-activity-action={fact.action} data-entity-id={fact.entityId}>
              {fact.action}
            </li>
          ))}
        </ol>
      ) : null}
      {alerts.length > 0 ? (
        <ul data-surface="operator.alerts" role="status" aria-label="Operator alerts">
          {alerts.map((alert) => (
            <li key={alert.id} data-alert-kind={alert.kind} data-entity-id={alert.entityId}>
              {alert.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
