import { parseKernelSessionToken } from "./kernel-types.js";
import type { KernelIdentityDirectory } from "./kernel-auth-bridge.js";
import type { ActorContext } from "./principal.js";

export class SessionBindError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "SessionBindError";
  }
}

/**
 * Bind a kernel session token to a tenant-scoped wrapper actor.
 * Credentials stay in the kernel User DO (`authenticate`). Membership stays on Team DO.
 * Callers must not accept a client-supplied ActorContext.
 */
export async function bindKernelSession(input: {
  token: string;
  tenantId: string;
  directory: KernelIdentityDirectory;
  authenticate: (username: string, secret: string) => Promise<void>;
  memberRole: (userId: string, tenantId: string) => Promise<string | null>;
}): Promise<ActorContext> {
  let username: string;
  let secret: string;
  try {
    ({ username, secret } = parseKernelSessionToken(input.token));
  } catch {
    throw new SessionBindError(401, "invalid kernel session token");
  }
  try {
    await input.authenticate(username, secret);
  } catch {
    throw new SessionBindError(401, "invalid session");
  }
  const session = input.directory.users.get(username);
  if (!session) {
    throw new SessionBindError(401, `no wrapper identity for kernel user ${username}; load seed fixtures (OD-1)`);
  }
  const role = await input.memberRole(session.userId, input.tenantId);
  if (!role) {
    throw new SessionBindError(403, "not a member");
  }
  return input.directory.actorContext(session, input.tenantId);
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)/i.exec(header);
  return match?.[1] ?? null;
}
