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

Windows note: `run-local.mjs` spawns `pnpm` without a shell. Cloud VMs (Linux + corepack `pnpm`) are fine; Desktop PowerShell may need `pnpm.exe` on PATH.
