# Instantly Gatekeeper (reads only)

Wrapper-owned Gatekeeper for the Outreach OS pilot. It exposes the proposed Instantly Session API as observations and **does not implement send/activate/start**.

## Behavior

- Auto-provisioned singleton (`InstantlySession`). Binding name: `GATEKEEPER_INSTANTLY`.
- No `INSTANTLY_API_KEY`: serves the Intraplex ICP fixture workspace (draft campaign + Ada).
- With `INSTANTLY_API_KEY` (Wrangler secret, never committed): `GET /api/v2/campaigns` and `GET /api/v2/accounts` only. POST/PATCH/DELETE and `/activate` `/pause` paths throw `read_only`.
- Writes stay closed until a separate owner order. Do not add those methods here.

## Check

```sh
pnpm --filter instantly-gatekeeper test
pnpm --filter instantly-gatekeeper types:check
```
