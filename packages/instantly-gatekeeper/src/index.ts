export * from "./instantly.js";
export * from "./instantly-api.js";

export default {
  async fetch(): Promise<Response> {
    return new Response("Instantly Gatekeeper worker is running (reads only).", {
      headers: { "content-type": "text/plain" },
    });
  },
};
