export const MEMORY_STALE_MS = 24 * 60 * 60 * 1000;
export const MEMORY_MAX_WORDS = 3000;

export interface MemoryProfile {
  userId: string
  text: string
  refreshedAt: number
  trigger: "activity" | "manual"
}

export class MemoryStore {
  #rows = new Map<string, MemoryProfile>();

  get(userId: string): MemoryProfile | null {
    return this.#rows.get(userId) ?? null;
  }

  isStale(userId: string, now: number): boolean {
    const row = this.#rows.get(userId);
    if (!row) return true;
    return now - row.refreshedAt >= MEMORY_STALE_MS;
  }

  /** OD-28: refresh on user activity, never a daily whole-workspace sweep. */
  refreshOnActivity(userId: string, text: string, now: number): MemoryProfile {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const clipped = words.slice(0, MEMORY_MAX_WORDS).join(" ");
    const row: MemoryProfile = { userId, text: clipped, refreshedAt: now, trigger: "activity" };
    this.#rows.set(userId, row);
    return row;
  }

  regenerate(userId: string, text: string, now: number): MemoryProfile {
    return this.refreshOnActivity(userId, text, now);
  }

  /** Explicitly unsupported. */
  sweepWorkspace(): never {
    throw new Error("OD-28 forbids a daily whole-workspace memory sweep");
  }
}
