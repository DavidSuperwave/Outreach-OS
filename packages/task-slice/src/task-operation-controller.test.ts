import { describe, expect, it } from "vitest";
import { TaskOperationController, type TaskUserAction } from "./task-operation-controller.js";

describe("browser task operation ids", () => {
  it("reuses a failed action id, then issues a new id for the next distinct action", async () => {
    let next = 0;
    const controller = new TaskOperationController(() => `op-${++next}`);
    const actions: TaskUserAction[] = [
      { kind: "create", title: "Create" },
      { kind: "title", entityId: "doc_1", title: "Rename" },
      { kind: "status", entityId: "doc_1", status: "in_progress" },
      { kind: "priority", entityId: "doc_1", priority: "high" },
      { kind: "assignee", entityId: "doc_1", assigneeId: "usr_1" },
      { kind: "done", entityId: "doc_1", done: true },
    ];
    const successfulIds: string[] = [];

    for (const action of actions) {
      let failedId = "";
      await expect(
        controller.run(action, async (operationId) => {
          failedId = operationId;
          throw new Error("transient");
        }),
      ).rejects.toThrow(/transient/);

      const retriedId = await controller.run(action, async (operationId) => operationId);
      expect(retriedId).toBe(failedId);
      successfulIds.push(retriedId);

      const nextActionId = await controller.run(action, async (operationId) => operationId);
      expect(nextActionId).not.toBe(retriedId);
    }

    expect(new Set(successfulIds).size).toBe(actions.length);
  });
});
