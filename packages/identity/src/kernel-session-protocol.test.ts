import { describe, expect, it } from "vitest";
import {
  bytesEqual,
  formatKernelSessionToken,
  hashPasswordHash,
  mintSessionSecret,
  normalizeUsername,
  sessionTokenIdFromSecret,
} from "./kernel-session-protocol.js";
import { parseKernelSessionToken } from "./kernel-types.js";

describe("kernel password/session protocol", () => {
  it("normalizes usernames the same way as UserDurableObject.normalizeUsername", () => {
    expect(normalizeUsername("Admin")).toBe("admin");
    expect(() => normalizeUsername("1bad")).toThrow(/Invalid username/);
  });

  it("stores SHA-256 of the client passwordHash, not the hash itself", async () => {
    const clientHash = new Uint8Array([1, 2, 3]);
    const stored = await hashPasswordHash(clientHash);
    expect(stored).not.toEqual(clientHash);
    expect(bytesEqual(stored, await hashPasswordHash(clientHash))).toBe(true);
    expect(bytesEqual(stored, await hashPasswordHash(new Uint8Array([1, 2, 4])))).toBe(false);
  });

  it("mints username:secret tokens whose secret hashes to a session id", async () => {
    const { secret, tokenId } = await mintSessionSecret();
    expect(await sessionTokenIdFromSecret(secret)).toBe(tokenId);
    const token = formatKernelSessionToken("admin", secret);
    expect(parseKernelSessionToken(token)).toEqual({ username: "admin", secret });
  });
});
