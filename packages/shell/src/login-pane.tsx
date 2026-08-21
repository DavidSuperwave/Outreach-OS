import type { ReactNode } from "react";

export interface KernelAuthFields {
  username: string;
  password: string;
  displayName: string;
}

/** N1 chrome: kernel PublicApi.login / createAccount. The origin client speaks `/api`. */
export function LoginPane({
  mode,
  error,
  onAuth,
}: {
  mode: "login" | "signup";
  error?: string;
  onAuth?: (fields: KernelAuthFields) => void;
}): ReactNode {
  const signup = mode === "signup";
  return (
    <form
      data-surface="kernel.login"
      data-mode={mode}
      method="dialog"
      onSubmit={(event) => {
        if (!onAuth) return;
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        onAuth({
          username: String(data.get("username") ?? "").trim(),
          password: String(data.get("password") ?? ""),
          displayName: String(data.get("displayName") ?? "").trim(),
        });
      }}
    >
      <h1>{signup ? "Create account" : "Sign in"}</h1>
      <p data-mount="kernel-capnp">Kernel PublicApi on /api</p>
      {error ? (
        <p data-auth-error="" role="alert">
          {error}
        </p>
      ) : null}
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
