/** Ambient Workers types for task-slice tsc. Vitest-pool-workers supplies the runtime. */

declare module "cloudflare:workers" {
  export class DurableObject<Env = unknown> {
    readonly ctx: DurableObjectState;
    readonly env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }
}

interface DurableObjectState {
  readonly storage: DurableObjectStorage;
  readonly id: DurableObjectId;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectStorage {
  readonly sql: SqlStorage;
}

interface SqlStorage {
  exec<T extends Record<string, SqlStorageValue> = Record<string, SqlStorageValue>>(
    query: string,
    ...bindings: unknown[]
  ): SqlStorageCursor<T>;
}

type SqlStorageValue = string | number | null;

interface SqlStorageCursor<T> {
  toArray(): T[];
}
