export { TaskSliceDurableObject } from "./task-do.js";
export { TeamDurableObject } from "../../identity/src/team-do.js";
export { UserDurableObject } from "../../../cloudflare-os/packages/workshop-backend/src/user.js";

import { DurableObject } from "cloudflare:workers";
import { handleOutreachFetch, type TaskWorkerEnv } from "./session-rpc.js";
import { handleTaskOutboxBatch, type TaskOutboxMessage } from "./outbox-queue.js";

/** Satisfies UserDurableObject's `ctx.exports.AdminSettings` lookup. */
export class AdminSettings extends DurableObject {}

export default {
  /** Origin compositor + Cap’n Web domain/session. */
  async fetch(request: Request, env: TaskWorkerEnv): Promise<Response> {
    return handleOutreachFetch(request, env);
  },
  async queue(
    batch: { messages: Array<{ body: TaskOutboxMessage; ack(): void; retry(): void }> },
    env: TaskWorkerEnv,
  ): Promise<void> {
    await handleTaskOutboxBatch(batch, env);
  },
};
