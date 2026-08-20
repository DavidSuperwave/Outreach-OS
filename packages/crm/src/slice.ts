import {
  AccessStore,
  AuthzError,
  PolicyEngine,
  canToggleCrmKillswitch,
  emptyAccess,
  requireReceipt,
  withMembers,
  withTeamRole,
  type Receipt,
} from "authz";
import {
  ActivityLog,
  IdempotencyStore,
  Outbox,
  envelope,
  requestContext,
  runOnce,
  type ActivityAction,
  type EventEnvelope,
  type RequestContext,
} from "control-plane";
import type { ActorContext } from "identity/principal";
import { EntityRegistry, nextId } from "registry";
import { ProjectionPlane, type SoupItem, type SoupListener } from "soup";
import { enrichmentStub, normalizeDomain, type EnrichmentFetcher, type EnrichmentPort } from "./enrichment.js";
import {
  COMPANY_PROPERTY_IDS,
  KANBAN_NONE,
  STAGE_OPTIONS,
  type ActivitySlot,
  type CompanyKanbanColumn,
  type CompanyProperties,
  type CompanyRecord,
  type CompanyView,
  type ContactRecord,
  type CreateCompanyInput,
  type CreateContactInput,
  type EmailEvidence,
  type EmailLinkSlot,
  type PropertySource,
  type StagedProperty,
} from "./types.js";

export class CrmError extends Error {
  constructor(
    readonly code:
      | "denied"
      | "missing_receipt"
      | "unknown_company"
      | "unknown_contact"
      | "killswitch"
      | "not_crm_contact"
      | "domain_collision",
    message: string,
  ) {
    super(message);
    this.name = "CrmError";
  }
}

export interface CompanyViewResult {
  view: CompanyView;
  receipt: Receipt;
}

export interface ContactView {
  contact: ContactRecord;
  receipt: Receipt;
}

export interface CrmApi {
  createCompany(input: CreateCompanyInput, ctx: RequestContext): CompanyViewResult;
  createContact(input: CreateContactInput, ctx: RequestContext): ContactView;
  hideCompany(ctx: RequestContext): CompanyRecord;
  setCompanyProperty(
    field: "stage" | "owner" | "revenue",
    value: string | number | null,
    ctx: RequestContext,
  ): CompanyRecord;
  moveKanbanCard(toOptionId: string, ctx: RequestContext): CompanyRecord;
  enrichCompany(ctx: RequestContext, fetcher?: EnrichmentFetcher): CompanyRecord;
  setKillswitch(on: boolean, ctx: RequestContext): boolean;
  applyEmailEvidence(evidence: EmailEvidence, ctx: RequestContext): CompanyView;
  retractEmailEvidence(evidenceId: string, ctx: RequestContext): void;
  listCompanies(receipts: readonly Receipt[]): SoupItem[];
  listContacts(companyId: string): ContactRecord[];
  companyView(companyId: string, receipts: readonly Receipt[]): CompanyView;
  kanban(receipts: readonly Receipt[]): CompanyKanbanColumn[];
  subscribe(listener: SoupListener): () => void;
  enrichment: EnrichmentPort;
}

function emptyProperties(): CompanyProperties {
  return {
    stage: { value: null, source: null },
    owner: { value: null, source: null },
    revenue: { value: null, source: null },
  };
}

function setProperty<T>(current: StagedProperty<T>, next: T, source: PropertySource): StagedProperty<T> {
  if (current.source === "user" && source === "enrichment") return current;
  return { value: next, source };
}

/**
 * Per-team CRM DO stand-in (04-TARGET §10). Serialized derived-vs-manual writes
 * + killswitch. Soup type is `crm_company`. Contacts are company-linked records,
 * not a user-graph contacts_service (J15).
 */
export class CrmSlice {
  readonly registry = new EntityRegistry();
  readonly access = new AccessStore();
  readonly engine = new PolicyEngine(this.registry, this.access);
  outbox = new Outbox();
  plane = new ProjectionPlane();
  readonly activity = new ActivityLog();
  readonly idempotency = new IdempotencyStore();
  readonly enrichment = enrichmentStub();
  #companies = new Map<string, CompanyRecord>();
  #contacts = new Map<string, ContactRecord>();
  #emailLinks = new Map<string, EmailLinkSlot>();
  #activitySlots: ActivitySlot[] = [];
  #killswitch = new Map<string, boolean>();
  #clock = 0;

  openApi(): CrmApi {
    return {
      createCompany: (input, ctx) => this.createCompany(input, ctx),
      createContact: (input, ctx) => this.createContact(input, ctx),
      hideCompany: (ctx) => this.hideCompany(ctx),
      setCompanyProperty: (field, value, ctx) => this.setCompanyProperty(field, value, ctx),
      moveKanbanCard: (toOptionId, ctx) => this.moveKanbanCard(toOptionId, ctx),
      enrichCompany: (ctx, fetcher) => this.enrichCompany(ctx, fetcher),
      setKillswitch: (on, ctx) => this.setKillswitch(on, ctx),
      applyEmailEvidence: (evidence, ctx) => this.applyEmailEvidence(evidence, ctx),
      retractEmailEvidence: (evidenceId, ctx) => this.retractEmailEvidence(evidenceId, ctx),
      listCompanies: (receipts) => this.listCompanies(receipts),
      listContacts: (companyId) => this.listContacts(companyId),
      companyView: (companyId, receipts) => this.companyView(companyId, receipts),
      kanban: (receipts) => this.kanban(receipts),
      subscribe: (listener) => this.plane.lists.subscribe(listener),
      enrichment: this.enrichment,
    };
  }

  createCompany(input: CreateCompanyInput, ctx: RequestContext): CompanyViewResult {
    const tenantId = this.#requireTenant(ctx);
    const domain = normalizeDomain(input.domain);
    const run = () => {
      const existing = this.#byDomain(tenantId, domain);
      if (existing && !existing.deleted) {
        const receipt = this.engine.mint({
          actor: ctx.actor,
          entityType: "crm_company",
          entityId: existing.id,
          need: "view",
        });
        return { view: this.#reconcile(existing), receipt };
      }
      const id = nextId("crm_company");
      const ownerId = ctx.actor.actor.id;
      this.registry.register({ type: "crm_company", id, tenantId, createdAt: this.#now(), facet: null });
      this.access.put(id, withTeamRole(emptyAccess(ownerId, tenantId), ownerId, "owner"));
      const createdAt = this.#now();
      const company: CompanyRecord = {
        id,
        tenantId,
        domain,
        title: input.title?.trim() || domain,
        hidden: false,
        deleted: false,
        derived: Boolean(input.derived),
        version: 1,
        createdAt,
        properties: emptyProperties(),
        enrichment: null,
      };
      this.#companies.set(id, company);
      this.#publishCompany(company, ctx, "created");
      const receipt = this.engine.mint({
        actor: ctx.actor,
        entityType: "crm_company",
        entityId: id,
        need: "owner",
      });
      return { view: this.#reconcile(company), receipt };
    };
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  createContact(input: CreateContactInput, ctx: RequestContext): ContactView {
    const tenantId = this.#requireTenant(ctx);
    const company = this.#requireCompany(input.companyId);
    if (company.tenantId !== tenantId) throw new CrmError("denied", "contact tenant mismatch");
    const receipt = ctx.receipt;
    if (!receipt) throw new CrmError("missing_receipt", "createContact requires a company receipt");
    requireReceipt(receipt, "edit", company.id);
    if (receipt.entityType !== "crm_company") {
      throw new CrmError("denied", "CRM contacts are company-linked; receipt must be crm_company");
    }
    const run = () => {
      const email = input.email.trim().toLowerCase();
      const existing = [...this.#contacts.values()].find(
        (row) => row.companyId === company.id && row.email === email && !row.deleted,
      );
      if (existing) {
        return {
          contact: existing,
          receipt: this.engine.mint({
            actor: ctx.actor,
            entityType: "crm_contact",
            entityId: existing.id,
            need: "view",
          }),
        };
      }
      const id = nextId("crm_contact");
      this.registry.register({ type: "crm_contact", id, tenantId, createdAt: this.#now(), facet: null });
      this.access.put(id, {
        ...this.access.require(company.id),
        parentId: company.id,
      });
      const createdAt = this.#now();
      const contact: ContactRecord = {
        id,
        tenantId,
        companyId: company.id,
        email,
        name: input.name?.trim() || email,
        derived: Boolean(input.derived),
        deleted: false,
        version: 1,
        createdAt,
      };
      this.#contacts.set(id, contact);
      this.#publishContact(contact, ctx, "created");
      const contactReceipt = this.engine.mint({
        actor: ctx.actor,
        entityType: "crm_contact",
        entityId: id,
        need: "view",
      });
      return { contact, receipt: contactReceipt };
    };
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  hideCompany(ctx: RequestContext): CompanyRecord {
    return this.#mutateCompany(ctx, "edit", (company) => ({
      ...company,
      hidden: true,
      version: company.version + 1,
    }));
  }

  setCompanyProperty(
    field: "stage" | "owner" | "revenue",
    value: string | number | null,
    ctx: RequestContext,
  ): CompanyRecord {
    return this.#mutateCompany(
      ctx,
      "edit",
      (company) => {
        const properties = { ...company.properties };
        if (field === "revenue") {
          properties.revenue = setProperty(properties.revenue, typeof value === "number" ? value : null, "user");
        } else if (field === "stage") {
          properties.stage = setProperty(properties.stage, typeof value === "string" ? value : null, "user");
        } else {
          properties.owner = setProperty(properties.owner, typeof value === "string" ? value : null, "user");
        }
        return { ...company, properties, version: company.version + 1 };
      },
      "property_changed",
    );
  }

  moveKanbanCard(toOptionId: string, ctx: RequestContext): CompanyRecord {
    const optionId = toOptionId === KANBAN_NONE ? null : toOptionId;
    return this.setCompanyProperty("stage", optionId, ctx);
  }

  enrichCompany(ctx: RequestContext, fetcher?: EnrichmentFetcher): CompanyRecord {
    return this.#mutateCompany(ctx, "edit", (company) => {
      const entry = this.enrichment.enrich(company.domain, fetcher);
      const title = company.title === company.domain && entry.name ? entry.name : company.title;
      const properties = { ...company.properties };
      if (entry.stage !== undefined) {
        properties.stage = setProperty(properties.stage, entry.stage, "enrichment");
      }
      if (entry.revenue !== undefined) {
        properties.revenue = setProperty(properties.revenue, entry.revenue, "enrichment");
      }
      return {
        ...company,
        title,
        properties,
        enrichment: {
          domain: entry.domain,
          name: entry.name,
          description: entry.description,
          source: entry.source,
        },
        version: company.version + 1,
      };
    });
  }

  setKillswitch(on: boolean, ctx: RequestContext): boolean {
    const tenantId = this.#requireTenant(ctx);
    const actorId = ctx.actor.actor.id;
    const sample = [...this.#companies.values()].find((row) => row.tenantId === tenantId);
    const state = sample ? this.access.require(sample.id) : emptyAccess(actorId, tenantId);
    if (!canToggleCrmKillswitch(state, actorId)) {
      throw new CrmError("denied", "killswitch requires team admin");
    }
    this.#killswitch.set(tenantId, on);
    return on;
  }

  applyEmailEvidence(evidence: EmailEvidence, ctx: RequestContext): CompanyView {
    const tenantId = this.#requireTenant(ctx);
    if (this.#killswitch.get(tenantId)) {
      throw new CrmError("killswitch", "CRM sync killswitch is on");
    }
    const domain = normalizeDomain(evidence.domain);
    const existing = this.#byDomain(tenantId, domain);
    const { view, receipt } = existing
      ? {
          view: this.#reconcile(existing),
          receipt: this.engine.mint({
            actor: ctx.actor,
            entityType: "crm_company",
            entityId: existing.id,
            need: "edit",
          }),
        }
      : this.createCompany(
          { domain, title: domain, derived: true },
          requestContext(ctx.actor, { correlationId: ctx.correlationId, idempotencyKey: `ev-co:${tenantId}:${domain}` }),
        );
    const { contact } = this.createContact(
      {
        companyId: view.company.id,
        email: evidence.contactEmail,
        name: evidence.contactName,
        derived: true,
      },
      requestContext(ctx.actor, {
        receipt,
        correlationId: ctx.correlationId,
        idempotencyKey: `ev-ctc:${view.company.id}:${evidence.contactEmail.toLowerCase()}`,
      }),
    );
    const link: EmailLinkSlot = {
      id: evidence.id,
      companyId: view.company.id,
      contactId: contact.id,
      threadId: evidence.threadId ?? null,
      evidenceId: evidence.id,
    };
    this.#emailLinks.set(link.id, link);
    return this.#reconcile(this.#requireCompany(view.company.id));
  }

  retractEmailEvidence(evidenceId: string, ctx: RequestContext): void {
    this.#requireTenant(ctx);
    const link = this.#emailLinks.get(evidenceId);
    if (!link) return;
    this.#emailLinks.delete(evidenceId);
    const company = this.#companies.get(link.companyId);
    if (!company || !company.derived) return;
    const remaining = [...this.#emailLinks.values()].filter((row) => row.companyId === company.id);
    if (remaining.length > 0) return;
    const userTouched =
      company.properties.stage.source === "user" ||
      company.properties.owner.source === "user" ||
      company.properties.revenue.source === "user";
    if (userTouched) return;
    const next = { ...company, deleted: true, version: company.version + 1 };
    this.#companies.set(next.id, next);
    for (const contact of this.#contacts.values()) {
      if (contact.companyId === company.id && contact.derived) {
        this.#contacts.set(contact.id, { ...contact, deleted: true, version: contact.version + 1 });
      }
    }
    this.#publishCompany(next, ctx, "deleted");
  }

  listCompanies(receipts: readonly Receipt[]): SoupItem[] {
    return this.plane.lists.query({ types: ["crm_company"] }, receipts).items;
  }

  listContacts(companyId: string): ContactRecord[] {
    return [...this.#contacts.values()].filter((row) => row.companyId === companyId && !row.deleted);
  }

  companyView(companyId: string, receipts: readonly Receipt[]): CompanyView {
    const company = this.#requireCompany(companyId);
    if (!receipts.some((row) => row.entityId === companyId && row.entityType === "crm_company")) {
      throw new CrmError("denied", "company view requires a crm_company view receipt");
    }
    return this.#reconcile(company);
  }

  kanban(receipts: readonly Receipt[]): CompanyKanbanColumn[] {
    const visible = new Set(this.listCompanies(receipts).map((item) => item.entityId));
    const rows = [...this.#companies.values()].filter(
      (row) => visible.has(row.id) && !row.deleted && !row.hidden,
    );
    const columns: CompanyKanbanColumn[] = STAGE_OPTIONS.map((option) => ({
      optionId: option.id,
      label: option.label,
      items: rows.filter((row) => row.properties.stage.value === option.id),
    }));
    columns.push({
      optionId: KANBAN_NONE,
      label: "None",
      items: rows.filter((row) => !row.properties.stage.value),
    });
    return columns;
  }

  get(id: string): CompanyRecord | undefined {
    return this.#companies.get(id);
  }

  getContact(id: string): ContactRecord | undefined {
    return this.#contacts.get(id);
  }

  killswitchOn(tenantId: string): boolean {
    return this.#killswitch.get(tenantId) === true;
  }

  /** Drop projection and rebuild from outbox. */
  rebuildProjection(): void {
    this.plane = new ProjectionPlane();
    this.plane.rebuild(this.outbox);
  }

  drain(publish: (env: EventEnvelope) => void = () => undefined): void {
    this.outbox.drain(publish);
    this.plane.ingest(this.outbox);
  }

  grantTeamMember(companyId: string, actorId: string, role: "member" | "admin"): void {
    const state = this.access.require(companyId);
    const memberIds = state.memberIds.includes(actorId) ? state.memberIds : [...state.memberIds, actorId];
    this.access.put(companyId, withTeamRole(withMembers(state, memberIds), actorId, role));
    for (const contact of this.#contacts.values()) {
      if (contact.companyId === companyId) {
        this.access.put(contact.id, { ...this.access.require(companyId), parentId: companyId });
      }
    }
  }

  #reconcile(company: CompanyRecord): CompanyView {
    return {
      company,
      contacts: this.listContacts(company.id),
      properties: company.properties,
      emailLinks: [...this.#emailLinks.values()].filter((row) => row.companyId === company.id),
      activity: this.#activitySlots.filter((row) => row.companyId === company.id),
    };
  }

  #mutateCompany(
    ctx: RequestContext,
    need: "view" | "edit" | "owner",
    patch: (company: CompanyRecord) => CompanyRecord,
    action: Extract<ActivityAction, "created" | "edited" | "deleted" | "property_changed"> = "edited",
  ): CompanyRecord {
    const receipt = ctx.receipt;
    if (!receipt) throw new CrmError("missing_receipt", "company mutation requires a receipt");
    requireReceipt(receipt, need, receipt.entityId);
    const current = this.#companies.get(receipt.entityId);
    if (!current) throw new CrmError("unknown_company", `unknown company ${receipt.entityId}`);
    const next = patch(current);
    this.#companies.set(next.id, next);
    this.#publishCompany(next, ctx, action);
    return next;
  }

  #byDomain(tenantId: string, domain: string): CompanyRecord | undefined {
    return [...this.#companies.values()].find(
      (row) => row.tenantId === tenantId && row.domain === domain && !row.deleted,
    );
  }

  #requireCompany(id: string): CompanyRecord {
    const company = this.#companies.get(id);
    if (!company || company.deleted) throw new CrmError("unknown_company", `unknown company ${id}`);
    return company;
  }

  #requireTenant(ctx: RequestContext): string {
    const tenantId = ctx.actor.actor.tenantId;
    if (!tenantId) throw new CrmError("denied", "CRM requires a tenant-scoped actor");
    return tenantId;
  }

  #publishCompany(
    company: CompanyRecord,
    ctx: RequestContext,
    action: Extract<ActivityAction, "created" | "edited" | "deleted" | "property_changed">,
  ): void {
    const tombstoned = company.deleted || company.hidden;
    this.#publish({
      topic: "soup",
      entityType: "crm_company",
      entityId: company.id,
      tenantId: company.tenantId,
      version: company.version,
      ctx,
      action,
      payload: {
        title: company.title,
        facet: null,
        body: company.domain,
        tombstoned,
        domain: company.domain,
        hidden: company.hidden,
        stage: company.properties.stage.value,
        createdAt: company.createdAt,
        [COMPANY_PROPERTY_IDS.stage]: company.properties.stage.value,
        [COMPANY_PROPERTY_IDS.owner]: company.properties.owner.value,
        [COMPANY_PROPERTY_IDS.revenue]: company.properties.revenue.value,
      },
    });
  }

  #publishContact(
    contact: ContactRecord,
    ctx: RequestContext,
    action: Extract<ActivityAction, "created" | "edited" | "deleted">,
  ): void {
    this.#publish({
      topic: "soup",
      entityType: "crm_contact",
      entityId: contact.id,
      tenantId: contact.tenantId,
      version: contact.version,
      ctx,
      action,
      payload: {
        title: contact.name,
        facet: null,
        body: contact.email,
        tombstoned: contact.deleted,
        companyId: contact.companyId,
        createdAt: contact.createdAt,
      },
    });
  }

  #publish(input: {
    topic: "soup";
    entityType: "crm_company" | "crm_contact";
    entityId: string;
    tenantId: string;
    version: number;
    ctx: RequestContext;
    action: Extract<ActivityAction, "created" | "edited" | "deleted" | "property_changed">;
    payload: Record<string, unknown>;
  }): void {
    const occurredAt = this.#now();
    this.outbox.append(
      envelope({
        topic: input.topic,
        entityType: input.entityType,
        entityId: input.entityId,
        tenantId: input.tenantId,
        actorId: input.ctx.actor.actor.id,
        onBehalfOfId: input.ctx.actor.onBehalfOf?.id ?? null,
        occurredAt,
        version: input.version,
        payload: input.payload,
        receipt: {
          level: input.ctx.receipt?.level ?? "owner",
          entityType: input.entityType,
          entityId: input.entityId,
          actorId: input.ctx.actor.actor.id,
        },
        correlationId: input.ctx.correlationId,
      }),
    );
    this.activity.append({
      id: `${input.action}:${input.entityId}:${input.version}`,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.ctx.actor.actor.id,
      tenantId: input.tenantId,
      occurredAt,
    });
    if (input.entityType === "crm_company") {
      this.#activitySlots.push({
        id: `${input.action}:${input.entityId}:${input.version}`,
        companyId: input.entityId,
        action: input.action,
        occurredAt,
      });
    }
    this.drain();
  }

  #now(): number {
    this.#clock += 1;
    return this.#clock;
  }
}

export function actorContext(actor: ActorContext["actor"], kernelUsername = "admin"): ActorContext {
  return { actor, kernelUsername, isDeploymentAdmin: false };
}

export { requestContext };
export { AuthzError };
