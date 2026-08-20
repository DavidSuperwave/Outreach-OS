# ADR-005 — Durable Object / D1 / R2 / KV / Queue / Workflow / projection ownership rules

- Status: Proposed (Draft — owner decides)
- Date: 2026-08-20
- Owners: David (decision); WP-030 drafting agent (proposal)

> **Status note (Ruled 2026-08-20, see `../06-owner-decisions-needed.md`
> OD-10):** the zero-kernel-patch budget is bound from wave 0 (ADR-014 now
> Accepted) — every ownership rule here must be met with wrapper-owned
> primitives; no rule may be satisfied by a kernel change without ADR-014's
> admission process and owner sign-off. Additionally, OD-1 was ruled Branch A
> (no live data), so rule 9's Hyperdrive-transitional clause has no object.

## Context

The rewrite replaces an AWS topology (one physical Postgres with 267
migrations and ~194 live tables, DynamoDB ×2, Redis in 22 crates/services,
S3, OpenSearch, Kafka/SQS/EventBridge — verified in
`reports/01-plan-gap-review.md`) with Cloudflare primitives. Without explicit
ownership rules, D1 becomes the new shared-Postgres free-for-all and the
topology gets copied instead of the behavior.

## Source and ruling constraints

- 04-TARGET primitive-selection guide; caution row: "Do not make D1 an
  unowned write free-for-all."
- 03-IMPLEMENTATION-PRINCIPLES §1 (eleven state questions) and §3 (ownership
  precedes schemas).
- Pattern rulings @ research/nuewave-longtail `13c2847`
  (`merge/pattern-review.md`): **3a** — adopt the outbox discipline, not the
  tables; consumers idempotent; poison rows marked-and-skipped. **4a** — DO
  single-writer + alarms; leases/claims/polling dispatchers are not ported;
  external-mutation fencing and idempotency keys are, as DO-local state;
  multi-job DOs use the kernel's recompute-shared-alarm discipline.
- Kernel idioms at `bf7f762`: per-user `UserDurableObject`
  (`packages/workshop-backend/src/user.ts:151-220` typed collections),
  per-workspace `OverseerDurableObject`, typed storage.

## Decision

**Proposed rules (binding for every domain design):**

1. **Single authority per fact.** Every stateful capability names exactly one
   authoritative writer before any schema exists. Default: a Durable Object
   when serialized ownership is valuable (aggregates, counters, orderings);
   sharding key and hot-key limits stated up front.
2. **No unowned D1 writes.** Every D1 database/table has exactly one owning
   writer (a projector worker/DO or a registry service). Feature code never
   writes another owner's tables; cross-domain effects travel as events. D1
   holds (a) projections/indexes (rebuildable), (b) small registries that are
   themselves single-authority (e.g. entity registry, ADR-003). CI enforces
   an ownership manifest (table → owner binding).
3. **R2 for large/immutable bytes**; object keys are opaque; metadata and
   authorization live outside R2 (D1/DO), per 04-TARGET caution. Derivative
   objects (previews, conversions) are separate keys with provenance
   metadata, never in-place mutations.
4. **KV only for read-mostly config/snapshots** (deploy config, branding,
   token-layer snapshots). Never an authority for conflicting writes; every
   KV value has a rebuild source.
5. **Queues for durable fan-out.** Every queue message carries an idempotency
   key and ordering key where ordering matters; consumers are idempotent (3a);
   poison messages are marked-and-skipped with a dead-letter record, never
   silently dropped, never infinitely retried.
6. **Workflows or DO alarms for orchestration** per 4a: single-writer DO with
   alarms replaces every lease/claim/polling dispatcher in the source (the
   seven lease instances, incl. scheduled_action's "weakest tier" polling
   dispatcher, do not port). Cloudflare Workflows only for long multi-step
   jobs needing built-in compensation/visibility; duration and compensation
   stated per use.
7. **Outbox discipline at every async boundary** (3a): state change and
   intent record commit atomically in the owner (DO storage), a drain
   publishes to Queues, consumers checkpoint; projection checkpoints are
   explicit records, so every projection is rebuildable from authority scans
   plus events.
8. **Redis does not port.** Its four source roles map to: stream transport →
   durable stream in owning DO; counters → DO state; cancellation pub/sub →
   DO-routed signals (a cancellation reaches the DO that owns the run —
   replacing the Redis pub/sub hop in `ai_stream_registry`); work sets →
   queue + DO alarm.
9. **Hyperdrive is transitional only** (OD-1 Branch B), never a design
   element of the target.

## Alternatives considered

1. **One big D1 as the new Postgres.** Rejected: copies topology, loses
   serialized ownership, hits D1 write contention and size limits, and defeats
   the receipt/authority model.
2. **Everything in DOs, no D1.** Rejected: cross-aggregate queries (Soup,
   search enrichment, favorites hydration) cannot fan out to dozens of DOs per
   render (04-TARGET query-plane requirement).
3. **Port the outbox tables and lease rows literally.** Rejected by rulings
   3a/4a.

## Compatibility impact

None user-visible directly; this ADR constrains how every domain meets its
behavior contract. Failure semantics (retry, ordering, idempotency) become
per-domain ledger columns as 06-COMPAT requires.

## State and authorization impact

- Authority placement is the precondition for receipts (ADR-004): policy
  reads authoritative state; projections are marked derived and fail closed.
- Tenant isolation: DO namespaces keyed by tenant-scoped ids; D1 projections
  carry tenant columns and owners enforce them; no cross-tenant queue topics.

## Migration and rollback

- Projection rebuild is a first-class operation (08 §4): authorities load
  first, projections rebuild deterministically — this is also the rollback
  path for any projection bug.
- Under OD-1 Branch B, dual-run happens behind one controlled adapter per
  domain (08 §5); two unconstrained authoritative writers are forbidden.

## Operational consequences

- An **ownership manifest** (`storage-owners.jsonc` or equivalent) is a
  living deliverable: every DO class, D1 table, R2 bucket/prefix, KV
  namespace, queue — with owner, rebuild source, and checkpoint location.
- Observability: per-queue depth/poison metrics, per-projection staleness
  metrics, per-DO alarm health (13-POST-REBUILD model).

## Tests and acceptance

- CI: no D1 binding appears in a worker that is not the manifest owner.
- Chaos tests per async boundary: duplicate delivery is a no-op; poison
  message parks with a record; interrupted projector resumes from checkpoint.
- Rebuild test: drop a projection, rebuild from authority, diff equals live.
- Hot-key test for each DO class at expected fan-in.

## Follow-up decisions

- Redis successor mapping ratification (roadmap "needs David" item; part of
  OD-5 batch).
- Per-domain authority table (which aggregate → which DO class; D1 database
  partitioning) belongs to `reports/04-target-architecture-decisions.md`.
