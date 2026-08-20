import { DEVICE_REGISTRATION } from "./catalog.js";
import { NotificationsError } from "./errors.js";
import type { DeliveryReceipt, DigestEmail, NotificationRecord } from "./types.js";

export interface InAppPort {
  deliver(notification: NotificationRecord, at?: number): DeliveryReceipt;
}

export interface DigestPort {
  enqueue(notification: NotificationRecord): void;
  flushDigest(userId: string, at?: number): DigestEmail | null;
}

export interface PushPort {
  deliver(notification: NotificationRecord): never;
}

/** Last-online gate: push only when the session is not live (ADR-009). */
export function shouldPush(sessionLive: boolean): boolean {
  return sessionLive !== true;
}

/**
 * In-app channel = kernel `/api` session-push stand-in (C1). Records a
 * receipt with `channel: "in_app"`. Live kernel websocket is leftover.
 */
export class InAppEgress {
  readonly receipts: DeliveryReceipt[] = [];
  readonly #seen = new Set<string>();

  deliver(notification: NotificationRecord, at = Date.now()): DeliveryReceipt {
    const key = `${notification.id}:in_app`;
    const existing = this.receipts.find((row) => row.notificationId === notification.id && row.channel === "in_app");
    if (existing || this.#seen.has(key)) {
      return existing ?? {
        notificationId: notification.id,
        recipientId: notification.recipientId,
        channel: "in_app",
        at,
      };
    }
    this.#seen.add(key);
    const receipt: DeliveryReceipt = {
      notificationId: notification.id,
      recipientId: notification.recipientId,
      channel: "in_app",
      at,
    };
    this.receipts.push(receipt);
    return receipt;
  }
}

/**
 * Email digest stand-in. No SMTP / Gmail send. Unsubscribe codes preserved.
 * Live mailbox digest path is leftover.
 */
export class DigestEgress {
  readonly receipts: DeliveryReceipt[] = [];
  readonly queued = new Map<string, Map<string, NotificationRecord>>();

  enqueue(notification: NotificationRecord): void {
    let bucket = this.queued.get(notification.recipientId);
    if (!bucket) {
      bucket = new Map();
      this.queued.set(notification.recipientId, bucket);
    }
    bucket.set(notification.id, notification);
  }

  pending(userId: string): NotificationRecord[] {
    return [...(this.queued.get(userId)?.values() ?? [])];
  }

  flushDigest(
    userId: string,
    opts: {
      unsubscribed?: boolean;
      unsubscribeCode: string;
      window?: { start: number; end: number };
      at?: number;
    },
  ): DigestEmail | null {
    if (opts.unsubscribed) {
      this.queued.delete(userId);
      return null;
    }
    const bucket = this.queued.get(userId);
    if (!bucket || bucket.size === 0) return null;
    let rows = [...bucket.values()];
    if (opts.window) {
      rows = rows.filter((row) => row.createdAt >= opts.window!.start && row.createdAt <= opts.window!.end);
    }
    if (rows.length === 0) return null;
    for (const row of rows) bucket.delete(row.id);
    if (bucket.size === 0) this.queued.delete(userId);
    const at = opts.at ?? Date.now();
    const email: DigestEmail = {
      recipientId: userId,
      channel: "email",
      notificationIds: rows.map((row) => row.id),
      titles: rows.map((row) => row.title),
      unsubscribeCode: opts.unsubscribeCode,
      window: opts.window ?? null,
    };
    this.receipts.push({
      notificationId: rows[0]!.id,
      recipientId: userId,
      channel: "email",
      at,
      unsubscribeCode: opts.unsubscribeCode,
    });
    return email;
  }
}

/**
 * Mobile push port. Exists so the core never changes shape (ADR-009).
 * Always throws `push_deferred`. No APNS / FCM / SNS.
 */
export class PushEgress {
  deliver(_notification: NotificationRecord): never {
    void _notification;
    void DEVICE_REGISTRATION;
    throw new NotificationsError(
      "push_deferred",
      "push_deferred: mobile push is deferred until a native client exists (OD-3 / OD-9); no APNS/FCM/SNS",
    );
  }
}

export class NotificationEgress {
  readonly inApp = new InAppEgress();
  readonly digest = new DigestEgress();
  readonly push = new PushEgress();
}
