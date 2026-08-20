import { maxLevel, type PolicyFn } from "./lattice.js";
import { crmCompanyAccess } from "./crm_company_access.js";

/**
 * crm_contact_access — same team-scoped lattice as company; may inherit a parent company.
 */
export const crmContactAccess: PolicyFn = (state, actorId, ctx) => {
  let best = crmCompanyAccess(state, actorId, ctx);
  if (state.parentId) {
    const parent = ctx.store.get(state.parentId);
    if (parent) best = maxLevel(best, crmCompanyAccess(parent, actorId, ctx));
  }
  return best;
};
