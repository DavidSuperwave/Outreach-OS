import type { PolicyFn } from "./lattice.js";

/**
 * team_access — N1 roles: owner→owner, admin→edit, member→view.
 * Mutations still require owner/admin at identity; receipts freeze the lattice here.
 */
export const teamAccess: PolicyFn = (state, actorId) => {
  const role = state.teamRoles[actorId];
  if (state.ownerId === actorId || role === "owner") return "owner";
  if (role === "admin") return "edit";
  if (role === "member" || state.memberIds.includes(actorId)) return "view";
  return null;
};
