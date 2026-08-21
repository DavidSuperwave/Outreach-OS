export { TaskSliceDurableObject } from "./task-do.js";

export default {
  async fetch(): Promise<Response> {
    return new Response("outreach task-slice worker", {
      headers: { "content-type": "text/plain" },
    });
  },
};
