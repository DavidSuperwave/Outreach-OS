import { DurableObject } from "cloudflare:workers";

type PendingResult = { token: string } | { error: string };

/**
 * Kernel `PendingLogin` protocol from `auth/login-flow.ts` (pin bf7f762).
 * In-flight `awaitResult()` is the wait; abandon rejects it (stub dispose).
 */
export class PendingLogin extends DurableObject {
  #waiters: { resolve: (token: string) => void; reject: (err: Error) => void }[] = [];
  #result?: PendingResult;
  #abandoned = false;

  async awaitResult(): Promise<string> {
    if (this.#abandoned) throw new Error("Login attempt cancelled");
    if (this.#result) {
      const result = this.#result;
      this.#result = undefined;
      if ("token" in result) return result.token;
      throw new Error(result.error);
    }
    return await new Promise<string>((resolve, reject) => {
      this.#waiters.push({ resolve, reject });
    });
  }

  async deliver(token: string): Promise<void> {
    if (this.#abandoned) return;
    if (this.#waiters.length > 0) {
      for (const waiter of this.#waiters) waiter.resolve(token);
      this.#waiters = [];
    } else {
      this.#result = { token };
    }
  }

  async fail(reason: string): Promise<void> {
    if (this.#waiters.length > 0) {
      for (const waiter of this.#waiters) waiter.reject(new Error(reason));
      this.#waiters = [];
    } else {
      this.#result = { error: reason };
    }
  }

  async abandon(reason = "Login attempt cancelled"): Promise<void> {
    this.#abandoned = true;
    await this.fail(reason);
  }

  async debugState(): Promise<{ abandoned: boolean; waiterCount: number }> {
    return { abandoned: this.#abandoned, waiterCount: this.#waiters.length };
  }
}
