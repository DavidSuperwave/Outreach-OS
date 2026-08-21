import { describe, expect, it } from "vitest";
import { handleTaskOutboxBatch, projectAfterRedrive } from "./outbox-queue.js";

describe("task projection re-drive", () => {
  it("durably enqueues before attempting a projection that fails", async () => {
    const calls: string[] = [];
    await expect(
      projectAfterRedrive(
        async () => {
          calls.push("enqueue");
        },
        async () => {
          calls.push("project");
          throw new Error("D1 unavailable");
        },
      ),
    ).rejects.toThrow(/D1 unavailable/);
    expect(calls).toEqual(["enqueue", "project"]);
  });

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
