import { describe, expect, it } from "vitest";
import { fixtureId } from "registry";
import { userPrincipal } from "identity/principal";
import { EntityRegistry } from "registry";
import { PolicyEngine, emptyAccess, grantShare } from "authz";
import { N4_COMMAND_IDS, commandEnabled, type SoupCommandContext } from "./commands.js";

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);
const editorId = fixtureId("user", 9);
const docId = fixtureId("document", 1);

function mint(level: "view" | "edit" | "owner", type: "document" | "crm_company" = "document") {
  const registry = new EntityRegistry();
  const id = type === "document" ? docId : fixtureId("crm_company", 1);
  registry.register({ type, id, tenantId: tenant, createdAt: 1, facet: type === "document" ? "task" : null });
  const ownerState = emptyAccess(ownerId, tenant);
  if (level === "owner") {
    return new PolicyEngine(registry).mint({
      actor: { actor: userPrincipal(ownerId, tenant), kernelUsername: "u", isDeploymentAdmin: false },
      entityType: type,
      entityId: id,
      need: "owner",
      state: ownerState,
    });
  }
  const shared = grantShare(ownerState, editorId, level);
  return new PolicyEngine(registry).mint({
    actor: { actor: userPrincipal(editorId, tenant), kernelUsername: "u", isDeploymentAdmin: false },
    entityType: type,
    entityId: id,
    need: level,
    state: shared,
  });
}

function ctx(overrides: Partial<SoupCommandContext> = {}): SoupCommandContext {
  return {
    receipt: mint("edit"),
    entityType: "document",
    facet: "task",
    resolvable: true,
    view: "list",
    hasRows: true,
    hasFocus: true,
    focusedIsGroup: false,
    focusedCollapsed: false,
    focusedCollapsible: false,
    selectionCount: 1,
    tabCount: 3,
    searchCollapsed: false,
    hasSearchQuery: false,
    isPreviewController: false,
    commandMenuOpen: false,
    spotlighted: false,
    persistentNav: false,
    goToScopeActive: true,
    deletable: true,
    renamable: true,
    favoritable: true,
    copyable: true,
    movable: true,
    remindable: true,
    shareable: true,
    supportsTags: true,
    supportsBranchName: true,
    hasPriorityProperty: true,
    hasAssigneeProperty: true,
    hasStatusProperty: true,
    allCrmCompanies: false,
    favoriteExists: true,
    ...overrides,
  };
}

describe("N4 command enablement (59 rows)", () => {
  it("freezes exactly 59 ledger identities (28+22+8+1)", () => {
    expect(N4_COMMAND_IDS).toHaveLength(59);
    expect(new Set(N4_COMMAND_IDS).size).toBe(59);
    expect(N4_COMMAND_IDS.filter((id) => id.startsWith("soup.") && !id.startsWith("soup-"))).toHaveLength(28);
    expect(N4_COMMAND_IDS.filter((id) => id.startsWith("soup-entity."))).toHaveLength(22);
    expect(N4_COMMAND_IDS.filter((id) => id.startsWith("soup-nav."))).toHaveLength(8);
    expect(N4_COMMAND_IDS.filter((id) => id.startsWith("favorites."))).toHaveLength(1);
  });

  it("every command id is decidable", () => {
    const enabled = ctx();
    for (const id of N4_COMMAND_IDS) {
      expect(typeof commandEnabled(id, enabled)).toBe("boolean");
    }
  });

  it("search-view commands stay off on list view; tab digits respect tabCount", () => {
    expect(commandEnabled("soup.filter-by-type", ctx())).toBe(false);
    expect(commandEnabled("soup.filter-by-type", ctx({ view: "search" }))).toBe(true);
    expect(commandEnabled("soup.filter", ctx({ view: "search" }))).toBe(false);
    expect(commandEnabled("soup.ask-ai", ctx({ view: "search" }))).toBe(false);
    expect(commandEnabled("soup.ask-ai", ctx({ view: "search", hasSearchQuery: true }))).toBe(true);
    expect(commandEnabled("soup.tab-1", ctx({ tabCount: 1 }))).toBe(true);
    expect(commandEnabled("soup.tab-3", ctx({ tabCount: 1 }))).toBe(false);
    expect(commandEnabled("soup.next-tab", ctx({ tabCount: 1 }))).toBe(false);
    expect(commandEnabled("soup.next-tab", ctx({ tabCount: 2 }))).toBe(true);
    expect(commandEnabled("soup.expand-search", ctx({ searchCollapsed: true }))).toBe(true);
    expect(commandEnabled("soup.jump-top-gg", ctx({ goToScopeActive: false }))).toBe(false);
  });

  it("entity actions require receipts; copy-id stays on; CRM commands need crm_company", () => {
    expect(commandEnabled("soup-entity.copy-id", ctx({ resolvable: false, receipt: null }))).toBe(true);
    expect(commandEnabled("soup-entity.delete", ctx({ receipt: mint("edit") }))).toBe(false);
    expect(commandEnabled("soup-entity.delete", ctx({ receipt: mint("owner") }))).toBe(true);
    expect(commandEnabled("soup-entity.properties", ctx({ facet: null }))).toBe(false);
    expect(commandEnabled("soup-entity.priority", ctx())).toBe(true);
    expect(commandEnabled("soup-entity.copy-branch-name", ctx({ facet: null }))).toBe(false);
    expect(
      commandEnabled(
        "soup-entity.company-stage",
        ctx({
          entityType: "crm_company",
          facet: null,
          allCrmCompanies: true,
          receipt: mint("edit", "crm_company"),
        }),
      ),
    ).toBe(true);
    expect(commandEnabled("soup-entity.company-stage", ctx())).toBe(false);
  });

  it("nav collapse/expand and favorites.open follow focus/group state", () => {
    expect(commandEnabled("soup-nav.collapse", ctx())).toBe(false);
    expect(commandEnabled("soup-nav.collapse", ctx({ focusedIsGroup: true }))).toBe(true);
    expect(commandEnabled("soup-nav.expand", ctx({ focusedIsGroup: true, focusedCollapsed: true }))).toBe(true);
    expect(commandEnabled("soup-nav.down-j", ctx({ hasRows: false, persistentNav: true }))).toBe(true);
    expect(commandEnabled("favorites.open.<favorite>", ctx({ favoriteExists: false }))).toBe(false);
    expect(commandEnabled("favorites.open.<favorite>", ctx({ favoriteExists: true }))).toBe(true);
    expect(commandEnabled("soup.escape-multi", ctx({ selectionCount: 0, spotlighted: false }))).toBe(false);
    expect(commandEnabled("soup.command-menu", ctx({ commandMenuOpen: true }))).toBe(false);
  });
});
