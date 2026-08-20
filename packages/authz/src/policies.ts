export {
  POLICIES,
  QUERY_MODULES,
  documentAccess as documentLevel,
  teamAccess as teamLevel,
  channelMembership as channelLevel,
  highestGrant,
} from "./queries/index.js";
export type { QueryModuleName, PolicyFn, PolicyContext } from "./queries/index.js";
