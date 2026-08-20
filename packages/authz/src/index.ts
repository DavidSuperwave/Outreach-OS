export { ACCESS_LEVELS, LEVEL_RANK, levelSatisfies } from "./levels.js";
export type { AccessLevel } from "./levels.js";
export { AuthzError, isReceipt } from "./receipt.js";
export type { Receipt } from "./receipt.js";
export { emptyAccess, grantShare, revokeShare } from "./access-state.js";
export type { AccessState, ShareGrant } from "./access-state.js";
export { POLICIES, documentLevel, teamLevel, channelLevel } from "./policies.js";
export { PolicyEngine, requireReceipt } from "./engine.js";
export {
  assertSec1RevokeDenies,
  assertSec2NoEscalate,
  assertSec3CrossTenantDenies,
  secFixtures,
} from "./sec.js";
