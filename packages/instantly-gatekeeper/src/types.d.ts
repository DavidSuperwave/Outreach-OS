/** Instantly campaign a gadget or agent may read. */
export interface InstantlyCampaign {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  accountEmail: string | null;
}

/** Sending account in the Instantly workspace. */
export interface InstantlyAccount {
  email: string;
  warmupEnabled: boolean;
  status: "active" | "paused";
}

/** Lead attached to a campaign. */
export interface InstantlyLead {
  id: string;
  email: string;
  campaignId: string;
  company: string | null;
}

/** Unibox email row. */
export interface InstantlyEmail {
  id: string;
  campaignId: string;
  leadId: string;
  subject: string;
  direction: "outbound" | "inbound";
}

/** Aggregate campaign analytics. */
export interface InstantlyCampaignAnalytics {
  campaignId: string;
  sent: number;
  opened: number;
  replied: number;
}

/**
 * Read-only Instantly Session API.
 *
 * Use this to list campaigns, accounts, leads, unibox emails, and campaign
 * analytics. There are no send, activate, start, reply, addLead,
 * pauseCampaign, or launchCampaign methods.
 */
export interface InstantlySession {
  /** List campaigns in the connected Instantly workspace. */
  listCampaigns(): Promise<InstantlyCampaign[]>;
  /** Read one campaign by id. Throws if the campaign is unknown. */
  getCampaign(id: string): Promise<InstantlyCampaign>;
  /** List sending accounts. */
  listAccounts(): Promise<InstantlyAccount[]>;
  /** Read one sending account by email. Throws if unknown. */
  getAccount(email: string): Promise<InstantlyAccount>;
  /** List leads, optionally filtered by campaign id. */
  listLeads(campaignId?: string): Promise<InstantlyLead[]>;
  /** Read one lead by id. Throws if unknown. */
  getLead(id: string): Promise<InstantlyLead>;
  /** List unibox emails, optionally filtered by campaign id. */
  listEmails(campaignId?: string): Promise<InstantlyEmail[]>;
  /** Read sent/opened/replied counts for one campaign. */
  getCampaignAnalytics(campaignId: string): Promise<InstantlyCampaignAnalytics>;
}
