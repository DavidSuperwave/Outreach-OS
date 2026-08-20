# Implementation principles

## 1. Rewrite behavior, not topology

Preserve user-visible behavior, contracts, invariants, and failure semantics. Do not reproduce AWS service boundaries just because they existed.

For every stateful capability, answer:

- Who is the authoritative writer?
- What consistency is required?
- How many concurrent writers exist?
- Is ordering required, and at what key?
- What is the retry/idempotency model?
- What cross-entity queries are required?
- What must be globally indexed?
- What is the blob/object model?
- What are retention and recovery requirements?
- What is the tenant/authorization boundary?
- How will existing data migrate and reconcile?

Only then select Durable Objects, D1, R2, KV, Queues, Workflows, Vectorize, Hyperdrive, Browser Rendering, or another service.

## 2. Compatibility surfaces are explicit projects

The Cloudflare OS `api.ts` RPC surface and the Neuwave command/hotkey system are not implementation details. They are compatibility ledgers.

No agent may opportunistically rename, merge, or remove these surfaces while implementing unrelated UI or domain code.

## 3. State ownership precedes schemas

Do not begin with one giant schema. Define aggregates and authority first, then storage and projections.

A useful default pattern is:

- authoritative aggregate in a Durable Object when serialized ownership is valuable;
- D1 projection/index for cross-aggregate querying;
- R2 for immutable or large binary content;
- KV for read-mostly deployment/config snapshots;
- Queue/Workflow for durable fan-out or long-running orchestration;
- explicit outbox/idempotency records at every asynchronous boundary.

This is a pattern, not a mandate. Deviations must be explained by requirements.

## 4. Authorization is a core subsystem

Neuwave’s entity-access layer is not chrome. The rewrite needs a first-class policy model with typed permission checks, testable receipts/capabilities, tenant boundaries, and read-side enforcement.

Do not reduce authorization to scattered `if (userId === ownerId)` checks.

## 5. UI parity includes behavior

Faithful UI/UX means more than matching screenshots. Preserve or intentionally replace:

- focus transitions;
- keyboard scope and shadowing;
- optimistic states;
- loading and error transitions;
- panel/split navigation semantics;
- command palette behavior;
- drag/drop and selection;
- responsive/mobile behavior;
- accessibility semantics;
- undo/redo expectations;
- route/deep-link behavior.

## 6. Evidence travels with implementation

Every implementation PR or work packet must state:

- owner ruling implemented;
- source evidence consulted;
- state owner;
- compatibility surfaces changed;
- failure and retry model;
- tests/parity evidence;
- migration impact;
- rollback path;
- unresolved facts.
