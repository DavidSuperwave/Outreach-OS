import type { MembershipRow, TeamRole } from "./principal.js";

/**
 * Effective team role is a pure function over the membership projection.
 * Deployment admin is NOT folded in (04-TARGET §1).
 */
export function resolveEffectiveRole(
  memberships: readonly MembershipRow[],
  userId: string,
  teamId: string,
): TeamRole | null {
  const row = memberships.find((item) => item.userId === userId && item.teamId === teamId);
  return row?.role ?? null;
}

export interface SignInParity {
  kernelUsername: string;
  userId: string;
  teamId: string;
  expectedRole: TeamRole;
  isDeploymentAdmin: boolean;
}

/** 05-MAP row 1: seeded user signs in and resolves the identical effective role. */
export function assertSignInParity(
  memberships: readonly MembershipRow[],
  signIn: SignInParity,
): { role: TeamRole; isDeploymentAdmin: boolean } {
  const role = resolveEffectiveRole(memberships, signIn.userId, signIn.teamId);
  if (role !== signIn.expectedRole) {
    throw new Error(
      `effective role mismatch for ${signIn.kernelUsername}: got ${role}, expected ${signIn.expectedRole}`,
    );
  }
  return { role, isDeploymentAdmin: signIn.isDeploymentAdmin };
}
