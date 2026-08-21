export type TaskUserAction =
  | { kind: "create"; title: string }
  | { kind: "title"; entityId: string; title: string }
  | { kind: "status"; entityId: string; status: string }
  | { kind: "priority"; entityId: string; priority: string }
  | { kind: "assignee"; entityId: string; assigneeId: string }
  | { kind: "done"; entityId: string; done: boolean };

function actionKey(action: TaskUserAction): string {
  switch (action.kind) {
    case "create":
      return JSON.stringify([action.kind, action.title]);
    case "title":
      return JSON.stringify([action.kind, action.entityId, action.title]);
    case "status":
      return JSON.stringify([action.kind, action.entityId, action.status]);
    case "priority":
      return JSON.stringify([action.kind, action.entityId, action.priority]);
    case "assignee":
      return JSON.stringify([action.kind, action.entityId, action.assigneeId]);
    case "done":
      return JSON.stringify([action.kind, action.entityId, action.done]);
  }
}

/**
 * Retains an operation id after a transient failure. A retry of the same user
 * action reuses it; successful completion releases it so a later action is new.
 */
export class TaskOperationController {
  #pending = new Map<string, string>();

  constructor(private readonly createId: () => string) {}

  async run<T>(action: TaskUserAction, invoke: (operationId: string) => Promise<T>): Promise<T> {
    const key = actionKey(action);
    const operationId = this.#pending.get(key) ?? this.createId();
    this.#pending.set(key, operationId);
    try {
      const result = await invoke(operationId);
      if (this.#pending.get(key) === operationId) this.#pending.delete(key);
      return result;
    } catch (error) {
      throw error;
    }
  }
}
