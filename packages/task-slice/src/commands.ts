/**
 * ~15 command identities exercised end-to-end by the Task slice (05 §N6).
 * Enablement is owned by N4/N5; the slice only names the exercised set.
 */
export const SLICE_COMMAND_IDS = [
  "global.create",
  "create-menu.task",
  "launcher.task",
  "command-menu.open-category.tasks",
  "go-to.tasks",
  "soup.tab-1",
  "soup.open",
  "soup-entity.mark-done",
  "soup-entity.mark-not-done",
  "soup-entity.rename",
  "soup-entity.properties",
  "soup-entity.tags",
  "soup-entity.priority",
  "soup-entity.assignee",
  "soup-entity.status",
] as const;

export type SliceCommandId = (typeof SLICE_COMMAND_IDS)[number];
