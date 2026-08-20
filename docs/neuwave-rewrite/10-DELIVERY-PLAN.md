# Delivery plan and build order

## Wave 0 — Ground truth

Execute WP-000.

Outputs:

- verified repo/pin report;
- source/branch role map;
- current closed-ledger location;
- contradictions between package assumptions and current source;
- safe local run/test commands.

## Wave 1 — Plan audit and missing inventories

Execute WP-010 and WP-020.

Outputs:

- plan coverage and contradiction review;
- exact RPC ledger;
- exact command/hotkey ledger;
- route/service/storage inventory corrections;
- premise-breaking findings escalated to owner.

## Wave 2 — Architecture spine

Execute WP-030.

Required ADRs:

- shell strategy;
- API/RPC compatibility boundary;
- entity and authorization core;
- authoritative state and projection model;
- cross-entity list/Soup architecture;
- search architecture including seven-source behavior;
- sync/collaboration strategy;
- notifications/realtime;
- files/unfurl/image-proxy safety;
- converter boundary;
- migration/cutover;
- kernel-change budget.

## Wave 3 — Representative vertical slice

Execute WP-040 only after owner approval.

The slice proves the architecture and creates reusable patterns. It should be production-shaped, not a throwaway demo.

## Wave 4 — Domain implementation waves

Execute WP-050 to turn the closed ledger into a dependency graph. Recommended sequencing after the slice:

1. identity/tenant/entity-access spine;
2. entity registry, documents/projects, properties/tasks;
3. Soup/list/query projections and command shell;
4. channels/messages/realtime;
5. files/static/unfurl/image/converter;
6. CRM, mailbox/email, calendar/calls;
7. search, activity/frecency/favorites/notifications;
8. agent connectivity, MCP, webhooks, automation;
9. business chrome/onboarding/billing redesign after owner spec;
10. migration, shadow, cutover, decommission per domain.

This order is a proposal. The final build graph must be generated from current ledger dependencies and source evidence.

## Parallel-work rule

Parallelize only when teams do not share an unresolved foundational contract. Do not run five domain implementations in parallel while entity IDs, permission receipts, event envelopes, or projection ownership are still changing.
