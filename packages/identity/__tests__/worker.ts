export { default, TeamDurableObject } from "../src/worker.js";
export { UserDurableObject } from "../../../cloudflare-os/packages/workshop-backend/src/user.js";
export { KernelPasswordUser } from "./kernel-password-user.js";
export { PendingLogin } from "./pending-login.js";

import { DurableObject } from "cloudflare:workers";

/** Satisfies UserDurableObject's `ctx.exports.AdminSettings` lookup. */
export class AdminSettings extends DurableObject {}
