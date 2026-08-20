# Post-rebuild operating model

## Source control

- Pin Cloudflare OS and upgrade intentionally.
- Keep wrapper-owned code outside generated submodule overlays.
- Every kernel or upstream-frontend patch gets an ADR and compatibility tests.
- Preserve the closed ledger and parity matrix as historical evidence; update living implementation docs separately.

## Change process

Each material change states:

- owning domain;
- source-of-truth record;
- RPC/command impact;
- projection/index impact;
- migration/backfill need;
- observability/SLO impact;
- rollback.

## Operations

Maintain dashboards for:

- request and RPC error rate;
- Durable Object hot keys and latency;
- D1 query latency and replication/backlog assumptions;
- queue depth, age, retries, and poison messages;
- projection checkpoint lag;
- external provider errors and rate limits;
- conversion queue and sandbox failures;
- search source availability and ranking freshness;
- auth denials and tenant-isolation alerts;
- migration/reconciliation drift.

## Disaster recovery

For every authority, document:

- backup/export method;
- recovery point objective;
- recovery time objective;
- reconstruction from events/projections;
- secret/provider credential recovery;
- regional/provider dependency;
- restore drill cadence.

## Agent handoff

Future agents start with:

1. root `AGENTS.md`;
2. this package’s `00-START-HERE.md`;
3. current work packet;
4. owning domain spec;
5. relevant ADRs and compatibility rows;
6. current git status and test state.
