import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { fixtureId, resetIdSequence } from "registry";
import { userPrincipal } from "identity/principal";
import { ownerOf } from "control-plane";
import { commandEnabled as chromeEnabled, defaultChromeContext } from "shell";
import { commandEnabled as soupEnabled, soupItemType, type SoupCommandContext } from "soup";
import { CrmSlice, actorContext, requestContext, CrmError } from "./slice.js";
import { dryRunIdentityMapping, CRM_TABLES } from "./mapping.js";
import { CRM_COMMAND_IDS, CRM_COMMAND_FREEZE_COUNT, N12_PARITY_COMMAND_IDS } from "./commands.js";
import { STAGE_OPTION_IDS, KANBAN_NONE } from "./types.js";
import { CompanyWorkspace } from "./ui.js";
import * as crmIndex from "./index.js";

const tenant = fixtureId("team", 1);
const otherTenant = fixtureId("team", 2);
const ownerId = fixtureId("user", 1);
const teammateId = fixtureId("user", 2);

function ownerActor() {
  return actorContext(userPrincipal(ownerId, tenant));
}

function teammateActor() {
  return actorContext(userPrincipal(teammateId, tenant), "member");
}

function soupCtx(overrides: Partial<SoupCommandContext> = {}): SoupCommandContext {
  return {
    receipt: null,
    entityType: "crm_company",
    facet: null,
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
    favoritable: false,
    copyable: true,
    movable: false,
    remindable: true,
    shareable: true,
    supportsTags: true,
    supportsBranchName: false,
    hasPriorityProperty: false,
    hasAssigneeProperty: false,
    hasStatusProperty: false,
    allCrmCompanies: true,
    favoriteExists: true,
    ...overrides,
  };
}

describe("N12 CRM companies/contacts/enrichment (05-MAP row 10)", () => {
  it("maps legacy CRM tables without writing (OD-1 Branch A)", () => {
    expect(CRM_TABLES).toHaveLength(5);
    const mapped = dryRunIdentityMapping(CRM_TABLES.map((table, index) => ({ table, pgId: index + 1 })));
    expect(mapped.every((row) => row.wrote === false)).toBe(true);
    expect(mapped.map((row) => row.role)).toEqual(["company", "contact", "email_link", "directory", "hidden"]);
    expect(mapped[0]).toMatchObject({
      entityType: "crm_company",
      mappedId: fixtureId("crm_company", 1),
      wrote: false,
    });
    expect(mapped[1]).toMatchObject({
      entityType: "crm_contact",
      mappedId: fixtureId("crm_contact", 2),
      wrote: false,
    });
    const slice = new CrmSlice();
    expect(slice.registry.get(mapped[0]!.mappedId)).toBeNull();
    expect(slice.registry.get(mapped[1]!.mappedId)).toBeNull();
  });

  it("company view reconciles linked contacts, email-link slots, and Stage/Owner/Revenue", () => {
    resetIdSequence();
    const slice = new CrmSlice();
    const api = slice.openApi();
    const { view, receipt } = api.createCompany(
      { domain: "intraplex.example", title: "Intraplex" },
      requestContext(ownerActor(), { correlationId: "co-1" }),
    );
    expect(view.company.domain).toBe("intraplex.example");
    expect(soupItemType("crm_company")).toBe("crm_company");
    expect(soupItemType("crm_contact")).toBeNull();

    const { contact } = api.createContact(
      { companyId: view.company.id, email: "ada@intraplex.example", name: "Ada" },
      requestContext(ownerActor(), { receipt, correlationId: "ctc-1" }),
    );
    expect(contact.companyId).toBe(view.company.id);
    expect(contact.email).toBe("ada@intraplex.example");

    const writeCtx = requestContext(ownerActor(), { receipt, correlationId: "prop-1" });
    api.setCompanyProperty("stage", STAGE_OPTION_IDS.qualified, writeCtx);
    api.setCompanyProperty("owner", ownerId, writeCtx);
    api.setCompanyProperty("revenue", 12000, writeCtx);

    const reconciled = api.companyView(view.company.id, [receipt]);
    expect(reconciled.contacts.map((row) => row.email)).toEqual(["ada@intraplex.example"]);
    expect(reconciled.properties.stage.value).toBe(STAGE_OPTION_IDS.qualified);
    expect(reconciled.properties.owner.value).toBe(ownerId);
    expect(reconciled.properties.revenue.value).toBe(12000);
    expect(reconciled.emailLinks).toEqual([]);
    expect(reconciled.activity.length).toBeGreaterThan(0);
    expect(api.listCompanies([receipt]).map((item) => item.title)).toEqual(["Intraplex"]);
  });

  it("companies kanban groups by Stage over the same Soup projection", () => {
    resetIdSequence();
    const slice = new CrmSlice();
    const api = slice.openApi();
    const a = api.createCompany(
      { domain: "a.example", title: "Alpha" },
      requestContext(ownerActor(), { correlationId: "a" }),
    );
    const b = api.createCompany(
      { domain: "b.example", title: "Beta" },
      requestContext(ownerActor(), { correlationId: "b" }),
    );
    api.setCompanyProperty(
      "stage",
      STAGE_OPTION_IDS.lead,
      requestContext(ownerActor(), { receipt: a.receipt, correlationId: "a-s" }),
    );
    api.setCompanyProperty(
      "stage",
      STAGE_OPTION_IDS.proposal,
      requestContext(ownerActor(), { receipt: b.receipt, correlationId: "b-s" }),
    );
    const receipts = [a.receipt, b.receipt];
    const soupIds = api.listCompanies(receipts).map((item) => item.entityId).sort();
    const kanbanIds = api
      .kanban(receipts)
      .flatMap((column) => column.items.map((item) => item.id))
      .sort();
    expect(kanbanIds).toEqual(soupIds);
    expect(api.kanban(receipts).find((column) => column.optionId === STAGE_OPTION_IDS.lead)?.items[0]?.title).toBe(
      "Alpha",
    );
    expect(api.kanban(receipts).find((column) => column.optionId === STAGE_OPTION_IDS.proposal)?.items).toHaveLength(1);
    api.moveKanbanCard(
      STAGE_OPTION_IDS.negotiation,
      requestContext(ownerActor(), { receipt: a.receipt, correlationId: "a-move" }),
    );
    expect(
      api.kanban(receipts).find((column) => column.optionId === STAGE_OPTION_IDS.negotiation)?.items[0]?.id,
    ).toBe(a.view.company.id);
    expect(api.kanban(receipts).find((column) => column.optionId === KANBAN_NONE)).toBeDefined();
  });

  it("CRM contacts are company-linked records, not a user-graph contacts_service", () => {
    expect("contacts_service" in crmIndex).toBe(false);
    resetIdSequence();
    const slice = new CrmSlice();
    const api = slice.openApi();
    const { view, receipt } = api.createCompany(
      { domain: "linked.example" },
      requestContext(ownerActor(), { correlationId: "link" }),
    );
    expect(() =>
      api.createContact(
        { companyId: view.company.id, email: "x@linked.example" },
        requestContext(ownerActor(), { correlationId: "no-receipt" }),
      ),
    ).toThrow(CrmError);
    const { contact } = api.createContact(
      { companyId: view.company.id, email: "x@linked.example", name: "X" },
      requestContext(ownerActor(), { receipt, correlationId: "ctc" }),
    );
    expect(contact.companyId).toBe(view.company.id);
    expect(slice.registry.resolve(contact.id, "crm_contact").type).toBe("crm_contact");
    expect(api.listContacts(view.company.id)).toHaveLength(1);
  });

  it("enrichment stub never fetches and never overwrites user-entered fields", () => {
    resetIdSequence();
    const slice = new CrmSlice();
    const api = slice.openApi();
    const { view, receipt } = api.createCompany(
      { domain: "enrich.example", title: "User Name" },
      requestContext(ownerActor(), { correlationId: "en" }),
    );
    api.setCompanyProperty(
      "stage",
      STAGE_OPTION_IDS.qualified,
      requestContext(ownerActor(), { receipt, correlationId: "user-stage" }),
    );
    api.enrichment.put({
      domain: "enrich.example",
      name: "Directory Name",
      description: "from apollo",
      source: "apollo-stub",
      stage: STAGE_OPTION_IDS.lead,
      revenue: 99,
    });
    let invoked = 0;
    const fetcher = () => {
      invoked += 1;
      throw new Error("enrichment fetcher must not run in N12");
    };
    const enriched = api.enrichCompany(requestContext(ownerActor(), { receipt, correlationId: "en-run" }), fetcher);
    expect(invoked).toBe(0);
    expect(enriched.title).toBe("User Name");
    expect(enriched.properties.stage.value).toBe(STAGE_OPTION_IDS.qualified);
    expect(enriched.properties.stage.source).toBe("user");
    expect(enriched.properties.revenue.value).toBe(99);
    expect(enriched.properties.revenue.source).toBe("enrichment");
    expect(enriched.enrichment?.source).toBe("apollo-stub");
  });

  it("email evidence populates/depopulates derived rows; killswitch blocks sync", () => {
    resetIdSequence();
    const slice = new CrmSlice();
    const api = slice.openApi();
    const evidence = {
      id: "ev-1",
      domain: "mail.example",
      contactEmail: "pat@mail.example",
      contactName: "Pat",
      threadId: null as string | null,
    };
    const populated = api.applyEmailEvidence(evidence, requestContext(ownerActor(), { correlationId: "ev" }));
    expect(populated.company.derived).toBe(true);
    expect(populated.contacts.map((row) => row.email)).toEqual(["pat@mail.example"]);
    expect(populated.emailLinks).toHaveLength(1);
    expect(populated.emailLinks[0]?.threadId).toBeNull();
    const evReceipt = slice.engine.mint({
      actor: ownerActor(),
      entityType: "crm_company",
      entityId: populated.company.id,
      need: "view",
    });

    api.retractEmailEvidence("ev-1", requestContext(ownerActor(), { correlationId: "re" }));
    expect(slice.get(populated.company.id)?.deleted).toBe(true);
    expect(api.listCompanies([evReceipt])).toHaveLength(0);

    const { receipt } = api.createCompany(
      { domain: "held.example", title: "Held" },
      requestContext(ownerActor(), { correlationId: "held" }),
    );
    api.setKillswitch(true, requestContext(ownerActor(), { receipt, correlationId: "ks" }));
    expect(slice.killswitchOn(tenant)).toBe(true);
    expect(() =>
      api.applyEmailEvidence(
        { id: "ev-2", domain: "held.example", contactEmail: "z@held.example" },
        requestContext(ownerActor(), { correlationId: "blocked" }),
      ),
    ).toThrow(/killswitch/);
  });

  it("domain-keys per team; the same domain in another tenant is a different company", () => {
    resetIdSequence();
    const slice = new CrmSlice();
    const api = slice.openApi();
    const a = api.createCompany(
      { domain: "https://WWW.Shared.example/about" },
      requestContext(ownerActor(), { correlationId: "t1" }),
    );
    expect(a.view.company.domain).toBe("shared.example");
    const again = api.createCompany(
      { domain: "shared.example" },
      requestContext(ownerActor(), { correlationId: "t1b" }),
    );
    expect(again.view.company.id).toBe(a.view.company.id);
    const other = api.createCompany(
      { domain: "shared.example" },
      requestContext(actorContext(userPrincipal(fixtureId("user", 9), otherTenant)), { correlationId: "t2" }),
    );
    expect(other.view.company.id).not.toBe(a.view.company.id);
    expect(other.view.company.tenantId).toBe(otherTenant);
  });

  it("hides a company from Soup; teammate views, cannot edit; cross-tenant mint denies", () => {
    resetIdSequence();
    const slice = new CrmSlice();
    const api = slice.openApi();
    const { view, receipt } = api.createCompany(
      { domain: "secret.example", title: "Secret" },
      requestContext(ownerActor(), { correlationId: "sec" }),
    );
    slice.grantTeamMember(view.company.id, teammateId, "member");
    const teammateReceipt = slice.engine.mint({
      actor: teammateActor(),
      entityType: "crm_company",
      entityId: view.company.id,
      need: "view",
    });
    expect(api.listCompanies([teammateReceipt]).map((item) => item.title)).toEqual(["Secret"]);
    expect(() =>
      slice.engine.mint({
        actor: teammateActor(),
        entityType: "crm_company",
        entityId: view.company.id,
        need: "edit",
      }),
    ).toThrow(/lacks edit/);
    expect(() =>
      slice.engine.mint({
        actor: actorContext(userPrincipal(teammateId, otherTenant)),
        entityType: "crm_company",
        entityId: view.company.id,
        need: "view",
      }),
    ).toThrow(/tenant/);

    api.hideCompany(requestContext(ownerActor(), { receipt, correlationId: "hide" }));
    expect(api.listCompanies([receipt])).toHaveLength(0);

    expect(() => api.setKillswitch(true, requestContext(teammateActor(), { correlationId: "ks-deny" }))).toThrow(
      /killswitch/,
    );
  });

  it("duplicate create with the same idempotency key is a no-op; rebuild restores Soup", () => {
    resetIdSequence();
    const slice = new CrmSlice();
    const api = slice.openApi();
    const ctx = requestContext(ownerActor(), { idempotencyKey: "co-once", correlationId: "id1" });
    const first = api.createCompany({ domain: "once.example", title: "Once" }, ctx);
    const second = api.createCompany(
      { domain: "once.example", title: "Once" },
      requestContext(ownerActor(), { idempotencyKey: "co-once", correlationId: "id2" }),
    );
    expect(second.view.company.id).toBe(first.view.company.id);
    expect(api.listCompanies([first.receipt])).toHaveLength(1);
    slice.rebuildProjection();
    expect(api.listCompanies([first.receipt])[0]?.title).toBe("Once");
  });

  it("names the 3 CRM soup-entity commands and has no Instantly send/activate", () => {
    expect(CRM_COMMAND_IDS).toHaveLength(CRM_COMMAND_FREEZE_COUNT);
    expect(N12_PARITY_COMMAND_IDS).toEqual(
      expect.arrayContaining([
        "go-to.companies",
        "soup-entity.company-stage",
        "soup-entity.company-owner",
        "soup-entity.company-revenue",
      ]),
    );
    expect(chromeEnabled("go-to.companies", defaultChromeContext({ signedIn: true }))).toBe(true);

    resetIdSequence();
    const slice = new CrmSlice();
    const { receipt } = slice.openApi().createCompany(
      { domain: "cmd.example" },
      requestContext(ownerActor(), { correlationId: "cmd" }),
    );
    const soup = soupCtx({ receipt, allCrmCompanies: true, entityType: "crm_company" });
    expect(soupEnabled("soup-entity.company-stage", soup)).toBe(true);
    expect(soupEnabled("soup-entity.company-owner", soup)).toBe(true);
    expect(soupEnabled("soup-entity.company-revenue", soup)).toBe(true);
    expect(soupEnabled("soup-entity.favorite", soup)).toBe(false);

    const api = slice.openApi();
    expect("send" in api).toBe(false);
    expect("activate" in api).toBe(false);
    expect(JSON.stringify(api)).not.toMatch(/instantly/i);
  });

  it("renders CompanyWorkspace and CompanyKanban on Shell /companies without Macro branding", () => {
    resetIdSequence();
    const slice = new CrmSlice();
    const api = slice.openApi();
    const { view, receipt } = api.createCompany(
      { domain: "visible.example", title: "Visible co" },
      requestContext(ownerActor(), { correlationId: "ui" }),
    );
    api.setCompanyProperty(
      "stage",
      STAGE_OPTION_IDS.lead,
      requestContext(ownerActor(), { receipt, correlationId: "ui-s" }),
    );
    api.createContact(
      { companyId: view.company.id, email: "ceo@visible.example", name: "CEO" },
      requestContext(ownerActor(), { receipt, correlationId: "ui-c" }),
    );
    const html = renderToString(
      createElement(CompanyWorkspace, {
        items: api.listCompanies([receipt]),
        columns: api.kanban([receipt]),
        view: api.companyView(view.company.id, [receipt]),
        composeOpen: true,
        contactComposeOpen: true,
        draft: "visible.example",
        contactDraft: "ceo@visible.example",
      }),
    );
    expect(html).toContain("data-shell=\"outreach-os\"");
    expect(html).toContain("data-split=\"companies\"");
    expect(html).toContain("data-path=\"/companies/_\"");
    expect(html).toContain("href=\"/companies\"");
    expect(html).toContain("Visible co");
    expect(html).toContain("CEO");
    expect(html).toContain("data-surface=\"soup.companies.kanban\"");
    expect(html).toContain("data-surface=\"crm.company-view\"");
    expect(html).toContain("data-surface=\"crm.contacts\"");
    expect(html).toContain("data-surface=\"crm.email-links\"");
    expect(html).toContain("data-command=\"block-company\"");
    expect(html).toContain("data-command=\"block-contact\"");
    expect(html).toContain("data-property=\"stage\"");
    expect(html).toContain("Companies (N12): CRM directory, contacts, enrichment. Kanban by Stage.");
    expect(html).not.toMatch(/macro/i);
  });

  it("registers crm_company and crm_contact in STORAGE_OWNERS", () => {
    expect(ownerOf("crm_company").owner).toBe("crm.CrmSlice");
    expect(ownerOf("crm_company").kind).toBe("do");
    expect(ownerOf("crm_contact").kind).toBe("d1");
    expect(ownerOf("crm_contact").owner).toBe("crm-projector");
  });
});
