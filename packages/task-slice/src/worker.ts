export { TaskSliceDurableObject } from "./task-do.js";
export { TeamDurableObject } from "../../identity/src/team-do.js";
export { UserDurableObject } from "../../../cloudflare-os/packages/workshop-backend/src/user.js";

import { DurableObject } from "cloudflare:workers";
import { handleOutreachFetch, type TaskWorkerEnv } from "./session-rpc.js";

/** Satisfies UserDurableObject's `ctx.exports.AdminSettings` lookup. */
export class AdminSettings extends DurableObject {}

export default {
  async fetch(request: Request, env: TaskWorkerEnv): Promise<Response> {
    return handleOutreachFetch(request, env);
  },
};
