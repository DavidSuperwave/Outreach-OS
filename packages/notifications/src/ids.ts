import { createHash } from "node:crypto";

/** URL namespace (RFC 4122) — stable seed for notification ids. */
const URL_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

/** Notifications-specific namespace (uuid v5 of "neuwave.notifications" in URL NS). */
export const NOTIFICATION_NAMESPACE = uuidv5("neuwave.notifications", URL_NAMESPACE);

export function notificationId(eventId: string, recipientId: string): string {
  return uuidv5(`${eventId}:${recipientId}`, NOTIFICATION_NAMESPACE);
}

export function unsubscribeCode(recipientId: string): string {
  return uuidv5(`unsub:${recipientId}`, NOTIFICATION_NAMESPACE);
}

export function uuidv5(name: string, namespace: string): string {
  const ns = uuidToBytes(namespace);
  const hash = createHash("sha1").update(ns).update(name).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function uuidToBytes(uuid: string): Buffer {
  const hex = uuid.replaceAll("-", "");
  if (hex.length !== 32) throw new Error(`invalid uuid namespace: ${uuid}`);
  return Buffer.from(hex, "hex");
}
