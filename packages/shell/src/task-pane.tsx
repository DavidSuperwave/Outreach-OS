import { useMemo, useState, type ReactNode } from "react";

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
    if (next) setFocusedId(next.entityId);
  };

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
      <p data-hint="create-menu.task" style={{ color: "var(--outreach-muted)" }}>
        <kbd>c</kbd> then <kbd>t</kbd> opens compose
      </p>
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
              border: "1px solid var(--outreach-border)",
              borderRadius: "0.75rem",
              padding: "0.85rem 1rem",
              maxWidth: "28rem",
              width: "100%",
            }}
          >
            <label>
              Title
              <input name="title" defaultValue={draft} aria-label="Task title" autoComplete="off" />
            </label>
            <button type="submit">Create task</button>
          </div>
        </form>
      ) : null}
      <div data-surface="soup-nav" role="toolbar" aria-label="Soup navigation">
        <button type="button" data-command="soup-nav.up-k" aria-label="Previous task" onClick={() => moveFocus(-1)}>
          k
        </button>
        <button type="button" data-command="soup-nav.down-j" aria-label="Next task" onClick={() => moveFocus(1)}>
          j
        </button>
      </div>
      <div data-surface="soup.tabs" role="tablist" aria-label="Soup tabs">
        {SOUP_TASK_TABS.map((row) => (
          <button
            key={row.id}
            type="button"
            role="tab"
            aria-selected={tab === row.id}
            data-command={row.command}
            data-tab={row.id}
            onClick={() => setTab(row.id)}
          >
            {row.label}
          </button>
        ))}
      </div>
      <table data-surface="soup.tasks" role="table" style={{ borderColor: "var(--outreach-border)", width: "100%" }}>
        <thead>
          <tr>
            <th>Done</th>
            <th>Title</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assignee</th>
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr data-empty="tasks">
              <td colSpan={6}>No tasks</td>
            </tr>
          ) : (
            visible.map((item) => (
              <tr
                key={item.entityId}
                data-entity-id={item.entityId}
                data-facet={item.facet ?? "task"}
                data-done={item.done ? "true" : "false"}
                data-focused={focused?.entityId === item.entityId ? "true" : "false"}
                data-opened={openedId === item.entityId ? "true" : "false"}
                data-command-scope="soup-entity"
                aria-selected={focused?.entityId === item.entityId}
                onClick={() => setFocusedId(item.entityId)}
              >
                <td>
                  <button
                    type="button"
                    data-command={item.done ? "soup-entity.mark-not-done" : "soup-entity.mark-done"}
                    aria-label={item.done ? "Mark not done" : "Mark done"}
                    onClick={() => onMarkDone?.(item.entityId, !item.done)}
                  >
                    {item.done ? "done" : "open"}
                  </button>
                </td>
                <td>
                  {onRename ? (
                    <form
                      data-command="soup-entity.rename"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
                        if (title) onRename(item.entityId, title);
                      }}
                    >
                      <input
                        name="title"
                        defaultValue={item.title}
                        aria-label={`Rename ${item.title}`}
                        data-command="soup-entity.rename"
                      />
                    </form>
                  ) : (
                    item.title
                  )}
                </td>
                <td data-command="soup-entity.properties" data-surface="task.properties">
                  <select
                    aria-label="Status"
                    data-command="soup-entity.status"
                    value={item.status ?? "todo"}
                    onChange={(event) => onSetStatus?.(item.entityId, event.currentTarget.value)}
                  >
                    {TASK_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    aria-label="Priority"
                    data-command="soup-entity.priority"
                    value={item.priority ?? "none"}
                    onChange={(event) => onSetPriority?.(item.entityId, event.currentTarget.value)}
                  >
                    {TASK_PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </td>
                <td data-command="soup-entity.assignee">
                  {onSetAssignee ? (
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
                      />
                    </form>
                  ) : (
                    item.assigneeIds?.[0] ?? ""
                  )}
                </td>
                <td data-command="soup-entity.tags">
                  <input
                    name="tags"
                    defaultValue={(item.tags ?? []).join(", ")}
                    aria-label="Tags"
                    data-command="soup-entity.tags"
                    readOnly
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {activity.length > 0 ? (
        <ol data-surface="activity.facts" aria-label="Task activity">
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
