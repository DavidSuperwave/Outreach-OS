export { TaskSliceDurableObject } from "./task-do.js";
import { handleOutreachFetch, type TaskWorkerEnv } from "./session-rpc.js";

export default {
  async fetch(request: Request, env: TaskWorkerEnv): Promise<Response> {
    return handleOutreachFetch(request, env);
  },
};
