import { highestGrant, maxLevel, type PolicyFn } from "./lattice.js";

/**
 * crm_company_access — team-scoped directory.
 * Team members view companies in their tenant; admin→edit; owner→owner.
 * Directory reads are tenant-decorated: no cross-tenant leakage of who tracks a domain.
 * Killswitch mutations require team admin (see canToggleCrmKillswitch).
 */
export const crmCompanyAccess: PolicyFn = (state, actorId, ctx) => {
  const shared = highestGrant(state, actorId, ctx);
  const role = state.teamRoles[actorId];
  let teamLevel: ReturnType<PolicyFn> = null;
  if (state.ownerId === actorId || role === "owner") teamLevel = "owner";
  else if (role === "admin") teamLevel = "edit";
  else if (role === "member" || state.memberIds.includes(actorId)) teamLevel = "view";
  return maxLevel(shared, teamLevel);
};

export function canToggleCrmKillswitch(
  state: { teamRoles: Record<string, string>; ownerId: string },
  actorId: string,
): boolean {
  const role = state.teamRoles[actorId];
  return state.ownerId === actorId || role === "owner" || role === "admin";
}

export function directoryTracksDomain(ownerTenantId: string, requesterTenantId: string): boolean {
  return ownerTenantId === requesterTenantId;
}
