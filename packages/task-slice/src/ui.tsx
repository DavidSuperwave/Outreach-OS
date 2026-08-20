import { Shell } from "shell";
import type { SoupItem } from "soup/browser";

export function TaskComposePopover({ open, title }: { open: boolean; title: string }) {
  if (!open) return null;
  return (
    <form data-scope="task-compose-popover" data-command="create-menu.task">
      <label>
        Title
        <input name="title" defaultValue={title} aria-label="Task title" />
      </label>
      <button type="submit">Create task</button>
    </form>
  );
}

export function TaskList({ items }: { items: readonly SoupItem[] }) {
  return (
    <ul data-surface="soup.tasks" role="list">
      {items.map((item) => (
        <li key={item.entityId} data-entity-id={item.entityId} data-facet={item.facet ?? ""}>
          {item.title}
        </li>
      ))}
    </ul>
  );
}

export function TaskWorkspace({
  items,
  composeOpen,
  draft,
}: {
  items: readonly SoupItem[];
  composeOpen: boolean;
  draft: string;
}) {
  return (
    <div data-slice="task">
      <Shell path="/tasks" panes={[{ type: "tasks", id: "_" }]} theme="outreach-dark" />
      <TaskComposePopover open={composeOpen} title={draft} />
      <TaskList items={items} />
    </div>
  );
}
