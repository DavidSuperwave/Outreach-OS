import { bytesEqual, bytesFromBase64, bytesToBase64, bytesToHex, hexToBytes } from "./bytes.js";

/**
 * Kernel User DO password/session protocol (pin bf7f762 `user.ts` + `server.ts`).
 * Production credentials stay in kernel UserDurableObject. This module is the byte-level
 * contract N1 tests and the Miniflare harness implement so wrapper identity never invents
 * a second hash scheme.
 */

export function normalizeUsername(username: string): string {
  username = username.toLowerCase();
  if (!username.match(/^[a-z][a-z0-9_]*$/)) {
    throw new Error("Invalid username. Must be alphanumeric starting with a letter.");
  }
  return username;
}

function asDigestSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Server stores SHA-256 of the client argon2id `passwordHash` (SERVICE_SALT + username). */
export async function hashPasswordHash(passwordHash: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", asDigestSource(passwordHash)));
}

export async function mintSessionSecret(): Promise<{ secret: string; tokenId: string }> {
  const sessionToken = new Uint8Array(32);
  crypto.getRandomValues(sessionToken);
  const tokenId = bytesToHex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", asDigestSource(sessionToken))),
  );
  return { secret: bytesToBase64(sessionToken), tokenId };
}

export async function sessionTokenIdFromSecret(secret: string): Promise<string> {
  const tokenBytes = bytesFromBase64(secret);
  return bytesToHex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", asDigestSource(tokenBytes))),
  );
}

export function formatKernelSessionToken(username: string, secret: string): string {
  return `${username}:${secret}`;
}

export { bytesEqual, bytesToHex, hexToBytes };
