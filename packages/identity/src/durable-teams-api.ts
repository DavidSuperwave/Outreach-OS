import { randomId, stableId } from "./ids.js";
import {
  isDeploymentAdmin,
  userPrincipal,
  type ActorContext,
  type DeploymentAdminPolicy,
  type TeamRecord,
  type TeamRole,
} from "./principal.js";
import { TeamAuthError } from "./team-authority.js";
import type { TeamDurableObject } from "./team-do.js";
import type { KernelSession } from "./teams-api.js";

export interface TeamNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub<TeamDurableObject>;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectStub<T> {
  initialize(record: TeamRecord, ownerId: string): Promise<TeamRecord>;
  invite(
    actorId: string,
    inviteeUsername: string,
    role: TeamRole,
    idempotencyKey: string,
  ): Promise<import("./principal.js").InviteRecord>;
  acceptInvite(
    userId: string,
    username: string,
    inviteId: string,
  ): Promise<import("./principal.js").MembershipRow>;
  setMemberRole(actorId: string, userId: string, role: TeamRole): Promise<void>;
  listMembers(actorId: string): Promise<import("./principal.js").MembershipRow[]>;
  roleOf(userId: string): Promise<TeamRole | null>;
  getRecord(): Promise<TeamRecord>;
}

/**
 * TeamsApi backed by TeamDurableObject stubs. Same commands as the in-memory TeamsApi;
 * authority is the DO, not a process Map.
 */
export class DurableTeamsApi {
  readonly users = new Map<string, KernelSession>();

  constructor(
    private readonly teams: TeamNamespace,
    readonly adminPolicy: DeploymentAdminPolicy,
  ) {}

  registerKernelUser(session: KernelSession): void {
    this.users.set(session.username, session);
    this.users.set(session.userId, session);
  }

  actorContext(session: KernelSession, tenantId: string | null = null): ActorContext {
    return {
      actor: userPrincipal(session.userId, tenantId),
      kernelUsername: session.username,
      isDeploymentAdmin: isDeploymentAdmin(session.username, this.adminPolicy),
    };
  }

  #stub(teamId: string): DurableObjectStub<TeamDurableObject> {
    if (!teamId.startsWith("team_")) {
      throw new TeamAuthError("unknown_team", "team not found");
    }
    return this.teams.get(this.teams.idFromName(teamId));
  }

  async createTeam(session: KernelSession, name: string): Promise<TeamRecord> {
    const record: TeamRecord = {
      id: randomId("team"),
      name,
      createdAt: Date.now(),
    };
    return this.#stub(record.id).initialize(record, session.userId);
  }

  async invite(
    session: KernelSession,
    teamId: string,
    inviteeUsername: string,
    role: TeamRole,
    idempotencyKey: string,
  ) {
    return this.#stub(teamId).invite(session.userId, inviteeUsername, role, idempotencyKey);
  }

  async acceptInvite(session: KernelSession, teamId: string, inviteId: string) {
    return this.#stub(teamId).acceptInvite(session.userId, session.username, inviteId);
  }

  async setMemberRole(session: KernelSession, teamId: string, userId: string, role: TeamRole) {
    await this.#stub(teamId).setMemberRole(session.userId, userId, role);
  }

  async listMembers(session: KernelSession, teamId: string) {
    return this.#stub(teamId).listMembers(session.userId);
  }

  async resolveEffectiveRole(session: KernelSession, teamId: string): Promise<TeamRole | null> {
    return this.#stub(teamId).roleOf(session.userId);
  }

  /**
   * Per-user home tenant (OD-1). Idempotent: first call bootstraps owner membership,
   * later calls return the existing Team DO record.
   */
  async ensureHomeTeam(session: KernelSession, name = "Outreach"): Promise<TeamRecord> {
    const id = await stableId("team", `home-team:${session.username}`);
    const stub = this.#stub(id);
    try {
      return await stub.initialize({ id, name, createdAt: Date.now() }, session.userId);
    } catch {
      return stub.getRecord();
    }
  }

  /** Register a wrapper principal for a kernel username that is not a seed fixture. */
  async ensureKernelUser(username: string): Promise<KernelSession> {
    const existing = this.users.get(username);
    if (existing) return existing;
    const session: KernelSession = {
      username,
      userId: await stableId("user", `wrapper-user:${username}`),
    };
    this.registerKernelUser(session);
    return session;
  }
}
