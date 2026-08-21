import { RpcTarget, newWorkersRpcResponse } from "capnweb";
import { formatKernelSessionToken, normalizeUsername } from "identity";
import type { WorkshopFetcher } from "../src/session-rpc.js";

interface KernelUserDo {
  createAccount(username: string, displayName: string, passwordHash: Uint8Array): Promise<string | null>;
  login(passwordHash: Uint8Array): Promise<string | null>;
}

interface UserNamespace {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): KernelUserDo;
}

/**
 * Test double of workshop-backend PublicApi on `/api`.
 * Production origin proxies this mount to the Workshop worker (unpatched).
 */
export class WorkshopPublicApiTarget extends RpcTarget {
  constructor(private readonly users: UserNamespace) {
    super();
  }

  async createAccount(
    username: string,
    displayName: string,
    passwordHash: Uint8Array,
  ): Promise<string | null> {
    const id = normalizeUsername(username);
    const secret = await this.users.get(this.users.idFromName(id)).createAccount(id, displayName, passwordHash);
    if (!secret) return null;
    return formatKernelSessionToken(id, secret);
  }

  async login(username: string, passwordHash: Uint8Array): Promise<string | null> {
    const id = normalizeUsername(username);
    const secret = await this.users.get(this.users.idFromName(id)).login(passwordHash);
    if (!secret) return null;
    return formatKernelSessionToken(id, secret);
  }
}

export function workshopPublicApiFetcher(users: UserNamespace): WorkshopFetcher {
  return {
    fetch(input: RequestInfo | URL, init?: RequestInit) {
      const request = input instanceof Request ? input : new Request(input, init);
      return newWorkersRpcResponse(request, new WorkshopPublicApiTarget(users));
    },
  };
}
