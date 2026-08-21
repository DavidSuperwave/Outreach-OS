import type { ReactNode } from "react";

/** N1 chrome: kernel PublicApi.login / createAccount. The origin client speaks `/api`. */
export function LoginPane({ mode }: { mode: "login" | "signup" }): ReactNode {
  const signup = mode === "signup";
  return (
    <form data-surface="kernel.login" data-mode={mode} method="dialog">
      <h1>{signup ? "Create account" : "Sign in"}</h1>
      <p data-mount="kernel-capnp">Kernel PublicApi on /api</p>
      <label>
        Username
        <input name="username" autoComplete="username" required aria-label="Username" />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          required
          aria-label="Password"
        />
      </label>
      {signup ? (
        <label>
          Display name
          <input name="displayName" autoComplete="name" aria-label="Display name" />
        </label>
      ) : null}
      <button type="submit">{signup ? "Create account" : "Sign in"}</button>
      {signup ? (
        <p>
          Already have an account? <a href="/login">Sign in</a>
        </p>
      ) : (
        <p>
          New here? <a href="/signup">Create account</a>
        </p>
      )}
    </form>
  );
}
