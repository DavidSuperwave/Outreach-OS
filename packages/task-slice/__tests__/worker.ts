export { default, TaskSliceDurableObject } from "../src/worker.js";
export { TeamDurableObject } from "../../identity/src/team-do.js";
export { UserDurableObject } from "../../../cloudflare-os/packages/workshop-backend/src/user.js";

import { DurableObject } from "cloudflare:workers";

/** Satisfies UserDurableObject's `ctx.exports.AdminSettings` lookup. */
export class AdminSettings extends DurableObject {}
