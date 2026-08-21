import { useMemo, useState, type ReactNode } from "react";

export interface TaskPaneItem {
  entityId: string;
  title: string;
  facet?: string | null;
  done?: boolean;
  status?: string | null;
  priority?: string | null;
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
  composeOpen = true,
  draft = "",
  activity = [],
  alerts = [],
  onCreate,
  onMarkDone,
  onRename,
  onSetStatus,
  onSetPriority,
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
}): ReactNode {
  const [tab, setTab] = useState<SoupTaskTab>("all");
  const [focusedId, setFocusedId] = useState<string | null>(items[0]?.entityId ?? null);
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
      onKeyDown={(event) => {
        const target = event.target;
        const typing =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement;
        if (typing) return;
        if (event.key === "j" || event.key === "ArrowDown") {
          event.preventDefault();
          moveFocus(1);
        } else if (event.key === "k" || event.key === "ArrowUp") {
          event.preventDefault();
          moveFocus(-1);
        } else if (event.key === "e" && focused) {
          event.preventDefault();
          onMarkDone?.(focused.entityId, !focused.done);
        } else if (event.key === "1" || event.key === "2" || event.key === "3") {
          const next = SOUP_TASK_TABS.find((row) => row.chord === event.key);
          if (next) setTab(next.id);
        }
      }}
      tabIndex={0}
      role="region"
      aria-label="Tasks"
    >
      <p data-hint="create-menu.task">
        <kbd>c</kbd> then <kbd>t</kbd> creates a task
      </p>
      {composeOpen ? (
        <form
          data-scope="task-compose-popover"
          data-command="create-menu.task"
          onSubmit={(event) => {
            if (!onCreate) return;
            event.preventDefault();
            const form = event.currentTarget;
            const value = String(new FormData(form).get("title") ?? "").trim();
            if (value) onCreate(value);
          }}
        >
          <label>
            Title
            <input name="title" defaultValue={draft} aria-label="Task title" />
          </label>
          <button type="submit">Create task</button>
        </form>
      ) : null}
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
      <table data-surface="soup.tasks" role="table">
        <thead>
          <tr>
            <th>Done</th>
            <th>Title</th>
            <th>Status</th>
            <th>Priority</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr data-empty="tasks">
              <td colSpan={4}>No tasks</td>
            </tr>
          ) : (
            visible.map((item) => (
              <tr
                key={item.entityId}
                data-entity-id={item.entityId}
                data-facet={item.facet ?? "task"}
                data-done={item.done ? "true" : "false"}
                data-focused={focused?.entityId === item.entityId ? "true" : "false"}
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
                <td data-command="soup-entity.status">
                  <select
                    aria-label="Status"
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
                <td data-command="soup-entity.priority">
                  <select
                    aria-label="Priority"
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
