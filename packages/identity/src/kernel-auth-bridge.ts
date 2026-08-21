import { parseKernelSessionToken } from "./kernel-types.js";
import { isDeploymentAdmin, type ActorContext } from "./principal.js";
import type { KernelSession } from "./teams-api.js";

/** In-memory or DurableTeamsApi directory of kernel username → wrapper user. */
export interface KernelIdentityDirectory {
  users: Map<string, KernelSession>;
  actorContext(session: KernelSession, tenantId?: string | null): ActorContext;
}

/**
 * OD-16: after kernel PublicApi.login/createAccount/authenticate succeeds, bind the
 * kernel username to the wrapper principal. Does not re-implement credentials.
 */
export function afterKernelAuthenticate(
  api: KernelIdentityDirectory,
  kernelToken: string,
): ActorContext {
  const { username } = parseKernelSessionToken(kernelToken);
  const session = api.users.get(username);
  if (!session) {
    throw new Error(`no wrapper identity for kernel user ${username}; load seed fixtures (OD-1)`);
  }
  return api.actorContext(session);
}

export function deploymentAdminFromKernel(
  username: string,
  amIAdmin: boolean,
): boolean {
  // Kernel amIAdmin() is the authority; wrapper ADMINS seed must agree.
  return amIAdmin;
}

export function assertAdminPolicyAgrees(
  username: string,
  amIAdmin: boolean,
  policy: ReadonlySet<string>,
): void {
  const wrapper = isDeploymentAdmin(username, policy);
  if (wrapper !== amIAdmin) {
    throw new Error(
      `admin policy drift for ${username}: kernel amIAdmin=${amIAdmin} wrapper=${wrapper}`,
    );
  }
}
