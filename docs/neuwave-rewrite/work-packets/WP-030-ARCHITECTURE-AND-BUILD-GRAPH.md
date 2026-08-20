# WP-030 — Architecture decisions and build graph

## Objective

Turn the ruled feature set and verified source behavior into an implementation architecture and dependency program.

## Tasks

1. Fill one domain spec per kept domain family.
2. Assign authoritative state and projections.
3. Draw write, read, event, retry, and migration flows.
4. Draft the required ADRs from `10-DELIVERY-PLAN.md`.
5. Map RPC and command rows to domains/waves.
6. Identify kernel/API gaps and estimate change budget.
7. Build a dependency DAG with critical path and parallel-safe work.
8. Compare 2–3 representative vertical slices.
9. Recommend one slice and release gates.

## Deliverables

- `reports/04-target-architecture-decisions.md`
- ADR drafts under `reports/adrs/`
- `reports/05-implementation-build-graph.md`
- completed owner-decision queue

## Acceptance

No kept domain is represented only by a product-name mapping. Every domain has authority, API, storage, authorization, async, query, migration, parity, and rollback designs.
