import {
  DurableObject,
  RpcStub,
  RpcTarget,
  WorkerEntrypoint,
} from "cloudflare:workers";
import { skipRpcValidation, validateRpc } from "capnweb-validate";
import type {
  AccountDescription,
  ApprovalQueue,
  Gatekeeper,
  GatekeeperConnectCallback,
  GatekeeperConnectOptions,
  GatekeeperUser,
  GatekeeperUserVerifier,
  ResourceConfiguratorFrame,
  ResourceDescription,
  SupportedResource,
  VendorDescription,
} from "@gadgets/workshop-shared/gatekeeper";
import type {
  InstantlyAccount,
  InstantlyCampaign,
  InstantlyCampaignAnalytics,
  InstantlyEmail,
  InstantlyLead,
  InstantlySession,
} from "./types.js";
import TYPES_CODE from "./types-code.js";
import {
  InstantlyReadOnlyError,
  instantlyHttp,
  type InstantlyHttp,
} from "./instantly-api.js";

const INSTANTLY_ICON = {
  url:
    "data:image/svg+xml," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' fill='none' stroke='currentColor' stroke-width='20'><rect x='40' y='56' width='176' height='144' rx='16'/><path d='M40 88h176'/><path d='M72 128h112M72 160h72'/></svg>",
    ),
};

type ObservationQueue = Pick<ApprovalQueue, "authorizeObservation"> &
  Partial<{ [Symbol.dispose](): void }>;

export interface InstantlyWorkspace {
  campaigns: InstantlyCampaign[]
  accounts: InstantlyAccount[]
  leads: InstantlyLead[]
  emails: InstantlyEmail[]
}

/** Intraplex ICP fixture used when INSTANTLY_API_KEY is unset. */
export const PILOT_INSTANTLY_WORKSPACE: InstantlyWorkspace = {
  campaigns: [
    {
      id: "camp_intraplex",
      name: "Intraplex ICP — outbound",
      status: "draft",
      accountEmail: "hello@superwave.example",
    },
  ],
  accounts: [
    { email: "hello@superwave.example", warmupEnabled: true, status: "active" },
  ],
  leads: [
    {
      id: "lead_ada",
      email: "ada@intraplex.example",
      campaignId: "camp_intraplex",
      company: "Intraplex",
    },
  ],
  emails: [],
};

export function describeInstantlyVendor(): VendorDescription {
  return {
    displayName: "Instantly",
    url: "https://instantly.ai",
    logo: INSTANTLY_ICON,
    color: "#e8f2ff",
    tagline: "Read campaigns, accounts, leads, and analytics. No send/activate.",
    description:
      "Read-only Instantly Session API for the Outreach OS pilot. Write verbs are not implemented.",
    autoProvisionsAccount: true,
    providesAuth: false,
  };
}

export function describeInstantlyAccount(): AccountDescription {
  return {
    displayName: "Instantly",
    avatar: INSTANTLY_ICON,
    singleton: { tsType: "InstantlySession" },
  };
}

function campaignStatus(value: unknown): InstantlyCampaign["status"] {
  if (value === "active" || value === 1) return "active";
  if (value === "paused" || value === 2) return "paused";
  if (value === "completed" || value === 3) return "completed";
  return "draft";
}

function asList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)) {
    return (payload as { items: unknown[] }).items;
  }
  return [];
}

export async function loadInstantlyWorkspace(http: InstantlyHttp | null): Promise<InstantlyWorkspace> {
  if (!http) return structuredClone(PILOT_INSTANTLY_WORKSPACE);
  const [campaignPayload, accountPayload] = await Promise.all([
    http.get("/api/v2/campaigns?limit=100"),
    http.get("/api/v2/accounts?limit=100"),
  ]);
  const campaigns = asList(campaignPayload).map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id ?? item.campaign_id ?? ""),
      name: String(item.name ?? ""),
      status: campaignStatus(item.status),
      accountEmail: typeof item.email === "string" ? item.email : null,
    };
  }).filter((row) => row.id);
  const accounts = asList(accountPayload).map((row): InstantlyAccount => {
    const item = row as Record<string, unknown>;
    const status: InstantlyAccount["status"] = item.status === 2 || item.status === "paused" ? "paused" : "active";
    return {
      email: String(item.email ?? ""),
      warmupEnabled: Boolean(item.warmup_enabled ?? item.warmupEnabled),
      status,
    };
  }).filter((row) => row.email);
  return { campaigns, accounts, leads: [], emails: [] };
}

@validateRpc()
export class InstantlySessionImpl extends RpcTarget implements InstantlySession {
  readonly #approvalQueue: ObservationQueue;
  readonly #workspace: InstantlyWorkspace;

  constructor(approvalQueue: ObservationQueue, workspace: InstantlyWorkspace) {
    super();
    this.#approvalQueue = approvalQueue;
    this.#workspace = workspace;
  }

  async listCampaigns(): Promise<InstantlyCampaign[]> {
    await this.#observe("List Instantly campaigns", "Read campaign catalog (no send/activate).");
    return this.#workspace.campaigns.map((row) => ({ ...row }));
  }

  async getCampaign(id: string): Promise<InstantlyCampaign> {
    await this.#observe("Read Instantly campaign", `Read campaign ${id}.`);
    const row = this.#workspace.campaigns.find((item) => item.id === id);
    if (!row) throw new Error(`unknown campaign ${id}`);
    return { ...row };
  }

  async listAccounts(): Promise<InstantlyAccount[]> {
    await this.#observe("List Instantly accounts", "Read sending-account catalog.");
    return this.#workspace.accounts.map((row) => ({ ...row }));
  }

  async getAccount(email: string): Promise<InstantlyAccount> {
    await this.#observe("Read Instantly account", `Read account ${email}.`);
    const row = this.#workspace.accounts.find((item) => item.email === email);
    if (!row) throw new Error(`unknown account ${email}`);
    return { ...row };
  }

  async listLeads(campaignId?: string): Promise<InstantlyLead[]> {
    await this.#observe("List Instantly leads", "Read lead records.");
    return this.#workspace.leads
      .filter((row) => !campaignId || row.campaignId === campaignId)
      .map((row) => ({ ...row }));
  }

  async getLead(id: string): Promise<InstantlyLead> {
    await this.#observe("Read Instantly lead", `Read lead ${id}.`);
    const row = this.#workspace.leads.find((item) => item.id === id);
    if (!row) throw new Error(`unknown lead ${id}`);
    return { ...row };
  }

  async listEmails(campaignId?: string): Promise<InstantlyEmail[]> {
    await this.#observe("List Instantly inbox emails", "Read unibox threads.");
    return this.#workspace.emails
      .filter((row) => !campaignId || row.campaignId === campaignId)
      .map((row) => ({ ...row }));
  }

  async getCampaignAnalytics(campaignId: string): Promise<InstantlyCampaignAnalytics> {
    await this.#observe("Read Instantly analytics", `Read analytics for ${campaignId}.`);
    const emails = this.#workspace.emails.filter((row) => row.campaignId === campaignId);
    return {
      campaignId,
      sent: emails.filter((row) => row.direction === "outbound").length,
      opened: 0,
      replied: emails.filter((row) => row.direction === "inbound").length,
    };
  }

  async #observe(title: string, description: string): Promise<void> {
    await this.#approvalQueue.authorizeObservation({ title, description });
  }

  [Symbol.dispose](): void {
    this.#approvalQueue[Symbol.dispose]?.();
  }
}

@validateRpc()
export class InstantlyGatekeeper extends DurableObject<Cloudflare.Env> implements Gatekeeper<InstantlySession> {
  async describe(): Promise<ResourceDescription> {
    return {
      url: "instantly://workspace",
      title: "Instantly workspace",
      snippet: "Read-only Instantly campaigns, accounts, leads, and analytics.",
      suggestedBindingName: "INSTANTLY",
      tsType: "InstantlySession",
    };
  }

  async getTypeScriptTypes(): Promise<string> {
    return TYPES_CODE;
  }

  async getAutoApprovableActions(): Promise<[]> {
    return [];
  }

  async startSession(approvalQueue: RpcStub<ApprovalQueue>): Promise<InstantlySession> {
    const apiKey = this.env.INSTANTLY_API_KEY;
    const http = apiKey ? instantlyHttp(apiKey) : null;
    const workspace = await loadInstantlyWorkspace(http);
    return new InstantlySessionImpl(approvalQueue.dup(), workspace);
  }

  async addObserver(_id: string, _user: Fetcher<GatekeeperUserVerifier>): Promise<void> {}
  async removeObserver(_id: string): Promise<void> {}

  async applyAction(action: number): Promise<void> {
    throw new InstantlyReadOnlyError(`action ${action} is not implemented`);
  }

  async rejectAction(_action: number): Promise<void> {}

  async revertAction(_action: number): Promise<void> {
    throw new InstantlyReadOnlyError("no actions to revert");
  }
}

@validateRpc()
export class InstantlyUserAccount extends WorkerEntrypoint<Cloudflare.Env> implements GatekeeperUser {
  async describe(): Promise<AccountDescription> {
    return describeInstantlyAccount();
  }

  async getSingletonGatekeeperClass(): Promise<DurableObjectClass<Gatekeeper<InstantlySession>>> {
    return this.ctx.exports.InstantlyGatekeeper({});
  }

  async getSupportedResources(): Promise<SupportedResource[]> {
    return [];
  }

  getGatekeeperClassFor(_url: string): never {
    throw new Error("Instantly Gatekeeper has no URL-addressed resources.");
  }

  startResourceConfigurator(_resourceUrlPattern: string): Promise<ResourceConfiguratorFrame> {
    throw new Error("Instantly Gatekeeper has no URL-addressed resources.");
  }

  async ensureResources(_resourceUrlPatterns: string[]): Promise<{ url?: string }> {
    return {};
  }

  async revoke(): Promise<void> {}

  reconnect(): Promise<{ url: string }> {
    throw new Error("Instantly Gatekeeper uses a deployment API key, not a reconnectable OAuth account.");
  }

  async getAuthenticatedEmail(): Promise<string | null> {
    return null;
  }

  @skipRpcValidation()
  async getVerifier(): Promise<Fetcher<GatekeeperUserVerifier>> {
    return this.ctx.exports.InstantlyVerifier({});
  }
}

@validateRpc()
export class InstantlyVerifier extends WorkerEntrypoint<Cloudflare.Env> implements GatekeeperUserVerifier {
  verify(): void {}
}

@validateRpc()
export class GatekeeperVendor extends WorkerEntrypoint<Cloudflare.Env> {
  async describe(): Promise<VendorDescription> {
    return describeInstantlyVendor();
  }

  @skipRpcValidation()
  async createAccount(): Promise<Fetcher<GatekeeperUser>> {
    return this.ctx.exports.InstantlyUserAccount({});
  }

  connectAccount(
    _callback: Fetcher<GatekeeperConnectCallback>,
    _options?: GatekeeperConnectOptions,
  ): Promise<{ url: string }> {
    throw new Error("Instantly Gatekeeper is auto-provisioned and has no connect flow.");
  }

  async getSupportedResources(_options?: { userId?: string }): Promise<SupportedResource[]> {
    return [];
  }

  async getTypeScriptTypes(): Promise<string> {
    return TYPES_CODE;
  }
}
