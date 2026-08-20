import { nextId } from "./ids.js";
import {
  canMutateTeam,
  type InviteRecord,
  type MembershipRow,
  type TeamRecord,
  type TeamRole,
} from "./principal.js";
import { MembershipProjection } from "./projection.js";

export class TeamAuthError extends Error {
  constructor(
    readonly code:
      | "not_a_member"
      | "forbidden"
      | "invite_consumed"
      | "invite_missing"
      | "already_member"
      | "last_owner"
      | "unknown_team"
      | "duplicate_idempotency",
    message: string,
  ) {
    super(message);
    this.name = "TeamAuthError";
  }
}

interface StoredTeam extends TeamRecord {
  members: Map<string, TeamRole>;
  invites: Map<string, InviteRecord>;
  idempotency: Map<string, string>;
}

/** Durable snapshot of one team's authority. TeamDurableObject persists this in SQLite. */
export interface TeamSnapshot {
  id: string;
  name: string;
  createdAt: number;
  members: Array<{ userId: string; role: TeamRole }>;
  invites: InviteRecord[];
  idempotency: Array<[string, string]>;
}

/**
 * Team Durable Object core: serialized membership, role, and invite mutations.
 * One instance per team. Cross-team reads go through MembershipProjection.
 */
export class TeamAuthority {
  readonly team: StoredTeam;
  readonly projection: MembershipProjection;

  constructor(record: TeamRecord, projection: MembershipProjection) {
    this.team = {
      ...record,
      members: new Map(),
      invites: new Map(),
      idempotency: new Map(),
    };
    this.projection = projection;
  }

  get id(): string {
    return this.team.id;
  }

  #now(): number {
    return Date.now();
  }

  #roleOf(userId: string): TeamRole | null {
    return this.team.members.get(userId) ?? null;
  }

  #requireMutator(actorId: string): TeamRole {
    const role = this.#roleOf(actorId);
    if (!canMutateTeam(role)) {
      throw new TeamAuthError("forbidden", "team mutations require owner or admin");
    }
    return role!;
  }

  #project(userId: string, role: TeamRole | null): void {
    if (role === null) {
      this.projection.apply({ userId, teamId: this.id, tombstone: true });
    } else {
      this.projection.apply({
        userId,
        teamId: this.id,
        role,
        updatedAt: this.#now(),
      });
    }
  }

  bootstrapOwner(userId: string): void {
    if (this.team.members.size) throw new TeamAuthError("already_member", "team already bootstrapped");
    this.team.members.set(userId, "owner");
    this.#project(userId, "owner");
  }

  invite(
    actorId: string,
    inviteeUsername: string,
    role: TeamRole,
    idempotencyKey: string,
  ): InviteRecord {
    this.#requireMutator(actorId);
    const existing = this.team.idempotency.get(idempotencyKey);
    if (existing) {
      const invite = this.team.invites.get(existing);
      if (!invite) throw new TeamAuthError("duplicate_idempotency", "idempotency key collision");
      return invite;
    }
    const invite: InviteRecord = {
      id: nextId("invite"),
      teamId: this.id,
      inviteeUsername,
      role,
      createdBy: actorId,
      idempotencyKey,
      consumed: false,
    };
    this.team.invites.set(invite.id, invite);
    this.team.idempotency.set(idempotencyKey, invite.id);
    return invite;
  }

  acceptInvite(userId: string, username: string, inviteId: string): MembershipRow {
    const invite = this.team.invites.get(inviteId);
    if (!invite) throw new TeamAuthError("invite_missing", "invite not found");
    if (invite.consumed) {
      if (invite.consumedBy === userId) {
        const role = this.#roleOf(userId);
        if (!role) throw new TeamAuthError("invite_consumed", "invite already used");
        return {
          userId,
          teamId: this.id,
          role,
          updatedAt: this.#now(),
        };
      }
      throw new TeamAuthError("invite_consumed", "invite already used");
    }
    if (invite.inviteeUsername !== username) {
      throw new TeamAuthError("forbidden", "invite is not addressed to this user");
    }
    if (this.team.members.has(userId)) {
      throw new TeamAuthError("already_member", "already a member of this team");
    }
    invite.consumed = true;
    invite.consumedBy = userId;
    this.team.members.set(userId, invite.role);
    this.#project(userId, invite.role);
    return {
      userId,
      teamId: this.id,
      role: invite.role,
      updatedAt: this.#now(),
    };
  }

  setMemberRole(actorId: string, userId: string, role: TeamRole): void {
    this.#requireMutator(actorId);
    if (!this.team.members.has(userId)) {
      throw new TeamAuthError("not_a_member", "user is not a member");
    }
    if (this.#roleOf(userId) === "owner" && role !== "owner") {
      const owners = [...this.team.members.values()].filter((item) => item === "owner");
      if (owners.length === 1) {
        throw new TeamAuthError("last_owner", "cannot demote the last owner");
      }
    }
    this.team.members.set(userId, role);
    this.#project(userId, role);
  }

  removeMember(actorId: string, userId: string): void {
    this.#requireMutator(actorId);
    if (!this.team.members.has(userId)) {
      throw new TeamAuthError("not_a_member", "user is not a member");
    }
    if (this.#roleOf(userId) === "owner") {
      const owners = [...this.team.members.values()].filter((item) => item === "owner");
      if (owners.length === 1) {
        throw new TeamAuthError("last_owner", "cannot remove the last owner");
      }
    }
    this.team.members.delete(userId);
    this.#project(userId, null);
  }

  rename(actorId: string, name: string): void {
    this.#requireMutator(actorId);
    this.team.name = name;
  }

  listMembers(actorId: string): MembershipRow[] {
    if (!this.#roleOf(actorId)) {
      throw new TeamAuthError("forbidden", "only members can list the team");
    }
    return this.projection.forTeam(this.id);
  }

  roleOf(userId: string): TeamRole | null {
    return this.#roleOf(userId);
  }

  toSnapshot(): TeamSnapshot {
    return {
      id: this.team.id,
      name: this.team.name,
      createdAt: this.team.createdAt,
      members: [...this.team.members.entries()].map(([userId, role]) => ({ userId, role })),
      invites: [...this.team.invites.values()],
      idempotency: [...this.team.idempotency.entries()],
    };
  }

  static fromSnapshot(snapshot: TeamSnapshot, projection: MembershipProjection): TeamAuthority {
    const team = new TeamAuthority(
      { id: snapshot.id, name: snapshot.name, createdAt: snapshot.createdAt },
      projection,
    );
    for (const [key, inviteId] of snapshot.idempotency) {
      team.team.idempotency.set(key, inviteId);
    }
    for (const invite of snapshot.invites) {
      team.team.invites.set(invite.id, invite);
    }
    for (const member of snapshot.members) {
      team.team.members.set(member.userId, member.role);
      team.#project(member.userId, member.role);
    }
    return team;
  }
}
