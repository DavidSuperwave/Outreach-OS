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
    <table data-surface="soup.tasks" role="table">
      <thead>
        <tr>
          <th>Done</th>
          <th>Title</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.entityId} data-entity-id={item.entityId} data-facet={item.facet ?? ""} data-done={item.done ? "true" : "false"}>
            <td>{item.done ? "done" : "open"}</td>
            <td>{item.title}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TaskWorkspace({
  items,
  composeOpen,
  draft,
  activity = [],
}: {
  items: readonly SoupItem[];
  composeOpen: boolean;
  draft: string;
  activity?: readonly { id: string; action: string; entityId: string }[];
}) {
  return (
    <Shell
      path="/tasks"
      panes={[{ type: "tasks", id: "_" }]}
      theme="outreach-dark"
      taskItems={items.map((item) => ({
        entityId: item.entityId,
        title: item.title,
        facet: item.facet,
        done: item.done,
      }))}
      taskComposeOpen={composeOpen}
      taskDraft={draft}
      activityFacts={activity}
    />
  );
}
