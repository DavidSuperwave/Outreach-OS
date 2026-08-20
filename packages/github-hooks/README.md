# GitHub hooks

Inbound GitHub webhook Worker for N10 (SUP-554). This is the **reference connector**: `POST /hooks/github/*` accepts the six J5 events, HMAC-checks `X-Hub-Signature-256`, skips unknown events, and upserts `foreign_entity` rows with source `github_pull_request`.

Kernel `gatekeeper-github` stays the OAuth/session Gatekeeper. This package does not recreate it and does not send GitHub writes — writes stay on the approval queue (`proposeComment` / apply).

Put `GITHUB_WEBHOOK_SECRET` in Wrangler secrets, never in git.

## Check

```sh
pnpm test
pnpm run types:check
```
