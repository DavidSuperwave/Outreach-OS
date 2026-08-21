import { createHash } from "node:crypto";

/** RFC 4122 DNS namespace. Parent of `ACTIVITY_ID_NAMESPACE`. */
export const UUID_NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function uuidToBytes(uuid: string): Buffer {
  const hex = uuid.replaceAll("-", "");
  if (hex.length !== 32) throw new Error(`malformed uuid: ${uuid}`);
  return Buffer.from(hex, "hex");
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** SHA-1 name-based UUID (RFC 4122 §4.3). Node crypto only — not imported from browser.ts. */
export function uuidv5(name: string, namespace: string): string {
  const hash = createHash("sha1");
  hash.update(uuidToBytes(namespace));
  hash.update(name, "utf8");
  const bytes = Buffer.from(hash.digest().subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

/**
 * Portable activity-fact namespace. Harvested: `activity_events` is a UUIDv5
 * namespace, not a bus topic (N3 `FORBIDDEN_TOPICS`).
 */
export const ACTIVITY_ID_NAMESPACE = uuidv5("activity_events", UUID_NAMESPACE_DNS);

/** Content-derived activity id. Replay of the same content is a no-op. */
export function activityId(namespace: string, content: string): string {
  return uuidv5(content, namespace);
}

export function activityFactContent(input: {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  occurredAt: number;
}): string {
  return `${input.action}:${input.entityType}:${input.entityId}:${input.actorId}:${input.occurredAt}`;
}

export function activityFactId(input: {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  occurredAt: number;
}): string {
  return activityId(ACTIVITY_ID_NAMESPACE, activityFactContent(input));
}
