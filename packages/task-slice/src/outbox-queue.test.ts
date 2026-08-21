import { describe, expect, it } from "vitest";
import { handleTaskOutboxBatch } from "./outbox-queue.js";

describe("task projection re-drive", () => {
  it("retries transient DO/D1 failures without ACKing", async () => {
    const calls: string[] = [];
    await handleTaskOutboxBatch(
      {
        messages: [{
          body: { tenantId: "team_1" },
          ack: () => calls.push("ack"),
          retry: () => calls.push("retry"),
        }],
      },
      {
        TASK_SLICE: {
          idFromName: (name) => ({ toString: () => name }),
          get: () => ({
            drainOutbox: async () => {
              throw new Error("DO unavailable");
            },
          }),
        },
      },
    );
    expect(calls).toEqual(["retry"]);
  });
});
