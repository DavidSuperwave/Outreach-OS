# WP-040 — Representative vertical slice

## Prerequisite

Owner approval of WP-030 and the chosen slice.

## Objective

Prove the architecture through one production-shaped flow.

## Candidate: Task create/edit/list/status

The slice should include:

- React shell route/surface;
- command palette and hotkey;
- typed RPC/capability;
- entity ID and authorization receipt;
- authoritative Task/property write;
- outbox/activity event;
- list/Soup projection;
- live update/reconnect;
- migration fixture;
- observability;
- failure/retry/replay;
- visual/keyboard/accessibility parity.

## Deliverables

- implementation and tests;
- accepted domain/architecture pattern updates;
- parity evidence;
- performance and failure report;
- decision on whether broad domain work may parallelize.

## Stop conditions

Stop and return to ADR review if the slice requires multiple new authorities, unbounded kernel changes, or cannot reconcile projections deterministically.
