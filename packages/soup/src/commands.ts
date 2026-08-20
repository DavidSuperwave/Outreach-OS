import type { DocumentFacet, EntityType } from "registry";
import { levelSatisfies, type AccessLevel, type Receipt } from "authz";

/**
 * N4-owned command rows (05-GRAPH): soup 28 + soup-entity 22 + soup-nav 8 + favorites 1 = 59.
 * UI ships with N5; N4 freezes enablement against list/search state + N2 receipts.
 */
export const N4_COMMAND_IDS = [
  "soup.filter-by-type",
  "soup.sort",
  "soup.search-focus",
  "soup.filter",
  "soup.ask-ai",
  "soup.expand-search",
  "soup.jump-top",
  "soup.jump-top-gg",
  "soup.jump-bottom",
  "soup.open",
  "soup.focus-preview",
  "soup.open-replace-preview",
  "soup.toggle-select",
  "soup.select-all",
  "soup.command-menu",
  "soup.escape-multi",
  "soup.open-new-split",
  "soup.tab-1",
  "soup.tab-2",
  "soup.tab-3",
  "soup.tab-4",
  "soup.tab-5",
  "soup.tab-6",
  "soup.tab-7",
  "soup.tab-8",
  "soup.tab-9",
  "soup.next-tab",
  "soup.prev-tab",
  "soup-entity.mark-done",
  "soup-entity.mark-not-done",
  "soup-entity.mark-unread",
  "soup-entity.mark-read",
  "soup-entity.delete",
  "soup-entity.rename",
  "soup-entity.favorite",
  "soup-entity.duplicate",
  "soup-entity.move-to-folder",
  "soup-entity.copy-link",
  "soup-entity.copy-branch-name",
  "soup-entity.copy-id",
  "soup-entity.remind-me",
  "soup-entity.share",
  "soup-entity.properties",
  "soup-entity.tags",
  "soup-entity.priority",
  "soup-entity.assignee",
  "soup-entity.status",
  "soup-entity.company-stage",
  "soup-entity.company-owner",
  "soup-entity.company-revenue",
  "soup-nav.down-j",
  "soup-nav.down-arrow",
  "soup-nav.up-k",
  "soup-nav.up-arrow",
  "soup-nav.select-up",
  "soup-nav.select-down",
  "soup-nav.collapse",
  "soup-nav.expand",
  "favorites.open.<favorite>",
] as const;

export type N4CommandId = (typeof N4_COMMAND_IDS)[number];

export interface SoupCommandContext {
  receipt: Receipt | null;
  entityType: EntityType | null;
  facet: DocumentFacet | null;
  resolvable: boolean;
  view: "list" | "search";
  hasRows: boolean;
  hasFocus: boolean;
  focusedIsGroup: boolean;
  focusedCollapsed: boolean;
  focusedCollapsible: boolean;
  selectionCount: number;
  tabCount: number;
  searchCollapsed: boolean;
  hasSearchQuery: boolean;
  isPreviewController: boolean;
  commandMenuOpen: boolean;
  spotlighted: boolean;
  persistentNav: boolean;
  goToScopeActive: boolean;
  deletable?: boolean;
  renamable?: boolean;
  favoritable?: boolean;
  copyable?: boolean;
  movable?: boolean;
  remindable?: boolean;
  shareable?: boolean;
  supportsTags?: boolean;
  supportsBranchName?: boolean;
  hasPriorityProperty?: boolean;
  hasAssigneeProperty?: boolean;
  hasStatusProperty?: boolean;
  allCrmCompanies?: boolean;
  favoriteExists?: boolean;
}

function hasLevel(ctx: SoupCommandContext, need: AccessLevel): boolean {
  return ctx.receipt !== null && levelSatisfies(ctx.receipt.level, need);
}

function isTask(ctx: SoupCommandContext): boolean {
  return ctx.entityType === "document" && ctx.facet === "task";
}

function tabNumber(id: N4CommandId): number | null {
  const match = /^soup\.tab-(\d)$/.exec(id);
  return match ? Number(match[1]) : null;
}

function selectionReady(ctx: SoupCommandContext): boolean {
  return ctx.resolvable && (ctx.hasFocus || ctx.selectionCount > 0);
}

export function commandEnabled(id: N4CommandId, ctx: SoupCommandContext): boolean {
  switch (id) {
    case "soup.tab-1":
    case "soup.tab-2":
    case "soup.tab-3":
    case "soup.tab-4":
    case "soup.tab-5":
    case "soup.tab-6":
    case "soup.tab-7":
    case "soup.tab-8":
    case "soup.tab-9":
      return ctx.tabCount >= (tabNumber(id) ?? 0);
    case "soup.filter-by-type":
      return ctx.view === "search";
    case "soup.search-focus":
      return ctx.view === "search";
    case "soup.ask-ai":
      return ctx.view === "search" && ctx.hasSearchQuery;
    case "soup.sort":
    case "soup.filter":
      return ctx.view === "list";
    case "soup.expand-search":
      return ctx.view === "list" && ctx.searchCollapsed;
    case "soup.jump-top":
    case "soup.jump-bottom":
      return ctx.hasRows;
    case "soup.jump-top-gg":
      return ctx.hasRows && ctx.goToScopeActive;
    case "soup.open":
    case "soup.toggle-select":
    case "soup.open-new-split":
      return ctx.hasFocus;
    case "soup.focus-preview":
      return ctx.isPreviewController;
    case "soup.open-replace-preview":
      return ctx.isPreviewController && ctx.hasFocus;
    case "soup.select-all":
      return ctx.hasRows;
    case "soup.command-menu":
      return !ctx.commandMenuOpen;
    case "soup.escape-multi":
      return ctx.selectionCount > 0 || ctx.spotlighted;
    case "soup.next-tab":
    case "soup.prev-tab":
      return ctx.tabCount > 1;
    case "soup-entity.copy-id":
      return true;
    case "soup-entity.mark-done":
    case "soup-entity.mark-not-done":
      return selectionReady(ctx) && hasLevel(ctx, "edit");
    case "soup-entity.mark-unread":
    case "soup-entity.mark-read":
      return selectionReady(ctx) && hasLevel(ctx, "view");
    case "soup-entity.delete":
      return selectionReady(ctx) && Boolean(ctx.deletable) && hasLevel(ctx, "owner");
    case "soup-entity.rename":
      return selectionReady(ctx) && Boolean(ctx.renamable) && hasLevel(ctx, "edit");
    case "soup-entity.favorite":
      return selectionReady(ctx) && Boolean(ctx.favoritable) && hasLevel(ctx, "view");
    case "soup-entity.duplicate":
      return selectionReady(ctx) && Boolean(ctx.copyable) && hasLevel(ctx, "edit");
    case "soup-entity.move-to-folder":
      return selectionReady(ctx) && Boolean(ctx.movable) && hasLevel(ctx, "edit");
    case "soup-entity.copy-link":
      return selectionReady(ctx) && hasLevel(ctx, "view");
    case "soup-entity.copy-branch-name":
      return selectionReady(ctx) && Boolean(ctx.supportsBranchName) && isTask(ctx) && hasLevel(ctx, "view");
    case "soup-entity.remind-me":
      return selectionReady(ctx) && Boolean(ctx.remindable) && hasLevel(ctx, "view");
    case "soup-entity.share":
      return selectionReady(ctx) && Boolean(ctx.shareable) && hasLevel(ctx, "view");
    case "soup-entity.properties":
      return isTask(ctx) && hasLevel(ctx, "edit");
    case "soup-entity.tags":
      return selectionReady(ctx) && Boolean(ctx.supportsTags) && hasLevel(ctx, "edit");
    case "soup-entity.priority":
      return isTask(ctx) && Boolean(ctx.hasPriorityProperty) && hasLevel(ctx, "edit");
    case "soup-entity.assignee":
      return isTask(ctx) && Boolean(ctx.hasAssigneeProperty) && hasLevel(ctx, "edit");
    case "soup-entity.status":
      return isTask(ctx) && Boolean(ctx.hasStatusProperty) && hasLevel(ctx, "edit");
    case "soup-entity.company-stage":
    case "soup-entity.company-owner":
    case "soup-entity.company-revenue":
      return selectionReady(ctx) && Boolean(ctx.allCrmCompanies) && ctx.entityType === "crm_company" && hasLevel(ctx, "edit");
    case "soup-nav.down-j":
    case "soup-nav.up-k":
      return ctx.persistentNav || ctx.hasRows;
    case "soup-nav.down-arrow":
    case "soup-nav.up-arrow":
      return ctx.hasRows;
    case "soup-nav.select-up":
    case "soup-nav.select-down":
      return ctx.hasFocus;
    case "soup-nav.collapse":
      return ctx.focusedIsGroup || ctx.focusedCollapsible;
    case "soup-nav.expand":
      return (ctx.focusedIsGroup && ctx.focusedCollapsed) || ctx.focusedCollapsible;
    case "favorites.open.<favorite>":
      return Boolean(ctx.favoriteExists);
  }
}
