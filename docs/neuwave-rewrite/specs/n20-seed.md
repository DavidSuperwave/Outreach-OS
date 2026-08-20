# Domain specification — Seed fixtures + schema reference (N20 / SUP-567)

## Verdict and source evidence

OD-1 Branch A: no live data migrates. Every domain's migration gate is
"schema-reference documented + seed fixtures load." Identity-mapping dry runs
(`wrote: false`) are the slice's migration fixture.

## User journeys

A fresh Outreach OS boots with demo Intraplex ICP fixtures: one team, admin
user, document/task, channel, mail thread, company+contact, calendar event,
call, file, search hit, activity fact, notification. Mapping a legacy table
id never writes authorities.

## Invariants

Seed load is idempotent. Dry-run mapping never sets `wrote: true`. No 7-stage
ETL. No DynamoDB/Redis/S3/OpenSearch import.

## Storage and indexes

Seed data is in-process maps on domain slices. Physical D1/R2 load is later.

## Tests and parity fixtures

`packages/seed` — catalog completeness, identity-mapping dry run across
domains, load into in-process slices without throw.

## Open decisions

None for Branch A. N20b is dead.
