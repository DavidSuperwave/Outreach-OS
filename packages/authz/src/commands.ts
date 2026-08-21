import type { DocumentFacet, EntityType } from "registry";
import { levelSatisfies, type AccessLevel } from "./levels.js";
import type { Receipt } from "./receipt.js";

/**
 * N2-owned command rows (05-GRAPH): block-entity 17 + entity 8 + property-editor 1 = 26.
 * UI ships with N5/N8; N2 freezes enablement as receipt-level (+ OD-7 task facet).
 */
export const N2_COMMAND_IDS = [
  "block-entity.mark-done",
  "block-entity.mark-done-menu",
  "block-entity.delete",
  "block-entity.rename",
  "block-entity.favorite",
  "block-entity.duplicate",
  "block-entity.move-to-folder",
  "block-entity.copy-link",
  "block-entity.copy-branch-name",
  "block-entity.copy-id",
  "block-entity.remind-me",
  "block-entity.remind-me-menu",
  "block-entity.properties",
  "block-entity.tags",
  "block-entity.priority",
  "block-entity.assignee",
  "block-entity.status",
  "entity.move-to-project.down",
  "entity.move-to-project.up",
  "entity.move-to-project.expand",
  "entity.move-to-project.collapse",
  "entity.bulk-move-to-project.down",
  "entity.bulk-move-to-project.up",
  "entity.bulk-move-to-project.expand",
  "entity.bulk-move-to-project.collapse",
  "property-editor.close",
] as const;

export type N2CommandId = (typeof N2_COMMAND_IDS)[number];

export interface CommandEnableContext {
  receipt: Receipt | null;
  entityType: EntityType | null;
  facet: DocumentFacet | null;
  resolvable: boolean;
  deletable?: boolean;
  renamable?: boolean;
  favoritable?: boolean;
  copyable?: boolean;
  movable?: boolean;
  remindable?: boolean;
  supportsTags?: boolean;
  supportsBranchName?: boolean;
  hasPriorityProperty?: boolean;
  hasAssigneeProperty?: boolean;
  hasStatusProperty?: boolean;
  isCanvas?: boolean;
  inboxOrMailReferral?: boolean;
}

function hasLevel(ctx: CommandEnableContext, need: AccessLevel): boolean {
  return ctx.receipt !== null && levelSatisfies(ctx.receipt.level, need);
}

function isTask(ctx: CommandEnableContext): boolean {
  return ctx.entityType === "document" && ctx.facet === "task";
}

export function commandEnabled(id: N2CommandId, ctx: CommandEnableContext): boolean {
  switch (id) {
    case "block-entity.copy-id":
      return true;
    case "property-editor.close":
      return true;
    case "block-entity.mark-done":
      return ctx.resolvable && hasLevel(ctx, "edit") && Boolean(ctx.inboxOrMailReferral);
    case "block-entity.mark-done-menu":
      return ctx.resolvable && hasLevel(ctx, "edit") && !ctx.inboxOrMailReferral;
    case "block-entity.delete":
      return ctx.resolvable && Boolean(ctx.deletable) && hasLevel(ctx, "owner");
    case "block-entity.rename":
      return ctx.resolvable && Boolean(ctx.renamable) && hasLevel(ctx, "edit");
    case "block-entity.favorite":
      return ctx.resolvable && Boolean(ctx.favoritable) && hasLevel(ctx, "view");
    case "block-entity.duplicate":
      return ctx.resolvable && Boolean(ctx.copyable) && hasLevel(ctx, "edit");
    case "block-entity.move-to-folder":
      return ctx.resolvable && Boolean(ctx.movable) && hasLevel(ctx, "edit");
    case "block-entity.copy-link":
      return ctx.resolvable && hasLevel(ctx, "view");
    case "block-entity.copy-branch-name":
      return ctx.resolvable && Boolean(ctx.supportsBranchName) && isTask(ctx) && hasLevel(ctx, "view");
    case "block-entity.remind-me":
      return ctx.resolvable && Boolean(ctx.remindable) && !ctx.isCanvas && hasLevel(ctx, "view");
    case "block-entity.remind-me-menu":
      return Boolean(ctx.isCanvas) && Boolean(ctx.remindable) && hasLevel(ctx, "view");
    case "block-entity.properties":
      return isTask(ctx) && hasLevel(ctx, "edit");
    case "block-entity.tags":
      return ctx.resolvable && Boolean(ctx.supportsTags) && hasLevel(ctx, "edit");
    case "block-entity.priority":
      return isTask(ctx) && Boolean(ctx.hasPriorityProperty) && hasLevel(ctx, "edit");
    case "block-entity.assignee":
      return isTask(ctx) && Boolean(ctx.hasAssigneeProperty) && hasLevel(ctx, "edit");
    case "block-entity.status":
      return isTask(ctx) && Boolean(ctx.hasStatusProperty) && hasLevel(ctx, "edit");
    case "entity.move-to-project.down":
    case "entity.move-to-project.up":
    case "entity.move-to-project.expand":
    case "entity.move-to-project.collapse":
    case "entity.bulk-move-to-project.down":
    case "entity.bulk-move-to-project.up":
    case "entity.bulk-move-to-project.expand":
    case "entity.bulk-move-to-project.collapse":
      return Boolean(ctx.movable) && hasLevel(ctx, "edit");
  }
}
