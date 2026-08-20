# ADR-004 — Authorization receipts and policy model

- Status: Proposed (Draft — owner decides)
- Date: 2026-08-20
- Owners: David (decision); WP-030 drafting agent (proposal)

## Context

Neuwave's authorization core is `crates/entity_access` @ `9f7a26b`: 62 files,
**6,448 non-test LOC + 13,519 test LOC** (68% tests — the only executable
specification of the share-permission invariant), with **14 typed axum
extractors** (`EntityAccessReceipt<L>` capability markers: View/Comment/Edit/
Owner + role variants; modules bot, call, channel, chat, document, entity_body,
entity_permission, foreign_entity, history, pin, project, reminder, team,
thread) and **13 per-entity-type access-query modules**
(`outbound/pg_access_repo/queries/`). Receipts make "this handler needs Edit on
a document" a compile-time obligation. Verified exact in
`reports/01-plan-gap-review.md` §2.2.

Known deliberate gap: favorites listing re-checks nothing
(`crates/favorites/src/domain/service.rs:103-112`) — revoked entities stay
visible until removed. SEC-1/2/3 share-permission holes live in this crate's
tests and are ruled **"fixed, not recreated"** (ledger §6, Q20, 2026-08-19);
their concrete semantics are documented only in Linear SUP-474.

## Source and ruling constraints

- 03-IMPLEMENTATION-PRINCIPLES §4: authorization is a core subsystem — typed
  permission checks, testable receipts, tenant boundaries, read-side
  enforcement; no scattered `if (userId === ownerId)`.
- Pattern ruling 1a: per-type access policy stays code (not a generic ACL
  table).
- Ledger DSS-native row: entity_access "is ruled first or everything else is
  blocked".
- Kernel pattern to preserve: compile-time default-deny role wrappers
  (`UseOverseerInterface` overseer.ts:8767, `UseGadgetClientInterface`
  :9258).

## Decision

**Proposed: a first-class wrapper package `authz` (receipts + policy)** that
every domain capability consumes:

1. **Typed receipts.** `Receipt<Level, EntityType>` values are produced only
   by the policy engine and required by domain handlers as typed parameters —
   the TypeScript recreation of `EntityAccessReceipt<L>`: branded types make
   receipts unforgeable in-process; RPC handlers acquire them at the top of
   the call, domain functions accept receipts, never raw ids. Level lattice
   preserved: View < Comment < Edit < Owner, plus role variants.
2. **Per-type policy modules in code.** One policy module per entity type,
   recreating the semantics of the 13 query modules (channel membership/roles,
   document sharing, project access, CRM company/contact, thread, call, team,
   foreign_entity). Policies read authoritative state (owning DO) and/or the
   access projection (below), never ad-hoc SQL from feature code.
3. **Read-side enforcement is explicit per surface.** Every list/projection
   read declares `enforced` (filtered by receipts/access projection) or
   `unenforced-by-design` with an owner-visible justification. The favorites
   listing gap is **fixed** (filtered) by default, per the SEC "fixed, not
   recreated" ruling; any deliberate retention of stale visibility is an owner
   decision, not an accident.
4. **Access projection for cross-entity reads.** Soup/search/favorites need
   set-filtering at query time; the materialized-index layer (ADR-006) carries
   a per-user/team access projection maintained from policy-relevant events —
   a cache of policy outcomes, never the authority; TTL/invalidation from the
   same event stream, fail-closed on miss.
5. **Test corpus as spec.** The 13.5k LOC test suite is harvested into a
   behavior matrix (user × entity × level × expected) and re-expressed as the
   acceptance suite; SEC-1/2/3 semantics are extracted from those tests (plus
   SUP-474 if the owner grants access) and asserted as *denied*.

## Alternatives considered

1. **Generic ACL/ReBAC store (Zanzibar-style tuples in D1).** Rejected for
   pass 1: 1a rules per-type policy stays code; the source semantics are
   relational (membership, roles, share links), and a tuple store adds a
   translation layer with no parity oracle.
2. **Kernel-level enforcement (extend capability chain).** Rejected: kernel
   capabilities gate kernel objects; entity policy is product scope
   (kernel-change budget).
3. **Per-domain bespoke checks.** Rejected explicitly by 03-PRINCIPLES §4;
   this is how SEC-class holes happen.

## Compatibility impact

- Every wrapper RPC method's ledger row (ADR-002) names its required receipt
  level — the authorization column becomes machine-checkable.
- The receipt lattice and per-type semantics are a compatibility surface: the
  05-MAP parity proof ("same user/entity matrix produces expected
  view/comment/edit/owner result") is the gate.

## State and authorization impact

- Authority: policy modules + the authoritative membership/sharing state in
  owning DOs. The access projection in D1 is derived, rebuildable, and owned
  by one projector (ADR-005).
- Tenancy: receipts carry tenant; cross-tenant minting is structurally
  impossible (registry resolve first, ADR-003).
- Agent actions: preserve the actor-vs-subject split (`on_behalf_of ?? actor`)
  so agent-attributed operations mint receipts for the delegating principal
  with audit of both.

## Migration and rollback

- No data migration under OD-1 Branch A. Branch B: permission principals map
  through the identity mapping (08 §2) before access projections build.
- Rollback: policy modules are versioned code; the access projection can be
  dropped and rebuilt from events at any time (rebuild is the rollback for
  projection corruption).

## Operational consequences

- Policy evaluation on the hot path of every RPC call: budget one DO read or
  one projection read per check; batch APIs for list filtering.
- Audit log of denials with receipt context (observability requirement from
  01-AUTHORITY exception discipline applies platform-wide here).

## Tests and acceptance

- Ported behavior matrix from the entity_access test corpus passes.
- SEC-1/2/3 scenarios assert **denial** (fixed, not recreated).
- Read-side sweep: every projection query in the codebase is tagged
  enforced/unenforced-by-design; CI fails on untagged reads.
- Fuzz: no code path constructs a Receipt outside the policy engine
  (lint/brand check).

## Follow-up decisions

- Owner/production access to Linear SUP-474 for SEC-1/2/3 details (WP-010
  B5) — or accept test-derived semantics as the spec.
- Whether any surface may keep `unenforced-by-design` reads (e.g. favorites
  stale-visibility UX) — owner call per surface.
- Exact projection schema and policy-module interfaces belong to
  `reports/04-target-architecture-decisions.md`.
