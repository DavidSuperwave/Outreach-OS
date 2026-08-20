import { NotificationAuthority } from "./authority.js";
import type { DigestWindow, MuteKey, NotificationIntent, NotificationType } from "./catalog.js";
import { DEVICE_REGISTRATION } from "./catalog.js";
import { NotificationEgress, shouldPush } from "./egress.js";
import { NotificationsError } from "./errors.js";
import type { DigestEmail, IngestResult, NotificationRecord, RouteResult } from "./types.js";

export interface NotificationsApi {
  ingest(intent: NotificationIntent): IngestResult;
  list(recipientId: string): NotificationRecord[];
  unreadCount(recipientId: string): number;
  markSeen(recipientId: string, id: string): NotificationRecord;
  markDone(recipientId: string, id: string): NotificationRecord;
  undone(recipientId: string, id: string): NotificationRecord;
  delete(recipientId: string, id: string): void;
  setPreference(recipientId: string, type: NotificationType, optedIn: boolean): void;
  mute(key: MuteKey): void;
  unmute(key: MuteKey): void;
  setSessionLive(recipientId: string, live: boolean): void;
  route(intent: NotificationIntent, opts?: { sessionLive?: boolean }): RouteResult;
  flushDigest(recipientId: string, window?: DigestWindow): DigestEmail | null;
  unsubscribeDigest(recipientId: string, code: string): void;
}

/**
 * In-process map of per-user NotificationAuthority (DO stand-in).
 * Fan-out happens before this map; each recipient serializes independently.
 */
export class NotificationsSlice {
  readonly authorities = new Map<string, NotificationAuthority>();
  readonly egress = new NotificationEgress();
  #clock = 0;

  openApi(): NotificationsApi {
    return {
      ingest: (intent) => this.ingest(intent),
      list: (recipientId) => this.list(recipientId),
      unreadCount: (recipientId) => this.unreadCount(recipientId),
      markSeen: (recipientId, id) => this.markSeen(recipientId, id),
      markDone: (recipientId, id) => this.markDone(recipientId, id),
      undone: (recipientId, id) => this.undone(recipientId, id),
      delete: (recipientId, id) => this.delete(recipientId, id),
      setPreference: (recipientId, type, optedIn) => this.setPreference(recipientId, type, optedIn),
      mute: (key) => this.mute(key),
      unmute: (key) => this.unmute(key),
      setSessionLive: (recipientId, live) => this.setSessionLive(recipientId, live),
      route: (intent, opts) => this.route(intent, opts),
      flushDigest: (recipientId, window) => this.flushDigest(recipientId, window),
      unsubscribeDigest: (recipientId, code) => this.unsubscribeDigest(recipientId, code),
    };
  }

  authority(recipientId: string): NotificationAuthority {
    let row = this.authorities.get(recipientId);
    if (!row) {
      row = new NotificationAuthority(recipientId);
      this.authorities.set(recipientId, row);
    }
    return row;
  }

  ingest(intent: NotificationIntent): IngestResult {
    return this.authority(intent.recipientId).ingest(intent);
  }

  list(recipientId: string): NotificationRecord[] {
    return this.authority(recipientId).list();
  }

  unreadCount(recipientId: string): number {
    return this.authority(recipientId).unreadCount();
  }

  markSeen(recipientId: string, id: string): NotificationRecord {
    return this.authority(recipientId).markSeen(id);
  }

  markDone(recipientId: string, id: string): NotificationRecord {
    return this.authority(recipientId).markDone(id);
  }

  undone(recipientId: string, id: string): NotificationRecord {
    return this.authority(recipientId).undone(id);
  }

  delete(recipientId: string, id: string): void {
    this.authority(recipientId).delete(id);
  }

  setPreference(recipientId: string, type: NotificationType, optedIn: boolean): void {
    this.authority(recipientId).setPreference(type, optedIn);
  }

  mute(key: MuteKey): void {
    this.authority(key.recipientId).mute(key);
  }

  unmute(key: MuteKey): void {
    this.authority(key.recipientId).unmute(key);
  }

  setSessionLive(recipientId: string, live: boolean): void {
    this.authority(recipientId).sessionLive = live;
  }

  /**
   * Ingest + egress. Duplicate ingest is a no-op. Preferences/mutes evaluated
   * at delivery time. Live session → in-app, skip push. Push port still throws
   * `push_deferred` if invoked.
   */
  route(intent: NotificationIntent, opts: { sessionLive?: boolean } = {}): RouteResult {
    const user = this.authority(intent.recipientId);
    if (opts.sessionLive !== undefined) user.sessionLive = opts.sessionLive;
    const { notification, created } = user.ingest(intent);
    const live = user.sessionLive;
    const skippedPush = live === true || !shouldPush(live);
    if (!created) {
      return { notification, created, delivered: [], skippedPush, suppressed: false };
    }
    const suppressed = user.suppressed(intent.type, intent.entityId);
    if (suppressed) {
      return { notification, created, delivered: [], skippedPush: true, suppressed: true };
    }
    this.#clock += 1;
    const delivered = [this.egress.inApp.deliver(notification, this.#clock)];
    user.enqueueDigest(notification.id);
    this.egress.digest.enqueue(notification);
    return { notification, created, delivered, skippedPush, suppressed: false };
  }

  flushDigest(recipientId: string, window?: DigestWindow): DigestEmail | null {
    const user = this.authority(recipientId);
    const range = window ? { start: window.start, end: window.end } : undefined;
    return this.egress.digest.flushDigest(recipientId, {
      unsubscribed: user.digestUnsubscribed,
      unsubscribeCode: user.unsubscribeCode,
      window: range,
      at: ++this.#clock,
    });
  }

  unsubscribeDigest(recipientId: string, code: string): void {
    this.authority(recipientId).unsubscribe(code);
  }

  registerDevice(): never {
    throw new NotificationsError(
      "device_registration_parked",
      DEVICE_REGISTRATION.note,
    );
  }
}
