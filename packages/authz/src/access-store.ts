import { AuthzError } from "./receipt.js";
import type { AccessState } from "./access-state.js";

/**
 * In-process stand-in for owning-DO share state (ADR-004).
 * Authority path reads this; D1 `entity_access_index` is N4 and never the mint path.
 */
export class AccessStore {
  #rows = new Map<string, AccessState>();

  put(entityId: string, state: AccessState): void {
    this.#rows.set(entityId, state);
  }

  get(entityId: string): AccessState | undefined {
    return this.#rows.get(entityId);
  }

  require(entityId: string): AccessState {
    const state = this.#rows.get(entityId);
    if (!state) throw new AuthzError("unregistered", `no owning-DO access state for ${entityId}`);
    return state;
  }

  /** Walk parentId chain; cycle-safe. Used by project_access folder inheritance. */
  ancestors(entityId: string): AccessState[] {
    const out: AccessState[] = [];
    const seen = new Set<string>();
    let current = this.#rows.get(entityId);
    let id: string | null = current?.parentId ?? null;
    while (id && !seen.has(id)) {
      seen.add(id);
      const parent = this.#rows.get(id);
      if (!parent) break;
      out.push(parent);
      id = parent.parentId;
    }
    return out;
  }
}
