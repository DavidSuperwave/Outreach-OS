# Outreach OS

Custom Cloudflare OS for Superwave outreach. Implementation home is this starter repo. The kernel lives in the pinned `cloudflare-os` submodule — do not fork `workshop-backend` and do not copy InteliganceData `app/` or `agent/` code.

## Bound

OS running → `/admin` standing instructions → Playbooks + Intraplex ICP → inspect → ask → table gadget → Instantly **reads**.

## Out of scope

- Instantly activate / send / start
- Eve
- Campaign OS / InteliganceData routes
- Encoding campaign logic in the kernel

## Commands

```sh
git submodule update --init
pnpm install
pnpm --dir cloudflare-os install
pnpm --dir cloudflare-os run-local
# http://localhost:8787
```

Always `pnpm`, never npm. Node 24, pnpm 11.

## Secrets

Never commit `.dev.vars`, keys, tokens, or Instantly/OpenRouter credentials. Local secrets live in `cloudflare-os/.dev.vars` (gitignored). Cloud agents should use Cursor environment secrets, not files in git.

## Instantly

Propose a read-only Session API, then **stop for David**. Do not implement send/activate methods.

## Cursor Cloud specific instructions

Cloud agents start from `.cursor/environment.json`. After checkout, `install` already ran `git submodule update --init` and both `pnpm install`s. Do not skip the submodule — `cloudflare-os/` is empty without it.

Do not run `pnpm deploy` or spend Cloudflare/OpenRouter/Instantly quota unless the issue explicitly asks. Local `pnpm run-local` is enough to verify the shell.

Node 24 is required (pinned by `.cursor/Dockerfile` + corepack `pnpm@11`). If a session lands on Node 22 (e.g. a just-in-time VM that did not boot from the Dockerfile), switch with `nvm install 24 && nvm use 24` before installing — the `/exec-daemon` node is ahead of nvm on `PATH`, so prepend the nvm bin dir to `PATH` for that shell.

`pnpm --dir cloudflare-os run-local` serves the Workshop at http://localhost:8787. The first run is slow: it builds the gatekeeper single-file apps and the frontend bundle before `wrangler` prints `Ready on http://localhost:8787`. Repeat runs are cached via `cloudflare-os/.run-local-stamp` and only rebuild when tracked source changes. No `.dev.vars` is needed for the basic shell; gatekeepers/AI stay `[not connected]` locally.

Local sign-in uses username/password (on by default). The account named `admin` is auto-granted admin (`ADMINS=["admin"]` injected by `run-dev-server.js`); create it at `/signup`, then reach deployment settings at `/admin`.

Running the submodule test suite (`pnpm --dir cloudflare-os test`) needs `@gadgets/typed-storage` built first, otherwise 6 `workshop-backend` vitest files fail with "Failed to resolve entry for package @gadgets/typed-storage". Build it once with `pnpm --dir cloudflare-os --filter @gadgets/typed-storage build` (`run-local` does this automatically).

Root `pnpm check` runs `deploy.mjs --check` against `deployment.jsonc` and intentionally fails on the committed `<PLACEHOLDER>` values ("Replace deployment placeholder ..."). That is expected without real Cloudflare account config — it is not an environment problem. Root code checks that pass offline: `pnpm test` (root) and `pnpm --dir cloudflare-os lint` / `pnpm --dir cloudflare-os test`.

Windows note: `run-local.mjs` spawns `pnpm` without a shell. Cloud VMs (Linux + corepack `pnpm`) are fine; Desktop PowerShell may need `pnpm.exe` on PATH.
