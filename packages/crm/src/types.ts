/** Stage system key (`pdef_stage`) — option palette is the N12 seed (N8 leftover). */
export const COMPANY_PROPERTY_IDS = {
  stage: "pdef_stage",
  owner: "pdef_owner",
  revenue: "pdef_revenue",
} as const;

export const STAGE_OPTION_IDS = {
  lead: "opt_stage_lead",
  qualified: "opt_stage_qualified",
  proposal: "opt_stage_proposal",
  negotiation: "opt_stage_negotiation",
  closedWon: "opt_stage_closed_won",
  closedLost: "opt_stage_closed_lost",
} as const;

export const KANBAN_NONE = "none";

export const STAGE_OPTIONS = [
  { id: STAGE_OPTION_IDS.lead, key: "lead", label: "Lead" },
  { id: STAGE_OPTION_IDS.qualified, key: "qualified", label: "Qualified" },
  { id: STAGE_OPTION_IDS.proposal, key: "proposal", label: "Proposal" },
  { id: STAGE_OPTION_IDS.negotiation, key: "negotiation", label: "Negotiation" },
  { id: STAGE_OPTION_IDS.closedWon, key: "closed_won", label: "Closed Won" },
  { id: STAGE_OPTION_IDS.closedLost, key: "closed_lost", label: "Closed Lost" },
] as const;

export type StageOptionId = (typeof STAGE_OPTION_IDS)[keyof typeof STAGE_OPTION_IDS];

export type PropertySource = "user" | "enrichment" | null;

export interface StagedProperty<T> {
  value: T;
  source: PropertySource;
}

export interface CompanyProperties {
  stage: StagedProperty<string | null>;
  owner: StagedProperty<string | null>;
  revenue: StagedProperty<number | null>;
}

/** Soup type is `crm_company`. Domain-keyed per team. */
export interface CompanyRecord {
  id: string;
  tenantId: string;
  domain: string;
  title: string;
  hidden: boolean;
  deleted: boolean;
  derived: boolean;
  version: number;
  createdAt: number;
  properties: CompanyProperties;
  enrichment: EnrichmentSnapshot | null;
}

/**
 * Company-linked CRM contact. Not the J15 user-graph (`contacts_service`).
 * Registry type `crm_contact`; not a Soup item type.
 */
export interface ContactRecord {
  id: string;
  tenantId: string;
  companyId: string;
  email: string;
  name: string;
  derived: boolean;
  deleted: boolean;
  version: number;
  createdAt: number;
}

/** Slot filled by N11 email-link deriver. Empty until mailbox evidence arrives. */
export interface EmailLinkSlot {
  id: string;
  companyId: string;
  contactId: string | null;
  threadId: string | null;
  evidenceId: string;
}

/** Slot filled by N17 activity/frecency. Local CRM facts may appear; the feed is later. */
export interface ActivitySlot {
  id: string;
  companyId: string;
  action: string;
  occurredAt: number;
}

export interface EnrichmentSnapshot {
  domain: string;
  name: string;
  description: string;
  source: "directory-stub" | "apollo-stub" | "unfurl-stub";
}

export interface EmailEvidence {
  id: string;
  domain: string;
  contactEmail: string;
  contactName?: string;
  threadId?: string | null;
}

export interface CreateCompanyInput {
  domain: string;
  title?: string;
  derived?: boolean;
}

export interface CreateContactInput {
  companyId: string;
  email: string;
  name?: string;
  derived?: boolean;
}

export interface CompanyKanbanColumn {
  optionId: string;
  label: string;
  items: readonly CompanyRecord[];
}

export interface CompanyView {
  company: CompanyRecord;
  contacts: readonly ContactRecord[];
  properties: CompanyProperties;
  emailLinks: readonly EmailLinkSlot[];
  activity: readonly ActivitySlot[];
}
