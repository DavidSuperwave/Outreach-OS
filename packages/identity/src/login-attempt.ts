/**
 * Kernel `LoginAttempt` protocol (api.ts + server.ts LoginAttemptImpl).
 * Holding the attempt is the capability to receive the session token; abandon/dispose
 * cancels the in-flight `wait()` (ledger `contract:capability-lifecycle`).
 */
export interface LoginAttemptWaiter {
  awaitResult(): Promise<string>;
  abandon(reason?: string): Promise<void> | void;
}

export class LoginAttemptImpl {
  constructor(private readonly pending: LoginAttemptWaiter) {}

  wait(): Promise<string> {
    return this.pending.awaitResult();
  }

  /** Simulates Cap'n Web stub dispose: cancel the in-flight wait. */
  [Symbol.dispose](): void {
    void this.pending.abandon("Login attempt cancelled");
  }

  async dispose(): Promise<void> {
    await this.pending.abandon("Login attempt cancelled");
  }
}
