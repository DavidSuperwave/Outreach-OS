# SUP-536 OpenRouter — what changed, and where it lives

Linear: [SUP-536 Home cannot load AI models for OpenRouter](https://linear.app/superwave445/issue/SUP-536/home-cannot-load-ai-models-for-openrouter).

Path B: treat OpenRouter as a real kernel `AiModelProvider` (not “paste an OpenRouter key into OpenAI + custom URL”). Direct OpenAI add-model uses the Responses API; OpenRouter is chat-completions, so the fake-OpenAI path was expected to fail.

## Where this lives for the next session

Parked on branch `david/sup-536-home-cannot-load-ai-models-for-openrouter` in `DavidSuperwave/Outreach-OS`. Kernel edits cannot be pushed to `cloudflare/cloudflare-os`; they are stored as an applyable patch.

| Place | State |
| --- | --- |
| Wrapper (`deployment.jsonc`, deploy script, docs) | Committed on that branch. |
| Kernel (`cloudflare-os`) | Still detached at upstream `bf7f762`. Apply `patches/sup-536-openrouter-kernel.patch` inside the submodule. |
| Submodule pin | Unchanged (`bf7f762`). Shipping Path B still needs a pin/fork decision. |

Apply the kernel patch:

```sh
cd cloudflare-os
git apply ../patches/sup-536-openrouter-kernel.patch
```

---

## Wrapper repo (`Outreach-OS`)

These files let a deployment *name* OpenRouter as an AI Gateway provider. They do not implement inference; the kernel does.

| File | Change |
| --- | --- |
| `deployment.jsonc` | `aiGateway.providers` now includes `"openrouter"`. AI remains `enabled: false`. |
| `docs/customization.md` | External-provider list includes OpenRouter. |
| `scripts/deploy.mjs` | Validator allow-list includes `openrouter`. |
| `scripts/deploy.test.mjs` | Accepts OpenRouter as a provider; rejects unknown provider names. |

---

## Kernel (`cloudflare-os` submodule)

Apply from `patches/sup-536-openrouter-kernel.patch` (not a submodule pin).

### Provider + catalog

- `packages/workshop-shared/src/api.ts`
  - `AiModelProvider` adds `"openrouter"`.
  - Suggested models:
    - `openai/gpt-5-mini` — GPT 5 Mini (OpenRouter) — first entry, used as the cheap inspect / title default when Cloudflare is not in the catalog
    - `anthropic/claude-sonnet-4.5` — Claude Sonnet 4.5 (OpenRouter)
    - `google/gemini-2.5-flash` — Gemini 2.5 Flash (OpenRouter)

### Inference routing

- `packages/workshop-backend/src/ai-models.ts`
  - Gateway: `…/openrouter/chat/completions` (native OpenRouter path, not `/compat`).
  - Direct (no gateway): `https://openrouter.ai/api/v1/chat/completions`.
  - Completions API, not OpenAI Responses. `supportsStore` / `supportsDeveloperRole` off.

### Home catalog must not throw on a half-configured gateway

Home was throwing “Couldn't load AI models” when `CF_AI_GATEWAY` was set without account id / token (`getAiGatewayConfig` throws).

- `packages/workshop-backend/src/ai-gateway.ts`
  - `tryGetAiGatewayConfig()` — returns `null` instead of throwing if gateway mode is incomplete.
  - OpenRouter-only catalogs use the first suggested OpenRouter model for quick tasks (titles), instead of the hardcoded Workers AI title model (which would 401).
- `packages/workshop-backend/src/user.ts` — `listModels` / add / delete / preferred model use `tryGet`.
- `packages/workshop-backend/src/server.ts` — `getAiConfig()` uses `tryGet`.
- **Inference still uses throwing `getAiGatewayConfig`** — spend stays fail-closed if gateway credentials are missing.

### Attachments and UI

- `packages/workshop-backend/src/chat-attachment-validation.ts` — OpenRouter: text + images, **no PDF**.
- `packages/workshop-frontend/src/AddModelModal.tsx` — provider label “OpenRouter”, token placeholder `sk-or-...`.
- `packages/workshop-backend/src/env.d.ts` — comment lists `openrouter` in `CF_AI_GATEWAY_PROVIDERS`.

### Tests (kernel)

- `ai-models.test.ts` — gateway OpenRouter URL; direct `openrouter.ai` chat-completions URL.
- `ai-gateway.test.ts` — OpenRouter-only provider set.
- `chat-attachment-validation.test.ts` — PNG allowed, PDF rejected.

---

## What was *not* a code change

**Workspaces not loading** after the local restart was a stale session, not an OpenRouter bug.

- Browser still had `localStorage.authToken`.
- The User Durable Object no longer had that session (wrangler/miniflare restart, and a slim backend vs the earlier full multi-config run).
- Server: `Uncaught Error: invalid session token`.
- The UI still looks signed in (authenticate is pipelined) until `listGadgets()` fails.

Fix: Sign out (or delete `authToken`) and sign in again on the **same host** (`localhost` vs `127.0.0.1` do not share storage).

Windows `pnpm` spawn `ENOENT` was not patched in the kernel. Local workaround was a PATH shim to `pnpm.cmd`.

---

## What still has to happen for Home models to work

`OPENROUTER_API_KEY` in `cloudflare-os/.dev.vars` is **unused** by the Worker. Catalog + gateway inference need:

1. Cloudflare AI Gateway named (e.g. `default`) with OpenRouter BYOK.
2. `CF_AI_GATEWAY`, `CF_AI_GATEWAY_ACCOUNT_ID`, `CF_AI_GATEWAY_API_TOKEN` filled (token: AI Gateway Read + Edit).
3. `CF_AI_GATEWAY_PROVIDERS=openrouter` (already set locally).
4. Restart wrangler after filling those.

Shipping Path B also needs a **submodule pin or fork**. This starter’s `AGENTS.md` says not to fork `workshop-backend`; the kernel diffs above are exactly that kind of change.

Do not mark SUP-536 Done from the implementer session — Evidence review is a different session.
