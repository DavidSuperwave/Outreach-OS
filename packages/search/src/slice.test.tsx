import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { EntityRegistry, fixtureId } from "registry";
import { userPrincipal } from "identity/principal";
import { PolicyEngine, emptyAccess, type Receipt } from "authz";
import { Outbox, envelope, ownerOf } from "control-plane";
import {
  N4_COMMAND_IDS,
  SEARCH_ENTITY_TYPES as SOUP_SEARCH_ENTITY_TYPES,
  commandEnabled,
  isSearchEntityType,
  type SearchEntityType,
  type SoupCommandContext,
} from "soup";
import { SearchSlice, actorContext } from "./slice.js";
import { SEARCH_COMMAND_IDS, N16_PARITY_COMMAND_IDS } from "./commands.js";
import {
  LIVE_D1_FTS5,
  SEARCH_ENTITY_TYPES,
  TITLE_BOOST,
  VECTORIZE,
} from "./types.js";
import { SearchError } from "./errors.js";
import { SearchWorkspace } from "./ui.js";
import { isPoisonBody, titleBoostScore } from "./ranking.js";

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);
const outsiderId = fixtureId("user", 3);
const otherTenant = fixtureId("team", 2);

const GOLDEN_TOKEN = "goldenacme";

const FIXTURES: Record<SearchEntityType, { n: number; title: string; body: string; occurredAt: number }> = {
  document: {
    n: 1,
    title: "AlphaDoc uniquedoc",
    body: `notes mentioning ${GOLDEN_TOKEN} only in the body`,
    occurredAt: 70,
  },
  project: { n: 1, title: "BetaProject uniqueproj", body: "project body tokens", occurredAt: 60 },
  chat: { n: 1, title: "GammaChat uniquechat", body: "chat body tokens", occurredAt: 50 },
  channel: { n: 1, title: "DeltaChannel uniquechn", body: "channel body tokens", occurredAt: 40 },
  email_thread: { n: 1, title: "EpsilonMail uniqueeth", body: "thread body tokens", occurredAt: 30 },
  call: { n: 1, title: "ZetaCall uniquecall", body: "call body tokens", occurredAt: 20 },
  crm_company: {
    n: 1,
    title: `OmegaCorp ${GOLDEN_TOKEN}`,
    body: "company body tokens",
    occurredAt: 10,
  },
};

function ownerActor() {
  return actorContext(userPrincipal(ownerId, tenant));
}

function outsiderActor() {
  return actorContext(userPrincipal(outsiderId, otherTenant));
}

function src(name: string): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), name), "utf8");
}

function mintView(type: SearchEntityType | "calendar_event" | "reminder", n: number): { id: string; receipt: Receipt } {
  const registry = new EntityRegistry();
  const id = fixtureId(type, n);
  registry.register({ type, id, tenantId: tenant, createdAt: 1, facet: type === "document" ? "task" : null });
  const receipt = new PolicyEngine(registry).mint({
    actor: ownerActor(),
    entityType: type,
    entityId: id,
    need: "view",
    state: emptyAccess(ownerId, tenant),
  });
  return { id, receipt };
}

function soupSearchCtx(overrides: Partial<SoupCommandContext> = {}): SoupCommandContext {
  return {
    receipt: null,
    entityType: "document",
    facet: null,
    resolvable: true,
    view: "search",
    hasRows: true,
    hasFocus: true,
    focusedIsGroup: false,
    focusedCollapsed: false,
    focusedCollapsible: false,
    selectionCount: 0,
    tabCount: 1,
    searchCollapsed: false,
    hasSearchQuery: true,
    isPreviewController: false,
    commandMenuOpen: false,
    spotlighted: false,
    persistentNav: false,
    goToScopeActive: false,
    ...overrides,
  };
}

function indexCoverage(slice: SearchSlice, extra: Partial<Record<SearchEntityType, Record<string, unknown>>> = {}) {
  const receipts: Receipt[] = [];
  const ids = {} as Record<SearchEntityType, string>;
  for (const type of SEARCH_ENTITY_TYPES) {
    const spec = FIXTURES[type];
    const minted = mintView(type, spec.n);
    ids[type] = minted.id;
    receipts.push(minted.receipt);
    slice.outbox.append(
      envelope({
        topic: slice.topicFor(type),
        entityType: type,
        entityId: minted.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: spec.occurredAt,
        version: 1,
        payload: { title: spec.title, body: spec.body, ...extra[type] },
        receipt: null,
        correlationId: `idx-${type}`,
      }),
    );
  }
  slice.ingest();
  return { receipts, ids };
}

describe("N16 search (05-MAP row 11 / ADR-007)", () => {
  it("freezes the same 7-type coverage contract as soup (ADR-007)", () => {
    expect(SEARCH_ENTITY_TYPES).toEqual(SOUP_SEARCH_ENTITY_TYPES);
    expect(SEARCH_ENTITY_TYPES).toHaveLength(7);
    expect(SEARCH_ENTITY_TYPES).not.toContain("task");
    expect(isSearchEntityType("calendar_event")).toBe(false);
    expect(isSearchEntityType("reminder")).toBe(false);
    expect(TITLE_BOOST).toBe(3);
    expect(VECTORIZE.status).toBe("deferred");
    expect(LIVE_D1_FTS5.status).toBe("deferred");
    expect(LIVE_D1_FTS5.ddlOwner).toBe("soup-projector");
    expect(ownerOf("soup_search_index").owner).toBe("soup-projector");
    expect(ownerOf("soup_search_index").checkpoint).toBe("soup.search");
  });

  it("golden query: unique crm_company title token ranks first (OD-15 title-boost prototype)", () => {
    const slice = new SearchSlice();
    const { receipts, ids } = indexCoverage(slice);
    expect(slice.plane.search.size()).toBe(7);

    const hits = slice.queryUnified(GOLDEN_TOKEN, receipts);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[0]?.entityId).toBe(ids.crm_company);
    expect(hits[0]?.entityType).toBe("crm_company");
    expect(hits[0]?.title).toContain(GOLDEN_TOKEN);
    const bodyHit = hits.find((hit) => hit.entityId === ids.document);
    expect(bodyHit).toBeDefined();
    expect(hits[0]!.score).toBeGreaterThan(bodyHit!.score);
    expect(hits[0]!.score).toBe(titleBoostScore(FIXTURES.crm_company.title, FIXTURES.crm_company.body, GOLDEN_TOKEN));
    expect(bodyHit!.score).toBe(titleBoostScore(FIXTURES.document.title, FIXTURES.document.body, GOLDEN_TOKEN));
  });

  it("querySimple restricts to one coverage type", () => {
    const slice = new SearchSlice();
    const { receipts, ids } = indexCoverage(slice);
    const hits = slice.querySimple("uniquechat", "chat", receipts);
    expect(hits.every((hit) => hit.entityType === "chat")).toBe(true);
    expect(hits.map((hit) => hit.entityId)).toEqual([ids.chat]);
  });

  it("tombstone de-indexes the entity", () => {
    const slice = new SearchSlice();
    const { receipts, ids } = indexCoverage(slice);
    slice.outbox.append(
      envelope({
        topic: "soup",
        entityType: "crm_company",
        entityId: ids.crm_company,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 99,
        version: 2,
        payload: { title: FIXTURES.crm_company.title, tombstoned: true },
        receipt: null,
        correlationId: "tomb",
      }),
    );
    slice.ingest();
    expect(slice.plane.search.get(ids.crm_company)).toBeUndefined();
    expect(slice.plane.lists.get(ids.crm_company)).toBeUndefined();
    expect(slice.queryUnified(GOLDEN_TOKEN, receipts).map((hit) => hit.entityId)).not.toContain(ids.crm_company);
  });

  it("receipt filter: outsider receipts yield zero hits and titles do not leak", () => {
    const slice = new SearchSlice();
    const { ids } = indexCoverage(slice);
    const secret = FIXTURES.crm_company.title;
    const outsiderRegistry = new EntityRegistry();
    const outsiderDoc = fixtureId("document", 99);
    outsiderRegistry.register({
      type: "document",
      id: outsiderDoc,
      tenantId: otherTenant,
      createdAt: 1,
      facet: null,
    });
    const outsiderReceipt = new PolicyEngine(outsiderRegistry).mint({
      actor: outsiderActor(),
      entityType: "document",
      entityId: outsiderDoc,
      need: "view",
      state: emptyAccess(outsiderId, otherTenant),
    });
    const hits = slice.queryUnified(GOLDEN_TOKEN, [outsiderReceipt]);
    expect(hits).toEqual([]);
    expect(JSON.stringify(hits)).not.toContain(secret);
    expect(JSON.stringify(hits)).not.toContain(ids.crm_company);
    expect(slice.queryUnified(GOLDEN_TOKEN, [])).toEqual([]);
  });

  it("types outside coverage (calendar_event, reminder) are never indexed", () => {
    const slice = new SearchSlice();
    const cal = mintView("calendar_event", 50);
    const reminder = mintView("reminder", 50);
    slice.outbox.append(
      envelope({
        topic: "calls",
        entityType: "calendar_event",
        entityId: cal.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 1,
        version: 1,
        payload: { title: "Planning uniqueoutside", body: "kickoff body" },
        receipt: null,
        correlationId: "cal",
      }),
    );
    slice.outbox.append(
      envelope({
        topic: "soup",
        entityType: "reminder",
        entityId: reminder.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 2,
        version: 1,
        payload: { title: "Ping uniqueoutside", body: "reminder body" },
        receipt: null,
        correlationId: "rmd",
      }),
    );
    slice.ingest();
    expect(slice.plane.search.get(cal.id)).toBeUndefined();
    expect(slice.plane.search.get(reminder.id)).toBeUndefined();
    expect(slice.plane.lists.get(cal.id)?.title).toBe("Planning uniqueoutside");
    const hits = slice.queryUnified("uniqueoutside", [cal.receipt, reminder.receipt]);
    expect(hits).toEqual([]);
  });

  it("re-index of the same id is idempotent", () => {
    const slice = new SearchSlice();
    const { receipts, ids } = indexCoverage(slice);
    const firstSize = slice.plane.search.size();
    const firstHits = slice.queryUnified(GOLDEN_TOKEN, receipts).map((hit) => hit.entityId);
    slice.outbox.append(
      envelope({
        topic: "soup",
        entityType: "crm_company",
        entityId: ids.crm_company,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: FIXTURES.crm_company.occurredAt,
        version: 1,
        payload: { title: FIXTURES.crm_company.title, body: FIXTURES.crm_company.body },
        receipt: null,
        correlationId: "idx-crm_company",
      }),
    );
    expect(slice.ingest()).toBe(0);
    expect(slice.plane.search.size()).toBe(firstSize);
    expect(slice.queryUnified(GOLDEN_TOKEN, receipts).map((hit) => hit.entityId)).toEqual(firstHits);

    const box = new Outbox();
    box.append(
      envelope({
        topic: "documents",
        entityType: "document",
        entityId: ids.document,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 5,
        version: 1,
        payload: { title: "SameDoc", body: "same body once" },
        receipt: null,
        correlationId: "dup",
      }),
    );
    const fresh = new SearchSlice();
    expect(fresh.backfill(box)).toBe(1);
    expect(fresh.backfill(box)).toBe(1);
    expect(fresh.plane.search.size()).toBe(1);
  });

  it("enriches title and snippet from the lists family after ids, never a second store", () => {
    const slice = new SearchSlice();
    const { receipts, ids } = indexCoverage(slice);
    const searchTitle = slice.plane.search.get(ids.project)?.title;
    expect(searchTitle).toBe(FIXTURES.project.title);
    slice.plane.lists.apply(
      envelope({
        topic: "projects",
        entityType: "project",
        entityId: ids.project,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 80,
        version: 2,
        payload: { title: "ListsHydrated uniqueproj", body: "lists snippet body" },
        receipt: null,
        correlationId: "lists-only",
      }),
    );
    expect(slice.plane.search.get(ids.project)?.title).toBe(searchTitle);
    const hits = slice.querySimple("uniqueproj", "project", receipts);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.title).toBe("ListsHydrated uniqueproj");
    expect(hits[0]?.snippet).toBe("lists snippet body");
    expect(hits[0]?.title).not.toBe(searchTitle);
  });

  it("marks empty and pathological bodies index_failed and skips them", () => {
    const slice = new SearchSlice();
    const empty = mintView("document", 10);
    const nul = mintView("chat", 10);
    const ok = mintView("project", 10);
    slice.outbox.append(
      envelope({
        topic: "documents",
        entityType: "document",
        entityId: empty.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 1,
        version: 1,
        payload: { title: "EmptyBody uniquepoison", body: "" },
        receipt: null,
        correlationId: "empty",
      }),
    );
    slice.outbox.append(
      envelope({
        topic: "chats",
        entityType: "chat",
        entityId: nul.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 2,
        version: 1,
        payload: { title: "NulBody uniquepoison", body: "bad\0body" },
        receipt: null,
        correlationId: "nul",
      }),
    );
    slice.outbox.append(
      envelope({
        topic: "projects",
        entityType: "project",
        entityId: ok.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 3,
        version: 1,
        payload: { title: "OkBody uniquepoison", body: "healthy body" },
        receipt: null,
        correlationId: "ok",
      }),
    );
    slice.ingest();
    expect(slice.failed(empty.id)?.reason).toBe("index_failed");
    expect(slice.failed(nul.id)?.reason).toBe("index_failed");
    expect(slice.failed(ok.id)).toBeUndefined();
    expect(slice.plane.search.get(empty.id)).toBeUndefined();
    expect(slice.plane.search.get(nul.id)).toBeUndefined();
    expect(slice.plane.search.get(ok.id)).toBeDefined();
    expect(isPoisonBody("")).toBe(true);
    expect(isPoisonBody("   ")).toBe(true);
    const hits = slice.queryUnified("uniquepoison", [empty.receipt, nul.receipt, ok.receipt]);
    expect(hits.map((hit) => hit.entityId)).toEqual([ok.id]);
  });

  it("backfill rebuilds lists and search from the outbox (DO+alarm stand-in)", () => {
    const slice = new SearchSlice();
    const { receipts, ids } = indexCoverage(slice);
    const snapshot = slice.queryUnified("uniqueproj", receipts);
    const rebuilt = slice.backfill(slice.outbox);
    expect(rebuilt).toBe(7);
    expect(slice.plane.search.size()).toBe(7);
    expect(slice.plane.search.get(ids.document)).toBeDefined();
    expect(slice.queryUnified("uniqueproj", receipts)).toEqual(snapshot);
  });

  it("queryChannel is membership-gated and does not leak titles on deny", () => {
    const slice = new SearchSlice();
    const channel = mintView("channel", 2);
    const chat = mintView("chat", 2);
    const secret = "memberonlychannel";
    slice.outbox.append(
      envelope({
        topic: "channels",
        entityType: "channel",
        entityId: channel.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 1,
        version: 1,
        payload: { title: `Ops ${secret}`, body: "channel body" },
        receipt: null,
        correlationId: "chn",
      }),
    );
    slice.outbox.append(
      envelope({
        topic: "chats",
        entityType: "chat",
        entityId: chat.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 2,
        version: 1,
        payload: { title: "Standup", body: `${secret} transcript`, channelId: channel.id },
        receipt: null,
        correlationId: "chat",
      }),
    );
    slice.ingest();

    const memberHits = slice.queryChannel(secret, channel.id, [channel.receipt, chat.receipt]);
    expect(memberHits.map((hit) => hit.entityId).sort()).toEqual([channel.id, chat.id].sort());

    expect(() => slice.queryChannel(secret, channel.id, [chat.receipt])).toThrow(SearchError);
    expect(() => slice.queryChannel(secret, channel.id, [chat.receipt])).toThrow(/view receipt on the channel/);
    try {
      slice.queryChannel(secret, channel.id, []);
      throw new Error("expected deny");
    } catch (error) {
      expect(error).toBeInstanceOf(SearchError);
      expect(String(error)).not.toContain(secret);
      expect((error as SearchError).message).not.toContain("Ops");
    }
  });
});

describe("N16 chrome + UI", () => {
  it("adds no soup command rows and names the three N4 search-view chrome ids", () => {
    expect(N4_COMMAND_IDS).toHaveLength(59);
    expect(SEARCH_COMMAND_IDS).toHaveLength(0);
    expect(N16_PARITY_COMMAND_IDS).toEqual(["soup.search-focus", "soup.ask-ai", "soup.filter-by-type"]);
    expect(commandEnabled("soup.search-focus", soupSearchCtx())).toBe(true);
    expect(commandEnabled("soup.filter-by-type", soupSearchCtx())).toBe(true);
    expect(commandEnabled("soup.ask-ai", soupSearchCtx({ hasSearchQuery: true }))).toBe(true);
    expect(commandEnabled("soup.ask-ai", soupSearchCtx({ hasSearchQuery: false }))).toBe(false);
    expect(commandEnabled("soup.search-focus", soupSearchCtx({ view: "list" }))).toBe(false);
  });

  it("renders SearchWorkspace on Shell /search with 7-type hits", () => {
    const hits = SEARCH_ENTITY_TYPES.map((type, index) => ({
      entityType: type,
      entityId: fixtureId(type, index + 1),
      tenantId: tenant,
      title: `${type} hit`,
      snippet: `${type} snippet`,
      score: 10 - index,
      updatedAt: 10 - index,
    }));
    const html = renderToString(createElement(SearchWorkspace, { query: GOLDEN_TOKEN, hits }));
    expect(html).toContain("data-shell=\"outreach-os\"");
    expect(html).toContain("data-slice=\"search\"");
    expect(html).toContain("data-surface=\"search.results\"");
    expect(html).toContain("data-split=\"search\"");
    expect(html).toContain("data-path=\"/search/_\"");
    expect(html).toContain("data-command=\"soup.search-focus\"");
    expect(html).toContain("data-command=\"soup.ask-ai\"");
    expect(html).toContain("data-command=\"soup.filter-by-type\"");
    expect(html).toContain(GOLDEN_TOKEN);
    expect(html).toContain("aria-label=\"Search\"");
    for (const type of SEARCH_ENTITY_TYPES) {
      expect(html).toContain(`data-entity-type="${type}"`);
      expect(html).toContain(`data-search-type="${type}"`);
    }
    expect(html).not.toMatch(/macro/i);
  });

  it("keeps browser.ts UI-only (no control-plane or node:crypto)", () => {
    const browser = src("browser.ts");
    const ui = src("ui.tsx");
    const commands = src("commands.ts");
    const types = src("types.ts");
    for (const text of [browser, ui, commands, types]) {
      expect(text).not.toContain("control-plane");
      expect(text).not.toContain("node:crypto");
    }
    expect(browser).toContain("./ui.js");
    expect(ui).toContain('from "shell"');
  });
});
