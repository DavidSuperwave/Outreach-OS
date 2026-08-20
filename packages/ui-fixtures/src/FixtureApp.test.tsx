import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { STATUS_OPTION_IDS, TaskPropertiesWorkspace } from "task-properties";
import { FIXTURE_PAGES, FixtureApp } from "./FixtureApp.js";

describe("UI fixtures gallery", () => {
  it("names the N10/N6/N7/N8 fixture pages", () => {
    expect(FIXTURE_PAGES).toEqual(["home", "settings", "mcp", "bots", "documents", "tasks"]);
    const html = renderToString(createElement(FixtureApp));
    expect(html).toContain("data-fixtures=\"outreach-os\"");
    expect(html).toContain("data-fixture-link=\"settings\"");
    expect(html).toContain("data-fixture-link=\"tasks\"");
  });

  it("renders TaskGrid and KanbanBoard on Shell /tasks", () => {
    const rows = [
      {
        entityId: "doc_task_1",
        title: "Ship N10 settings tabs",
        facet: "task" as const,
        values: { pdef_status: { kind: "select" as const, optionId: STATUS_OPTION_IDS.todo } },
      },
    ];
    const html = renderToString(
      createElement(TaskPropertiesWorkspace, {
        gridRows: rows,
        kanbanColumns: [
          { optionId: STATUS_OPTION_IDS.todo, label: "Not Started", items: rows },
          { optionId: STATUS_OPTION_IDS.inProgress, label: "In Progress", items: [] },
        ],
        composeOpen: true,
        draft: "Verify settings connections tab",
        editorOpen: true,
      }),
    );
    expect(html).toContain("data-split=\"tasks\"");
    expect(html).toContain("data-surface=\"soup.tasks.grid\"");
    expect(html).toContain("data-surface=\"soup.tasks.kanban\"");
    expect(html).toContain("Ship N10 settings tabs");
  });
});
