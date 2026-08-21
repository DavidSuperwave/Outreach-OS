import { DurableTeamsApi } from "../src/durable-teams-api.js";
import {
  formatKernelSessionToken,
  normalizeUsername,
} from "../src/kernel-session-protocol.js";
import { parseKernelSessionToken } from "../src/kernel-types.js";
import type { KernelPasswordUser } from "./kernel-password-user.js";

export interface KernelUserNamespace {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): DurableObjectStub<KernelPasswordUser>;
}

interface DurableObjectStub<T> {
  createAccount(
    username: string,
    displayName: string,
    passwordHash: Uint8Array,
  ): Promise<string | null>;
  login(passwordHash: Uint8Array): Promise<string | null>;
  authenticate(secret: string): Promise<void>;
  revokeSession(secret: string): Promise<void>;
  whoami(): Promise<{ type: "user"; name: string; id: string }>;
}

/** PublicApi.login / createAccount / authenticate shaped over KernelPasswordUser DOs. */
export class KernelPublicApi {
  constructor(private readonly users: KernelUserNamespace) {}

  #user(username: string) {
    const normalized = normalizeUsername(username);
    return {
      username: normalized,
      stub: this.users.get(this.users.idFromName(normalized)),
    };
  }

  async createAccount(
    username: string,
    displayName: string,
    passwordHash: Uint8Array,
  ): Promise<string | null> {
    const { username: id, stub } = this.#user(username);
    const secret = await stub.createAccount(id, displayName, passwordHash);
    if (!secret) return null;
    return formatKernelSessionToken(id, secret);
  }

  async login(username: string, passwordHash: Uint8Array): Promise<string | null> {
    const { username: id, stub } = this.#user(username);
    const secret = await stub.login(passwordHash);
    if (!secret) return null;
    return formatKernelSessionToken(id, secret);
  }

  async authenticate(token: string): Promise<{ username: string; whoami: { id: string } }> {
    const { username, secret } = parseKernelSessionToken(token);
    const stub = this.users.get(this.users.idFromName(username));
    await stub.authenticate(secret);
    const whoami = await stub.whoami();
    return { username, whoami };
  }

  async revokeSession(token: string): Promise<void> {
    const { username, secret } = parseKernelSessionToken(token);
    await this.users.get(this.users.idFromName(username)).revokeSession(secret);
  }
}

export { DurableTeamsApi };
