# Domain specification — Domain control plane (N3 / SUP-549)

## Verdict and source evidence

Library node. ADR-005 (outbox 3a, DO alarms 4a, OD-20 Redis map).  
Corrected bus: 12 product topics + `example`; activity is a fact log (01 §2.5 E3).  
Receipts are a control-plane type (co-designed with N2) but the branded value never serializes.

## User journeys

A domain write appends an envelope to the owning-DO outbox in the same turn; drain publishes; a projector checkpoints; duplicate delivery is a no-op; a poison publish is marked-and-skipped.

## Invariants

Single authority per fact. No unowned D1 writes. Event ids are deterministic (`entityType:entityId:version`).  
Activity actions are a closed 10-variant vocabulary. `macro.com` / `macro.activity_events` are not topics.

## Entities and identifiers

Envelope identity is `eventId`. Entity identity is the N2 typed id inside the envelope.

## Authority and consistency

Outbox lives with the owning DO (in-process `Outbox` freeze in N3; physical SQLite in domain DOs later).  
Projections rebuild from outbox replay + checkpoints.

## Storage and indexes

Ownership manifest `STORAGE_OWNERS` lists registry, access index, team DO. Domains add rows as they land.

## RPC/API contract

None (library).

## Commands and UI surfaces

None.

## Authorization matrix

Handlers take N2 receipts; envelopes may carry `ReceiptContext` (level/type/id/actor), never the brand.

## Events, jobs, retries, and replay

12 product topics. Drain retries until poison (5 attempts). Replay from checkpoint. Idempotency keys on mutating RPCs.

## Tests and parity fixtures

`packages/control-plane/src/control-plane.test.ts` — topics, activity vocabulary, envelope ids, duplicate no-op, poison mark-and-skip, Redis map, secret redaction, ownership.

## Failure modes and rollback

`ControlPlaneError`. Projection rollback = drop + replay from outbox.

## Open decisions

ADR-005 remains Proposed pending owner final read; OD-20 mapping is ruled and frozen in code.
