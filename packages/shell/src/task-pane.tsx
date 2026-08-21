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

/** N5/N6 task split: compose popover + Soup list surface, no Macro chrome. */
export function TaskPane({
  items = [],
  composeOpen = true,
  draft = "",
  activity = [],
}: {
  items?: readonly TaskPaneItem[];
  composeOpen?: boolean;
  draft?: string;
  activity?: readonly TaskPaneActivity[];
}): ReactNode {
  return (
    <div data-slice="task">
      <p data-hint="create-menu.task">
        <kbd>c</kbd> then <kbd>t</kbd> creates a task
      </p>
      {composeOpen ? (
        <form data-scope="task-compose-popover" data-command="create-menu.task">
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
                <span data-command={item.done ? "soup-entity.mark-not-done" : "soup-entity.mark-done"}>
                  {item.done ? "done" : "open"}
                </span>
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
    </div>
  );
}
