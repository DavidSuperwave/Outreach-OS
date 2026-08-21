import type { ReactNode } from "react";

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

/** N5/N6 task split: compose popover + Soup list surface, no Macro chrome. */
export function TaskPane({
  items = [],
  composeOpen = true,
  draft = "",
  activity = [],
  alerts = [],
  onCreate,
  onMarkDone,
}: {
  items?: readonly TaskPaneItem[];
  composeOpen?: boolean;
  draft?: string;
  activity?: readonly TaskPaneActivity[];
  alerts?: readonly TaskPaneAlert[];
  onCreate?: (title: string) => void;
  onMarkDone?: (entityId: string, done: boolean) => void;
}): ReactNode {
  return (
    <div data-slice="task">
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
          {items.map((item) => (
            <tr
              key={item.entityId}
              data-entity-id={item.entityId}
              data-facet={item.facet ?? "task"}
              data-done={item.done ? "true" : "false"}
              data-command-scope="soup-entity"
            >
              <td>
                <button
                  type="button"
                  data-command={item.done ? "soup-entity.mark-not-done" : "soup-entity.mark-done"}
                  onClick={() => onMarkDone?.(item.entityId, !item.done)}
                >
                  {item.done ? "done" : "open"}
                </button>
              </td>
              <td>{item.title}</td>
              <td data-command="soup-entity.status">{item.status ?? ""}</td>
              <td data-command="soup-entity.priority">{item.priority ?? ""}</td>
            </tr>
          ))}
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
