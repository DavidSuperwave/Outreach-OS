export { TaskSliceDurableObject } from "./task-do.js";
import { handleTaskSessionRequest, type TaskWorkerEnv } from "./session-rpc.js";

export default {
  async fetch(request: Request, env: TaskWorkerEnv): Promise<Response> {
    return handleTaskSessionRequest(request, env);
  },
};
