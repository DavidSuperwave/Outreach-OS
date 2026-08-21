export { TeamDurableObject } from "./team-do.js";

export default {
  async fetch(): Promise<Response> {
    return new Response("outreach identity worker", {
      headers: { "content-type": "text/plain" },
    });
  },
};
