import { nextId } from "./ids.js";
import {
  isDeploymentAdmin,
  userPrincipal,
  type ActorContext,
  type DeploymentAdminPolicy,
  type TeamRecord,
  type TeamRole,
} from "./principal.js";
import { MembershipProjection } from "./projection.js";
import { resolveEffectiveRole } from "./effective-role.js";
import { TeamAuthError, TeamAuthority } from "./team-authority.js";

export interface KernelSession {
  /** Kernel User DO name (username). */
  username: string;
  /** Wrapper user id (ADR-003 typed id). Mapped 1:1 from username in N1 seed fixtures. */
  userId: string;
}

/**
 * Wrapper TeamsApi. Mint only after kernel PublicApi.authenticate() succeeds.
 * Does not extend api.ts (ADR-002 / ADR-014).
 */
export class TeamsApi {
  readonly projection = new MembershipProjection();
  readonly teams = new Map<string, TeamAuthority>();
  readonly users = new Map<string, KernelSession>();

  constructor(readonly adminPolicy: DeploymentAdminPolicy) {}

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

  createTeam(session: KernelSession, name: string): TeamRecord {
    const record: TeamRecord = {
      id: nextId("team"),
      name,
      createdAt: Date.now(),
    };
    const team = new TeamAuthority(record, this.projection);
    team.bootstrapOwner(session.userId);
    this.teams.set(record.id, team);
    return { id: record.id, name: record.name, createdAt: record.createdAt };
  }

  #team(teamId: string): TeamAuthority {
    const team = this.teams.get(teamId);
    if (!team) throw new TeamAuthError("unknown_team", "team not found");
    return team;
  }

  invite(
    session: KernelSession,
    teamId: string,
    inviteeUsername: string,
    role: TeamRole,
    idempotencyKey: string,
  ) {
    return this.#team(teamId).invite(session.userId, inviteeUsername, role, idempotencyKey);
  }

  acceptInvite(session: KernelSession, teamId: string, inviteId: string) {
    return this.#team(teamId).acceptInvite(session.userId, session.username, inviteId);
  }

  setMemberRole(session: KernelSession, teamId: string, userId: string, role: TeamRole) {
    this.#team(teamId).setMemberRole(session.userId, userId, role);
  }

  removeMember(session: KernelSession, teamId: string, userId: string) {
    this.#team(teamId).removeMember(session.userId, userId);
  }

  listMyTeams(session: KernelSession) {
    return this.projection.forUser(session.userId).map((row) => {
      const team = this.#team(row.teamId);
      return { teamId: row.teamId, name: team.team.name, role: row.role };
    });
  }

  listMembers(session: KernelSession, teamId: string) {
    return this.#team(teamId).listMembers(session.userId);
  }

  resolveEffectiveRole(session: KernelSession, teamId: string): TeamRole | null {
    return resolveEffectiveRole(this.projection.all(), session.userId, teamId);
  }
}
