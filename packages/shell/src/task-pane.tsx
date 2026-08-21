import type { ReactNode } from "react";

/** N5/N6 task split: compose popover + Soup list surface, no Macro chrome. */
export function TaskPane({
  items = [],
  composeOpen = true,
  draft = "",
}: {
  items?: readonly { entityId: string; title: string; facet?: string | null }[];
  composeOpen?: boolean;
  draft?: string;
}): ReactNode {
  return (
    <div data-slice="task">
      {composeOpen ? (
        <form data-scope="task-compose-popover" data-command="create-menu.task">
          <label>
            Title
            <input name="title" defaultValue={draft} aria-label="Task title" />
          </label>
          <button type="submit">Create task</button>
        </form>
      ) : null}
      <ul data-surface="soup.tasks" role="list">
        {items.map((item) => (
          <li key={item.entityId} data-entity-id={item.entityId} data-facet={item.facet ?? "task"}>
            {item.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
