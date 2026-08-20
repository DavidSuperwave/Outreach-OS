# Testing, parity, and release gates

## Test layers

| Layer | Purpose |
|---|---|
| Unit | Domain invariants, policy, transforms, ranking, command matching. |
| Contract | RPC, service bindings, webhook signatures, provider adapters. |
| Storage | DO/D1/R2/KV behavior, indexes, migrations, idempotency. |
| Integration | Domain + projection + connector flows under Miniflare/workerd where possible. |
| Golden fixture | Conversion, Markdown, schema, ranking, import/export compatibility. |
| UI interaction | Keyboard, focus, route, selection, bulk edits, responsive states. |
| Visual regression | Approved reference screenshots and intentional-difference ledger. |
| Migration | Resumability, duplicate handling, reconciliation, rollback. |
| Security | Authorization matrix, tenant isolation, SSRF, secret leakage, injection. |
| Load/soak | Hot DO keys, fan-out, queue backlog, large lists, reconnect behavior. |

## Required parity matrix

Every kept capability receives rows for:

- user journey;
- old source evidence;
- target implementation;
- expected outcome;
- automated proof;
- manual proof;
- intentional difference;
- status.

## Release gates

A wave is not complete because it compiles. It must pass:

1. source and owner-ruling traceability;
2. contract compatibility;
3. authorization and tenant isolation;
4. failure/retry/idempotency tests;
5. projection reconciliation;
6. accessibility and keyboard tests;
7. visual parity where applicable;
8. observability and alert proof;
9. migration/rollback proof;
10. operator runbook review.

## Representative vertical slice gate

Before broad domain parallelization, one slice must exercise:

- custom React surface;
- centralized command;
- typed RPC/capability;
- authorization receipt;
- authoritative write;
- asynchronous side effect;
- projection update;
- live subscription;
- audit/observability;
- migration fixture;
- failure and replay.

The default candidate is a Task create/edit/list/status flow because it crosses ontology, properties, permissions, list projection, commands, UI, and activity. Codex must compare candidates and request owner approval before implementation.
