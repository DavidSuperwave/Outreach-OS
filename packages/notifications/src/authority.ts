import { format_title, NOTIFICATION_TYPES, type MuteKey, type NotificationIntent, type NotificationType } from "./catalog.js";
import { NotificationsError } from "./errors.js";
import { notificationId, unsubscribeCode } from "./ids.js";
import type { NotificationRecord, PreferenceMap } from "./types.js";

function defaultPreferences(): PreferenceMap {
  const prefs = {} as PreferenceMap;
  for (const type of NOTIFICATION_TYPES) prefs[type] = true;
  return prefs;
}

function muteId(key: MuteKey): string {
  return `${key.recipientId}\0${key.entityId}\0${key.type ?? "*"}`;
}

/**
 * Per-user notification DO stand-in (ADR-009). Owns the log, seen/unread,
 * per-type preferences, mutes, and digest unsubscribe codes. Unread is
 * derived (`filter !seen`), never stored independently.
 */
export class NotificationAuthority {
  readonly log = new Map<string, NotificationRecord>();
  readonly preferences: PreferenceMap = defaultPreferences();
  readonly mutes = new Map<string, MuteKey>();
  readonly digestPending = new Map<string, string>();
  sessionLive = false;
  digestUnsubscribed = false;
  readonly unsubscribeCode: string;
  #clock = 0;

  constructor(readonly recipientId: string) {
    this.unsubscribeCode = unsubscribeCode(recipientId);
  }

  ingest(intent: NotificationIntent): { notification: NotificationRecord; created: boolean } {
    if (intent.recipientId !== this.recipientId) {
      throw new NotificationsError("unknown_recipient", `intent recipient ${intent.recipientId} != ${this.recipientId}`);
    }
    const id = notificationId(intent.eventId, intent.recipientId);
    const existing = this.log.get(id);
    if (existing) return { notification: existing, created: false };
    this.#clock += 1;
    const row: NotificationRecord = {
      id,
      eventId: intent.eventId,
      recipientId: intent.recipientId,
      type: intent.type,
      entityId: intent.entityId,
      meta: { ...intent.meta },
      title: format_title(intent.type, intent.meta),
      seen: false,
      done: false,
      deleted: false,
      createdAt: this.#clock,
    };
    this.log.set(id, row);
    return { notification: row, created: true };
  }

  list(): NotificationRecord[] {
    return [...this.log.values()].filter((row) => !row.deleted);
  }

  /** Derived unread: unseen, not deleted. Never an independent counter. */
  unreadCount(): number {
    return this.list().filter((row) => !row.seen).length;
  }

  get(id: string): NotificationRecord {
    const row = this.log.get(id);
    if (!row || row.deleted) throw new NotificationsError("unknown_notification", `unknown notification ${id}`);
    return row;
  }

  markSeen(id: string): NotificationRecord {
    const row = this.get(id);
    row.seen = true;
    return row;
  }

  markDone(id: string): NotificationRecord {
    const row = this.get(id);
    row.done = true;
    row.seen = true;
    return row;
  }

  undone(id: string): NotificationRecord {
    const row = this.get(id);
    row.done = false;
    return row;
  }

  delete(id: string): void {
    const row = this.get(id);
    row.deleted = true;
  }

  setPreference(type: NotificationType, optedIn: boolean): void {
    this.preferences[type] = optedIn;
  }

  prefers(type: NotificationType): boolean {
    return this.preferences[type] !== false;
  }

  mute(key: MuteKey): void {
    this.mutes.set(muteId({ ...key, recipientId: this.recipientId }), { ...key, recipientId: this.recipientId });
  }

  unmute(key: MuteKey): void {
    this.mutes.delete(muteId({ ...key, recipientId: this.recipientId }));
  }

  isMuted(entityId: string, type: NotificationType): boolean {
    for (const key of this.mutes.values()) {
      const entityMatch = key.entityId === "*" || key.entityId === entityId;
      const typeMatch = key.type === undefined || key.type === "*" || key.type === type;
      if (entityMatch && typeMatch) return true;
    }
    return false;
  }

  /**
   * Preference / mute evaluated at delivery time, not enqueue/ingest time.
   */
  suppressed(type: NotificationType, entityId: string): boolean {
    return !this.prefers(type) || this.isMuted(entityId, type);
  }

  enqueueDigest(notificationId: string): void {
    this.digestPending.set(notificationId, notificationId);
  }

  takeDigestPending(): string[] {
    const ids = [...this.digestPending.keys()];
    this.digestPending.clear();
    return ids;
  }

  unsubscribe(code: string): void {
    if (code !== this.unsubscribeCode) {
      throw new NotificationsError("invalid_unsubscribe", "unsubscribe code does not match");
    }
    this.digestUnsubscribed = true;
  }
}
