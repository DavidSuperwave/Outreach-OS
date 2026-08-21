import type { CommandRegistry } from "shell";
import type { RequestContext } from "control-plane";
import type { SoupItem } from "soup";
import type { TaskApi, TaskRecord, TaskView } from "./slice.js";
import { registerSliceHotkeys } from "./slice-hotkeys.js";

/**
 * ~15 command identities exercised end-to-end by the Task slice (05 §N6).
 * Enablement is owned by N4/N5; handlers here invoke TaskApi mutations.
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

export interface SliceCommandInput {
  title?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  tags?: string[];
}

export type SliceCommandResult = TaskView | TaskRecord | SoupItem[] | void;

/** Centralized command → mutation. Keyboard registry handlers call this. */
export function runSliceCommand(
  api: TaskApi,
  id: SliceCommandId,
  ctx: RequestContext,
  input: SliceCommandInput = {},
): SliceCommandResult {
  switch (id) {
    case "global.create":
    case "create-menu.task":
    case "launcher.task":
      return api.createTask(input.title ?? "Untitled", ctx);
    case "soup-entity.mark-done":
      return api.markDone(true, ctx);
    case "soup-entity.mark-not-done":
      return api.markDone(false, ctx);
    case "soup-entity.rename":
      return api.updateTitle(input.title ?? "Untitled", ctx);
    case "soup-entity.status":
      return api.setStatus(input.status ?? "todo", ctx);
    case "soup-entity.priority":
      return api.setPriority(input.priority ?? "none", ctx);
    case "soup-entity.assignee":
      return api.setAssignee(input.assigneeId ?? ctx.actor.actor.id, ctx);
    case "soup-entity.tags":
    case "soup-entity.properties":
    case "command-menu.open-category.tasks":
    case "go-to.tasks":
    case "soup.tab-1":
    case "soup.open":
      return api.listTasks(ctx.receipt ? [ctx.receipt] : []);
  }
}

export function bindSliceCommands(
  registry: CommandRegistry,
  api: TaskApi,
  ctx: () => RequestContext,
  input: () => SliceCommandInput = () => ({}),
): void {
  registerSliceHotkeys(registry, (id) => {
    if (id === "global.create" || id === "global.go-to" || id === "global.open-category-leader") {
      return true;
    }
    if (id.startsWith("soup-nav.")) return true;
    if (!(SLICE_COMMAND_IDS as readonly string[]).includes(id) && !id.startsWith("soup.tab-")) {
      return false;
    }
    const commandId = (SLICE_COMMAND_IDS as readonly string[]).includes(id)
      ? (id as SliceCommandId)
      : "soup.tab-1";
    runSliceCommand(api, commandId, ctx(), input());
    return true;
  });
}
