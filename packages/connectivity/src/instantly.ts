import { ConnectivityError } from "./errors.js";

/** Instantly write verbs. Absent from InstantlySession. Separate owner order required. */
export const INSTANTLY_FORBIDDEN_METHODS = [
  "send",
  "activate",
  "start",
  "reply",
  "addLead",
  "pauseCampaign",
  "launchCampaign",
] as const;

export type InstantlyForbiddenMethod = (typeof INSTANTLY_FORBIDDEN_METHODS)[number];

export interface InstantlyCampaign {
  id: string
  name: string
  status: "draft" | "active" | "paused" | "completed"
  accountEmail: string | null
}

export interface InstantlyAccount {
  email: string
  warmupEnabled: boolean
  status: "active" | "paused"
}

export interface InstantlyLead {
  id: string
  email: string
  campaignId: string
  company: string | null
}

export interface InstantlyEmail {
  id: string
  campaignId: string
  leadId: string
  subject: string
  direction: "outbound" | "inbound"
}

export interface InstantlyCampaignAnalytics {
  campaignId: string
  sent: number
  opened: number
  replied: number
}

/**
 * Proposed Instantly Session API (AGENTS.md: propose reads, stop for David).
 * Implemented as observation-gated reads. No send/activate methods exist.
 */
export interface InstantlySession {
  listCampaigns(): Promise<InstantlyCampaign[]>
  getCampaign(id: string): Promise<InstantlyCampaign>
  listAccounts(): Promise<InstantlyAccount[]>
  getAccount(email: string): Promise<InstantlyAccount>
  listLeads(campaignId?: string): Promise<InstantlyLead[]>
  getLead(id: string): Promise<InstantlyLead>
  listEmails(campaignId?: string): Promise<InstantlyEmail[]>
  getCampaignAnalytics(campaignId: string): Promise<InstantlyCampaignAnalytics>
}

export interface Observation {
  title: string
  description: string
}

export interface ObservationAuthorizer {
  authorizeObservation(observation: Observation): Promise<void>
}

export interface InstantlyWorkspace {
  campaigns: InstantlyCampaign[]
  accounts: InstantlyAccount[]
  leads: InstantlyLead[]
  emails: InstantlyEmail[]
}

export function assertInstantlyReadOnly(method: string): void {
  if ((INSTANTLY_FORBIDDEN_METHODS as readonly string[]).includes(method)) {
    throw new ConnectivityError(
      "read_only",
      `Instantly ${method} is not implemented; send/activate require a separate owner order`,
    );
  }
}

export class InstantlySessionImpl implements InstantlySession {
  readonly observations: Observation[] = [];

  constructor(
    private readonly workspace: InstantlyWorkspace,
    private readonly authorizer: ObservationAuthorizer,
  ) {}

  async listCampaigns(): Promise<InstantlyCampaign[]> {
    await this.#observe("List Instantly campaigns", "Read campaign catalog (no send/activate).");
    return this.workspace.campaigns.map((row) => ({ ...row }));
  }

  async getCampaign(id: string): Promise<InstantlyCampaign> {
    await this.#observe("Read Instantly campaign", `Read campaign ${id}.`);
    const row = this.workspace.campaigns.find((item) => item.id === id);
    if (!row) throw new ConnectivityError("unknown_connector", `unknown campaign ${id}`);
    return { ...row };
  }

  async listAccounts(): Promise<InstantlyAccount[]> {
    await this.#observe("List Instantly accounts", "Read sending-account catalog.");
    return this.workspace.accounts.map((row) => ({ ...row }));
  }

  async getAccount(email: string): Promise<InstantlyAccount> {
    await this.#observe("Read Instantly account", `Read account ${email}.`);
    const row = this.workspace.accounts.find((item) => item.email === email);
    if (!row) throw new ConnectivityError("unknown_connector", `unknown account ${email}`);
    return { ...row };
  }

  async listLeads(campaignId?: string): Promise<InstantlyLead[]> {
    await this.#observe("List Instantly leads", "Read lead records.");
    return this.workspace.leads
      .filter((row) => !campaignId || row.campaignId === campaignId)
      .map((row) => ({ ...row }));
  }

  async getLead(id: string): Promise<InstantlyLead> {
    await this.#observe("Read Instantly lead", `Read lead ${id}.`);
    const row = this.workspace.leads.find((item) => item.id === id);
    if (!row) throw new ConnectivityError("unknown_connector", `unknown lead ${id}`);
    return { ...row };
  }

  async listEmails(campaignId?: string): Promise<InstantlyEmail[]> {
    await this.#observe("List Instantly inbox emails", "Read unibox threads.");
    return this.workspace.emails
      .filter((row) => !campaignId || row.campaignId === campaignId)
      .map((row) => ({ ...row }));
  }

  async getCampaignAnalytics(campaignId: string): Promise<InstantlyCampaignAnalytics> {
    await this.#observe("Read Instantly analytics", `Read analytics for ${campaignId}.`);
    const emails = this.workspace.emails.filter((row) => row.campaignId === campaignId);
    return {
      campaignId,
      sent: emails.filter((row) => row.direction === "outbound").length,
      opened: 0,
      replied: emails.filter((row) => row.direction === "inbound").length,
    };
  }

  /** Generic dispatcher used by tests to prove write verbs cannot sneak in. */
  async invoke(method: string): Promise<unknown> {
    assertInstantlyReadOnly(method);
    const fn = (this as unknown as Record<string, unknown>)[method];
    if (typeof fn !== "function") {
      throw new ConnectivityError("unknown_connector", `unknown Instantly method ${method}`);
    }
    return (fn as () => Promise<unknown>).call(this);
  }

  async #observe(title: string, description: string): Promise<void> {
    const observation = { title, description };
    await this.authorizer.authorizeObservation(observation);
    this.observations.push(observation);
  }
}

export const EMPTY_INSTANTLY_WORKSPACE: InstantlyWorkspace = {
  campaigns: [],
  accounts: [],
  leads: [],
  emails: [],
};
