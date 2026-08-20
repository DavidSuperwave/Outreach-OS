import { DurableObject } from "cloudflare:workers";
import { MembershipProjection } from "./projection.js";
import {
  TeamAuthError,
  TeamAuthority,
  type TeamSnapshot,
} from "./team-authority.js";
import type { InviteRecord, MembershipRow, TeamRecord, TeamRole } from "./principal.js";

/**
 * Wrapper Team Durable Object — serialized membership, role, and invite mutations
 * (04-TARGET §1, ADR-005). D1 `memberships` projection remains N3/N4; SQLite in this
 * DO is the N1 authority.
 */
export class TeamDurableObject extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS snapshot (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        json TEXT NOT NULL
      )
    `);
  }

  #load(): TeamAuthority {
    const rows = this.ctx.storage.sql
      .exec<{ json: string }>("SELECT json FROM snapshot WHERE id = 1")
      .toArray();
    if (!rows[0]) throw new TeamAuthError("unknown_team", "team not initialized");
    const snapshot = JSON.parse(rows[0].json) as TeamSnapshot;
    return TeamAuthority.fromSnapshot(snapshot, new MembershipProjection());
  }

  #save(team: TeamAuthority): void {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO snapshot (id, json) VALUES (1, ?)",
      JSON.stringify(team.toSnapshot()),
    );
  }

  async initialize(record: TeamRecord, ownerId: string): Promise<TeamRecord> {
    const existing = this.ctx.storage.sql
      .exec<{ json: string }>("SELECT json FROM snapshot WHERE id = 1")
      .toArray();
    if (existing[0]) throw new TeamAuthError("already_member", "team already bootstrapped");
    const team = new TeamAuthority(record, new MembershipProjection());
    team.bootstrapOwner(ownerId);
    this.#save(team);
    return { id: record.id, name: record.name, createdAt: record.createdAt };
  }

  async invite(
    actorId: string,
    inviteeUsername: string,
    role: TeamRole,
    idempotencyKey: string,
  ): Promise<InviteRecord> {
    const team = this.#load();
    const invite = team.invite(actorId, inviteeUsername, role, idempotencyKey);
    this.#save(team);
    return invite;
  }

  async acceptInvite(userId: string, username: string, inviteId: string): Promise<MembershipRow> {
    const team = this.#load();
    const row = team.acceptInvite(userId, username, inviteId);
    this.#save(team);
    return row;
  }

  async setMemberRole(actorId: string, userId: string, role: TeamRole): Promise<void> {
    const team = this.#load();
    team.setMemberRole(actorId, userId, role);
    this.#save(team);
  }

  async removeMember(actorId: string, userId: string): Promise<void> {
    const team = this.#load();
    team.removeMember(actorId, userId);
    this.#save(team);
  }

  async rename(actorId: string, name: string): Promise<void> {
    const team = this.#load();
    team.rename(actorId, name);
    this.#save(team);
  }

  async listMembers(actorId: string): Promise<MembershipRow[]> {
    return this.#load().listMembers(actorId);
  }

  async roleOf(userId: string): Promise<TeamRole | null> {
    return this.#load().roleOf(userId);
  }

  async getRecord(): Promise<TeamRecord> {
    const snap = this.#load().toSnapshot();
    return { id: snap.id, name: snap.name, createdAt: snap.createdAt };
  }

  async debugSnapshot(): Promise<TeamSnapshot> {
    return this.#load().toSnapshot();
  }
}
