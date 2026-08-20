# Data migration and cutover

The rewrite is incomplete until existing data can be moved, reconciled, and safely cut over.

## Migration stages

### 1. Source profiling

For every old store:

- table/collection/object inventory;
- row/object counts;
- tenant and identity keys;
- null/invalid/orphan rates;
- largest objects and hot partitions;
- retention requirements;
- encryption and secret fields;
- data that no longer has an owner;
- references to external providers.

### 2. Canonical identity mapping

Create durable mappings for:

- users and teams;
- entity IDs and entity types;
- projects/folders;
- documents and content versions;
- messages/threads;
- external account/connection IDs;
- file/object keys;
- permission principals.

Mappings must be resumable and inspectable. Do not rely on transient in-memory maps.

### 3. Transform and load

Every migration job needs:

- deterministic source cursor;
- idempotency key;
- target write contract;
- retry policy;
- poison record handling;
- checkpoint and metrics;
- reconciliation query;
- rollback or target cleanup behavior.

### 4. Projection rebuild

Authoritative records and query projections are separate concerns. Load authorities first, then build/rebuild D1/search/activity/frecency/notification projections from deterministic events or scans.

### 5. Shadow and dual-run

Use the least risky method supported by each domain:

- shadow reads with comparison;
- dual writes through one controlled adapter;
- event mirroring;
- read-only cutover before write cutover;
- tenant-by-tenant cutover;
- feature gates with rollback.

Do not create two unconstrained authoritative writers.

### 6. Cutover gates

A domain may cut over only when:

- reconciliation thresholds pass;
- authorization parity passes;
- API/command/UI parity gates pass;
- production observability is live;
- rollback is tested;
- migration can resume after interruption;
- support/runbooks are ready.

### 7. Decommission

Decommission evidence includes:

- old writes disabled;
- final reconciliation complete;
- retention/export requirements met;
- secrets revoked;
- queues/webhooks stopped;
- DNS/routes removed;
- dashboards/alerts retired;
- rollback window closed by owner decision.
