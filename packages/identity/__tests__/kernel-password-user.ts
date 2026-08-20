import { DurableObject } from "cloudflare:workers";
import {
  bytesEqual,
  hashPasswordHash,
  hexToBytes,
  mintSessionSecret,
  sessionTokenIdFromSecret,
} from "../src/kernel-session-protocol.js";
import { bytesToHex } from "../src/bytes.js";

/**
 * Miniflare harness for the kernel User DO password/session subset
 * (`createAccount` / `login` / `authenticate` / session revoke). Production
 * sessions stay in kernel UserDurableObject (OD-16); this class is not a
 * second credential authority.
 */
export class KernelPasswordUser extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        token_id TEXT PRIMARY KEY,
        created INTEGER NOT NULL
      )
    `);
  }

  #meta(key: string): string | null {
    const rows = this.ctx.storage.sql
      .exec<{ v: string }>("SELECT v FROM meta WHERE k = ?", key)
      .toArray();
    return rows[0]?.v ?? null;
  }

  #setMeta(key: string, value: string): void {
    this.ctx.storage.sql.exec("INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)", key, value);
  }

  async createAccount(
    username: string,
    displayName: string,
    passwordHash: Uint8Array,
  ): Promise<string | null> {
    if (this.#meta("created") === "1") return null;
    this.#setMeta("created", "1");
    this.#setMeta("username", username);
    this.#setMeta("displayName", displayName);
    this.#setMeta("passwordHashHash", bytesToHex(await hashPasswordHash(passwordHash)));
    return this.#newSession();
  }

  async login(passwordHash: Uint8Array): Promise<string | null> {
    const stored = this.#meta("passwordHashHash");
    if (!stored) return null;
    const actual = hexToBytes(stored);
    const given = await hashPasswordHash(passwordHash);
    if (!bytesEqual(actual, given)) return null;
    return this.#newSession();
  }

  async authenticate(secret: string): Promise<void> {
    let tokenId: string;
    try {
      tokenId = await sessionTokenIdFromSecret(secret);
    } catch {
      throw new Error("invalid session token");
    }
    const rows = this.ctx.storage.sql
      .exec<{ token_id: string }>("SELECT token_id FROM sessions WHERE token_id = ?", tokenId)
      .toArray();
    if (!rows[0]) throw new Error("invalid session token");
  }

  async revokeSession(secret: string): Promise<void> {
    const tokenId = await sessionTokenIdFromSecret(secret);
    this.ctx.storage.sql.exec("DELETE FROM sessions WHERE token_id = ?", tokenId);
  }

  async whoami(): Promise<{ type: "user"; name: string; id: string }> {
    return {
      type: "user",
      name: this.#meta("displayName") ?? "User",
      id: this.#meta("username") ?? "",
    };
  }

  async #newSession(): Promise<string> {
    const { secret, tokenId } = await mintSessionSecret();
    this.ctx.storage.sql.exec(
      "INSERT INTO sessions (token_id, created) VALUES (?, ?)",
      tokenId,
      Date.now(),
    );
    return secret;
  }
}
