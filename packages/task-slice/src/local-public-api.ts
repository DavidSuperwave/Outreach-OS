import { RpcTarget, newWorkersRpcResponse } from "capnweb";
import { formatKernelSessionToken, normalizeUsername } from "identity";

interface KernelUserDo {
  createAccount(username: string, displayName: string, passwordHash: Uint8Array): Promise<string | null>;
  login(passwordHash: Uint8Array): Promise<string | null>;
}

export interface UserNamespace {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): KernelUserDo;
}

/**
 * login / createAccount over the kernel User DO.
 * Used as a Workshop stand-in when LOCAL_KERNEL_API=true. Production proxies `/api`
 * to the unpatched Workshop worker.
 */
export class LocalKernelPublicApiTarget extends RpcTarget {
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

export function localKernelPublicApiFetcher(users: UserNamespace): {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
} {
  return {
    fetch(input: RequestInfo | URL, init?: RequestInit) {
      const request = input instanceof Request ? input : new Request(input, init);
      return newWorkersRpcResponse(request, new LocalKernelPublicApiTarget(users));
    },
  };
}
