import { Shell } from "shell";
import { TaskComposePopover } from "task-slice/browser";
import { KANBAN_NONE } from "./system.js";
import type { GridRow, KanbanColumn, PropertyDefinition, PropertyValue } from "./types.js";

export function cellText(value: PropertyValue | null | undefined): string {
  if (!value) return "";
  switch (value.kind) {
    case "text":
      return value.text;
    case "number":
      return String(value.number);
    case "date":
      return value.date;
    case "select":
      return value.optionId ?? "";
    case "multi_select":
      return value.optionIds.join(",");
    case "user":
      return value.userIds.join(",");
    case "boolean":
      return value.flag ? "true" : "false";
    case "url":
      return value.url;
    case "relation":
      return value.entityIds.join(",");
  }
}

export function TaskGrid({
  rows,
  definitionIds,
}: {
  rows: readonly GridRow[];
  definitionIds?: readonly string[];
}) {
  const columns = definitionIds ?? (rows[0] ? Object.keys(rows[0].values) : []);
  return (
    <table data-surface="soup.tasks.grid" data-view="grid">
      <thead>
        <tr>
          <th>Title</th>
          {columns.map((id) => (
            <th key={id} data-definition-id={id}>
              {id}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.entityId} data-entity-id={row.entityId} data-facet={row.facet ?? ""}>
            <td>{row.title}</td>
            {columns.map((id) => (
              <td key={id} data-cell={id}>
                {cellText(row.values[id])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function KanbanBoard({ columns }: { columns: readonly KanbanColumn[] }) {
  return (
    <div data-surface="soup.tasks.kanban" data-view="kanban" role="list">
      {columns.map((column) => (
        <section
          key={column.optionId}
          data-kanban-column={column.optionId}
          data-empty={column.items.length === 0 ? "true" : "false"}
        >
          <h3>{column.label}</h3>
          <ul>
            {column.items.map((item) => (
              <li
                key={item.entityId}
                data-entity-id={item.entityId}
                data-facet={item.facet ?? ""}
                data-column={column.optionId === KANBAN_NONE ? "none" : column.optionId}
              >
                {item.title}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function PropertyEditor({
  open,
  definitions,
}: {
  open: boolean;
  definitions?: readonly PropertyDefinition[];
}) {
  if (!open) return null;
  return (
    <div data-scope="property-editor" data-command="block-entity.properties">
      <h2>Properties</h2>
      <ul>
        {(definitions ?? []).map((definition) => (
          <li key={definition.id} data-definition-id={definition.id} data-system={definition.isSystem ? "true" : "false"}>
            {definition.name}
          </li>
        ))}
      </ul>
      <button type="button" data-command="property-editor.close">
        Close
      </button>
    </div>
  );
}

export function TaskPropertiesWorkspace({
  gridRows,
  kanbanColumns,
  composeOpen,
  draft,
  editorOpen,
  definitions,
}: {
  gridRows: readonly GridRow[];
  kanbanColumns: readonly KanbanColumn[];
  composeOpen: boolean;
  draft: string;
  editorOpen?: boolean;
  definitions?: readonly PropertyDefinition[];
}) {
  return (
    <div data-slice="task-properties">
      <Shell path="/tasks" panes={[{ type: "tasks", id: "_" }]} theme="outreach-dark">
        <TaskComposePopover open={composeOpen} title={draft} />
        <PropertyEditor open={editorOpen ?? false} definitions={definitions} />
        <TaskGrid rows={gridRows} />
        <KanbanBoard columns={kanbanColumns} />
      </Shell>
    </div>
  );
}
