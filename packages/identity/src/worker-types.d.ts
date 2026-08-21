/** Ambient Workers types for identity tsc. Vitest-pool-workers supplies the real runtime. */

declare module "cloudflare:workers" {
  export class DurableObject<Env = unknown> {
    readonly ctx: DurableObjectState;
    readonly env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }

  export class WorkerEntrypoint<Env = unknown, Props = unknown> {
    readonly ctx: { props: Props; exports: unknown };
    readonly env: Env;
    constructor(ctx: unknown, env: Env);
  }

  export class RpcTarget {}
  export class RpcStub<T = unknown> {
    constructor(target?: T);
    dup(): RpcStub<T>;
  }
}

interface DurableObjectState {
  readonly storage: DurableObjectStorage;
  readonly id: DurableObjectId;
  readonly exports: unknown;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectStorage {
  readonly sql: SqlStorage;
  readonly kv: Map<string, unknown>;
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
  one(): T;
}

type Fetcher<T = unknown> = T;
type DurableObjectClass<T = unknown> = new (...args: never[]) => T;
type DurableObjectNamespace<T = unknown> = {
  idFromName(name: string): DurableObjectId;
  newUniqueId(): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub<T>;
};
type DurableObjectStub<T = unknown> = T;
