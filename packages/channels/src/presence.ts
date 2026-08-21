/**
 * Presence query replacing connection_gateway GET /track/{entity_type}/{entity_id}.
 * J18: /track is an internal JSON presence query (open/ping/close), not the WS upgrade.
 * Kernel PresenceSubscriber {init, add, remove} is the session-side RPC (ADR-009 / C1).
 */

export const N9_KERNEL_RPC = [
  "PresenceSubscriber.init",
  "PresenceSubscriber.add",
  "PresenceSubscriber.remove",
] as const;

export type N9KernelRpc = (typeof N9_KERNEL_RPC)[number];

export type PresenceAction = "open" | "ping" | "close";

export interface PresenceSession {
  sessionId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: PresenceAction;
  lastSeen: number;
}

export interface PresenceSnapshot {
  entityType: string;
  entityId: string;
  /** Path that used to be GET /track/{type}/{id}. */
  trackPath: string;
  sessions: PresenceSession[];
}

export function trackPath(entityType: string, entityId: string): string {
  return `/track/${entityType}/${entityId}`;
}

function trackKey(entityType: string, entityId: string): string {
  return `${entityType}/${entityId}`;
}

/**
 * In-process stand-in for wrapper entity presence (KG-5). Not a second socket plane.
 */
export class PresenceStore {
  #clock = 0;
  #sessions = new Map<string, { actorId: string }>();
  #tracks = new Map<string, Map<string, PresenceSession>>();

  init(sessionId: string, actorId: string): void {
    this.#sessions.set(sessionId, { actorId });
  }

  add(sessionId: string, entityType: string, entityId: string): PresenceSession {
    return this.#set(sessionId, entityType, entityId, "open");
  }

  ping(sessionId: string, entityType: string, entityId: string): PresenceSession {
    return this.#set(sessionId, entityType, entityId, "ping");
  }

  remove(sessionId: string, entityType: string, entityId: string): PresenceSession {
    return this.#set(sessionId, entityType, entityId, "close");
  }

  /**
   * GET /track/{entity_type}/{entity_id} replacement: JSON presence snapshot.
   * Closed sessions are omitted.
   */
  query(entityType: string, entityId: string): PresenceSnapshot {
    const rows = this.#tracks.get(trackKey(entityType, entityId));
    const sessions = rows
      ? [...rows.values()].filter((row) => row.action !== "close")
      : [];
    return {
      entityType,
      entityId,
      trackPath: trackPath(entityType, entityId),
      sessions,
    };
  }

  #set(sessionId: string, entityType: string, entityId: string, action: PresenceAction): PresenceSession {
    const actorId = this.#sessions.get(sessionId)?.actorId;
    if (!actorId) throw new Error(`presence session not initialized: ${sessionId}`);
    this.#clock += 1;
    const row: PresenceSession = {
      sessionId,
      actorId,
      entityType,
      entityId,
      action,
      lastSeen: this.#clock,
    };
    const key = trackKey(entityType, entityId);
    const bucket = this.#tracks.get(key) ?? new Map();
    if (action === "close") bucket.delete(sessionId);
    else bucket.set(sessionId, row);
    this.#tracks.set(key, bucket);
    return row;
  }
}
