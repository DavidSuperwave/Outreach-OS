export interface TaskOutboxMessage {
  tenantId: string;
}

interface OutboxQueueEnv {
  TASK_SLICE: {
    idFromName(name: string): { toString(): string };
    get(id: { toString(): string }): { drainOutbox(): Promise<unknown> };
  };
}

/** Durable fan-out: each tenant message re-drives TaskSliceDurableObject.drainOutbox. */
export async function handleTaskOutboxBatch(
  batch: { messages: Array<{ body: TaskOutboxMessage; ack(): void }> },
  env: OutboxQueueEnv,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const stub = env.TASK_SLICE.get(env.TASK_SLICE.idFromName(message.body.tenantId));
      await stub.drainOutbox();
    } catch {
      // Tenant DO may already be gone (test reset / eviction). Ack to stop retries.
    }
    message.ack();
  }
}
