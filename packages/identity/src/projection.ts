import type { MembershipRow } from "./principal.js";

/** D1-shaped membership projection. Sole writer is the Team DO outbox (ADR-005). */
export class MembershipProjection {
  #rows = new Map<string, MembershipRow>();

  static key(userId: string, teamId: string): string {
    return `${userId}|${teamId}`;
  }

  apply(row: MembershipRow | { userId: string; teamId: string; tombstone: true }): void {
    const key = MembershipProjection.key(row.userId, row.teamId);
    if ("tombstone" in row) this.#rows.delete(key);
    else this.#rows.set(key, row);
  }

  all(): MembershipRow[] {
    return [...this.#rows.values()];
  }

  forUser(userId: string): MembershipRow[] {
    return this.all().filter((row) => row.userId === userId);
  }

  forTeam(teamId: string): MembershipRow[] {
    return this.all().filter((row) => row.teamId === teamId);
  }
}
