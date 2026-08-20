# Domain specification — Search (N16 / SUP-563)

## Verdict and source evidence

Wave 4c. ADR-007 coverage contract: **seven entity types on ONE index**, not
seven providers. Corrected mapping: `email` → `email_thread`, `call_record` →
`call`. N4 already froze `SEARCH_ENTITY_TYPES`, `SEARCH_SCHEMA_DDL`, and
lexical `SearchIndex` (receipt-filtered; ranking deferred here). This node
**wraps** soup `SearchIndex` / `ProjectionPlane` — it does not fork FTS
tables. Indexing consumers hang off the outbox; enrichment hydrates from the
lists family **after ids**. Vectorize deferred. Instantly unused. No kernel
patches. No `cloudflare-os/` edits.

**OD-15 remains OPEN.** Title-boost ranking (`title matches × 3 + body
matches`; stable sort score desc, `updatedAt` desc, `entityId`) is the
golden-query **prototype**. Owner sign-off on the ranking/freshness tolerance
band is still required before the substrate hardens.

## User journeys

Producers emit outbox envelopes for the seven coverage types. `SearchSlice`
ingests them onto the shared projection plane. `/search` runs `queryUnified`
across all seven; a type filter uses `querySimple`; a channel mount uses
`queryChannel` and **denies** unless the caller presents a view receipt on
that channel. Results list hits with lists-family title/snippet. Tombestones
drop from the index. Poison bodies (`index_failed`) never appear.

## Invariants

Query never mints receipts. Results are receipt-filtered **before**
enrichment so revoked titles/snippets do not leak. Types outside coverage
(`calendar_event`, `reminder`, …) are never indexed. Re-index by id is a
no-op (idempotent). Tombstones de-index. Empty / pathological bodies are
marked `index_failed` and skipped. Lists and search do not share storage;
enrichment reads `SoupIndex.get`, never a second store. No new soup command
rows (N4 froze 59).

## Entities and identifiers

Coverage freeze (soup / ADR-007):

| Source name | Indexed type |
|---|---|
| document | `document` |
| project | `project` |
| chat | `chat` |
| channel | `channel` |
| email | `email_thread` |
| call_record | `call` |
| crm_company | `crm_company` |

Search is not itself an entity. Hits are `{ entityType, entityId }` plus
enriched title/snippet/score.

## Authority and consistency

`SearchSlice` is the indexing consumer (queue-consumer shape). Authority
stays on domain DOs; this node projects. In-process `ProjectionPlane` is the
N4 freeze (physical D1 FTS5 later). Backfill is `backfill(outbox)` — DO+alarm
stand-in (pattern 4a), not a dispatcher.

## Storage and indexes

N3 `STORAGE_OWNERS` row `soup_search_index` (owner `soup-projector`,
checkpoint `soup.search`) already frozen by N4. N16 does not add a second
search store. Ranking overlay + `index_failed` map are wrapper-local.

## RPC/API contract

Typed `SearchApi` (ADR-002). Not added to kernel `api.ts`. Mounts matching
source `search_service`:

- `queryUnified(q, receipts)` — all 7 types
- `querySimple(q, type, receipts)` — one coverage type
- `queryChannel(q, channelId, receipts)` — membership-gated

`ingest(outbox)` applies new envelopes. `backfill(outbox)` rebuilds.
No Instantly methods. No send/activate.

## Commands and UI surfaces

0 new command rows. Chrome parity reuses N4 search-view enablement:

`N16_PARITY_COMMAND_IDS = ["soup.search-focus", "soup.ask-ai", "soup.filter-by-type"]`

React: `SearchWorkspace` on Shell path `/search`, panes
`[{ type: "search", id: "_" }]`, `data-slice="search"`,
`data-surface="search.results"`, query input, 7-type hit list. Browser
exports are UI-only (`search/browser` does not import `control-plane` or
`node:crypto`).

## Authorization matrix

View receipts filter hits (`search.results` is an ADR-004 tagged surface).
`queryChannel` denies without a view receipt on that channel (no title leak
in the error). Cross-tenant outsider receipts yield zero hits. Query never
mints.

## Events, jobs, retries, and replay

Same domain outbox that feeds lists. Poison **bodies** are skipped and
counted (`index_failed`); outbox poison rows stay marked-and-skipped per
N3. Replay / backfill rebuilds from non-poison envelopes. Duplicate event
ids are no-ops.

## External providers

| Provider | Posture |
|---|---|
| soup `SearchIndex` / `ProjectionPlane` | Wrapped; not forked. |
| D1 FTS5 | DDL frozen at N4; live SQLite not in this node. |
| Vectorize | Deferred (ADR-007; no semantic requirement harvested). |
| Instantly | Out of scope. Unused. |

## Migration and reconciliation

No index migration: rebuild from authorities + events (both OD-1 branches).
Identity mapping is producer-owned (N7/N9/N11/N12/N13). This node consumes
canonical types only.

## Tests and parity fixtures

`packages/search/src/slice.test.tsx` — 7-type golden query (unique
`crm_company` title token ranks first under title-boost), tombstone
de-index, outsider receipt filter (no title leak), out-of-coverage types
never indexed, re-index idempotent, lists-family enrichment, poison
`index_failed`, `backfill` rebuild, `queryChannel` membership deny,
0 new command rows + 3 chrome ids, `SearchWorkspace` SSR, browser-safe
exports.

## Observability/SLOs

Per-type indexing lag = projector lag. Poison count = `failures()`.
Golden-query score tracked by the fixture (OD-15 band still open).

## Failure modes and rollback

`SearchError` (`denied`, `unknown_type`, `index_failed`). Wrapper rollback =
drop this package; lists (ADR-006) keep working. Index rollback = drop +
`backfill`. Kernel untouched.

## Open decisions

- **OD-15** — OPEN. Title-boost golden set is the prototype. Owner must
  sign off the ranking/freshness tolerance band (BM25 vs FTS5) before the
  substrate hardens. Vectorize remains optional and out of this node.
- Live D1 FTS5 (N4 DDL, physical SQLite) — later lift of `SearchIndex`.
- Analyzer / per-type field mappings (04-TARGET follow-up).
