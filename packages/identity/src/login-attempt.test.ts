import { describe, expect, it } from "vitest";
import { LoginAttemptImpl, type LoginAttemptWaiter } from "./login-attempt.js";

class MemoryPending implements LoginAttemptWaiter {
  #waiters: { resolve: (token: string) => void; reject: (err: Error) => void }[] = [];
  #abandoned = false;

  awaitResult(): Promise<string> {
    if (this.#abandoned) return Promise.reject(new Error("Login attempt cancelled"));
    return new Promise((resolve, reject) => this.#waiters.push({ resolve, reject }));
  }

  abandon(reason = "Login attempt cancelled"): void {
    this.#abandoned = true;
    for (const waiter of this.#waiters) waiter.reject(new Error(reason));
    this.#waiters = [];
  }

  deliver(token: string): void {
    if (this.#abandoned) return;
    for (const waiter of this.#waiters) waiter.resolve(token);
    this.#waiters = [];
  }
}

describe("LoginAttempt capability lifecycle", () => {
  it("dispose cancels wait; late deliver is ignored", async () => {
    const pending = new MemoryPending();
    const attempt = new LoginAttemptImpl(pending);
    const waiting = attempt.wait();
    await attempt.dispose();
    await expect(waiting).rejects.toThrow(/cancelled/);
    pending.deliver("admin:too-late");
    await expect(attempt.wait()).rejects.toThrow(/cancelled/);
  });

  it("wait resolves when the pending login delivers a token", async () => {
    const pending = new MemoryPending();
    const attempt = new LoginAttemptImpl(pending);
    const waiting = attempt.wait();
    pending.deliver("admin:secret");
    await expect(waiting).resolves.toBe("admin:secret");
  });
});
