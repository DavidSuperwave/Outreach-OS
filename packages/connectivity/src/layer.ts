import { AccessStore, PolicyEngine } from "authz";
import { ActivityLog, Outbox, envelope, requestContext } from "control-plane";
import type { ActorContext } from "identity/principal";
import { EntityRegistry } from "registry";
import { AiUsageLedger } from "./ai-usage.js";
import { AutomationStore } from "./automations.js";
import { CompletionsGateway } from "./completions.js";
import { TeamConnectionStore, type ConnectorVendorId } from "./connectors.js";
import { ConnectivityError } from "./errors.js";
import { GitHubConnector } from "./github.js";
import { ImportLedger } from "./import-staging.js";
import {
  EMPTY_INSTANTLY_WORKSPACE,
  InstantlySessionImpl,
  type InstantlySession,
  type InstantlyWorkspace,
} from "./instantly.js";
import { McpSurface } from "./mcp.js";
import { MemoryStore } from "./memory.js";
import { blockedSafeFetch, type SafeFetch } from "./safe-fetch.js";
import { SessionApprovalQueue } from "./session.js";
import { WebhookRegistry } from "./webhooks.js";

export interface ConnectivityApis {
  connectors: TeamConnectionStore
  webhooks: WebhookRegistry
  automations: AutomationStore
  memory: MemoryStore
  imports: ImportLedger
  mcp: McpSurface
  completions: CompletionsGateway
  usage: AiUsageLedger
  github: GitHubConnector
  instantlyWorkspace: InstantlyWorkspace
  openInstantlySession(actor: ActorContext): InstantlySession
  readProposeApproveResume(actor: ActorContext): Promise<{
    campaigns: number
    approved: boolean
    resumed: boolean
  }>
}

/**
 * N10 wrapper layer. Kernel Overseer/gatekeeper-mcp remain the agent runtime.
 * This freezes connector, webhook, automation, memory, import, and Instantly-read contracts.
 */
export class ConnectivityLayer {
  readonly registry = new EntityRegistry();
  readonly access = new AccessStore();
  readonly engine = new PolicyEngine(this.registry, this.access);
  readonly outbox = new Outbox();
  readonly activity = new ActivityLog();
  readonly usage = new AiUsageLedger();
  readonly connectors = new TeamConnectionStore();
  readonly automations = new AutomationStore();
  readonly memory = new MemoryStore();
  readonly imports = new ImportLedger();
  readonly mcp = new McpSurface();
  readonly approval = new SessionApprovalQueue();
  instantlyWorkspace: InstantlyWorkspace = structuredClone(EMPTY_INSTANTLY_WORKSPACE);
  readonly webhooks: WebhookRegistry;
  readonly github: GitHubConnector;
  readonly completions: CompletionsGateway;
  #clock = 0;

  constructor(
    private readonly tenantId: string,
    private readonly ownerId: string,
    fetch: SafeFetch = blockedSafeFetch(),
  ) {
    this.webhooks = new WebhookRegistry(fetch);
    this.github = new GitHubConnector(this.registry, this.access, tenantId, ownerId);
    this.completions = new CompletionsGateway(this.usage, async (req) => `ok:${req.model}`);
  }

  openApi(): ConnectivityApis {
    return {
      connectors: this.connectors,
      webhooks: this.webhooks,
      automations: this.automations,
      memory: this.memory,
      imports: this.imports,
      mcp: this.mcp,
      completions: this.completions,
      usage: this.usage,
      github: this.github,
      instantlyWorkspace: this.instantlyWorkspace,
      openInstantlySession: (actor) => this.openInstantlySession(actor),
      readProposeApproveResume: (actor) => this.readProposeApproveResume(actor),
    };
  }

  openInstantlySession(actor: ActorContext): InstantlySessionImpl {
    if (actor.actor.tenantId !== this.tenantId) {
      throw new ConnectivityError("denied", "cross-tenant Instantly session");
    }
    return new InstantlySessionImpl(this.instantlyWorkspace, this.approval);
  }

  connectVendor(vendorId: ConnectorVendorId, actor: ActorContext, handle = "cred_handle"): ReturnType<TeamConnectionStore["connect"]> {
    return this.connectors.connect({
      vendorId,
      displayName: vendorId,
      scope: vendorId === "github" ? "team" : "user",
      actor,
      credentialHandle: handle,
    });
  }

  /**
   * 05-MAP row 14: read Instantly (observation) → propose GitHub write → approve → resume.
   */
  async readProposeApproveResume(actor: ActorContext): Promise<{ campaigns: number; approved: boolean; resumed: boolean }> {
    const session = this.openInstantlySession(actor);
    const campaigns = await session.listCampaigns();
    const mirrors = [...this.github.mirrors.values()];
    if (mirrors.length === 0) throw new ConnectivityError("unknown_connector", "no GitHub PR mirror to write");
    const proposal = this.github.proposeComment(mirrors[0]!.id, "ship it");
    this.approval.submitAction(proposal, "Comment on GitHub pull request");
    this.approval.approve(proposal.actionId);
    this.github.apply(proposal);
    this.approval.markApplied(proposal.actionId);
    this.#publish(actor, "opened");
    return { campaigns: campaigns.length, approved: true, resumed: this.approval.actions.get(proposal.actionId)?.status === "applied" };
  }

  #publish(actor: ActorContext, action: "opened"): void {
    const occurredAt = this.#now();
    this.outbox.append(
      envelope({
        topic: "webhooks",
        entityType: "foreign_entity",
        entityId: [...this.github.mirrors.keys()][0] ?? this.ownerId,
        tenantId: this.tenantId,
        actorId: actor.actor.id,
        onBehalfOfId: actor.onBehalfOf?.id ?? null,
        occurredAt,
        version: 1,
        payload: { action },
        receipt: null,
        correlationId: `n10:${occurredAt}`,
      }),
    );
    this.activity.append({
      id: `${action}:${occurredAt}`,
      action,
      entityType: "foreign_entity",
      entityId: this.ownerId,
      actorId: actor.actor.id,
      tenantId: this.tenantId,
      occurredAt,
    });
    this.outbox.drain(() => undefined);
  }

  #now(): number {
    this.#clock += 1;
    return this.#clock;
  }
}

export function actorContext(actor: ActorContext["actor"], kernelUsername = "admin"): ActorContext {
  return { actor, kernelUsername, isDeploymentAdmin: kernelUsername === "admin" };
}

export { requestContext };
