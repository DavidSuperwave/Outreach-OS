export interface IdempotencyRecord {
  key: string;
  result: unknown;
  storedAt: number;
}

/** DO-local dedupe window (ruling 4a). Duplicate delivery is a no-op. */
export class IdempotencyStore {
  #rows = new Map<string, IdempotencyRecord>();

  remember<T>(key: string, result: T, at = Date.now()): T {
    const existing = this.#rows.get(key);
    if (existing) return existing.result as T;
    this.#rows.set(key, { key, result, storedAt: at });
    return result;
  }

  has(key: string): boolean {
    return this.#rows.has(key);
  }

  get<T>(key: string): T | undefined {
    return this.#rows.get(key)?.result as T | undefined;
  }

  snapshot(): IdempotencyRecord[] {
    return [...this.#rows.values()].map((row) => ({ ...row }));
  }

  restore(rows: readonly IdempotencyRecord[]): void {
    this.#rows.clear();
    for (const row of rows) this.#rows.set(row.key, { ...row });
  }
}

export function runOnce<T>(store: IdempotencyStore, key: string, fn: () => T): T {
  if (store.has(key)) return store.get<T>(key) as T;
  return store.remember(key, fn());
}
