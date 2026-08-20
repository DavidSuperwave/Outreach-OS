# WP-020 — Compatibility inventories

## Objective

Produce exact, reviewable ledgers for the Cloudflare OS RPC surface and Neuwave command/hotkey system.

## RPC tasks

- Run `inventory_cf_os_rpc.py`.
- Review every interface extending or returning RPC capabilities.
- Expand overloads, multiline signatures, callbacks, subscriptions, and generic clients.
- Map callers and state ownership.
- Assign preliminary disposition and required test.

## Command tasks

- Run `inventory_neuwave_hotkeys.py`.
- Review every registration site.
- Expand loops and data-driven registrations.
- Reconstruct the scope tree and shadowing.
- Classify web/native behavior.
- Assign target typed command IDs.

## Deliverables

- `reports/02-rpc-compatibility-ledger.csv`
- `reports/03-command-hotkey-ledger.csv`
- summary/count/coverage sections in the plan gap report

## Acceptance

Counts are supported by enumerated rows. Any dynamic or unresolved surface is explicitly listed rather than hidden inside “approximately”.
