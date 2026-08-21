# Domain specification — CRM companies / contacts / enrichment (N12 / SUP-558)

## Verdict and source evidence

Wave 4b; most decoupled domain — parallel filler once N6 passed. Ruled keep
(2026-08-19): companies split + company/contact blocks. `contacts_service` is
**not** CRM (J15 re-ruled): it stays a standalone user↔user graph. CRM contacts
are company-linked records. 05-MAP row 10: company view reconciles linked
contacts, email activity, and properties. Source kanban at the pin is companies
— product kanban parity lives here, not on tasks (N8). Command rows counted
inside soup-entity (3 of 22). ADR-005 / ADR-006 accepted. Instantly
send/activate out of scope. No kernel patches.

## User journeys

Create or derive a domain-keyed company for the team. Attach contacts to that
company (never a user-graph edge). Set Stage / Owner / Revenue. Company view
joins contacts + properties + email-link / activity slots. Companies kanban
groups the same Soup rows by Stage. Enrich from the global domain directory
without silently overwriting user-entered fields. Hide a company. Killswitch
team CRM sync (admin). N11 mail evidence populate/depopulate and N17 activity
feeds attach to the slots when those nodes land.

## Invariants

Soup type is `crm_company` (`co_`). Contacts are `crm_contact` (`ctc_`) and
**require** a parent company — not `contacts_service`. Company identity is
`(tenant, domain)`. Handlers take receipts. Query never mints. Projection is
rebuildable. Duplicate idempotency keys are no-ops. Derived rows retract when
email evidence retracts (unless the user edited fields). Enrichment never
overwrites `source: "user"` fields. CRM entities are not favoritable at pin.
Killswitch mutations are team admin. No Instantly send / activate / start.

## Entities and identifiers

- `crm_company` (`co_`) — team, domain key. Soup + search coverage type.
- `crm_contact` (`ctc_`) — company-linked person. Not a Soup item type.
- `email_link` — association slot (N11 fills). Not a registry type.
- Directory entries — global, non-tenant (KV cache).

`COMPANY` property entity type maps to `crm_company`. Stage / Owner / Revenue
are COMPANY-only system keys (`pdef_stage` / `pdef_owner` / `pdef_revenue`).

## Authority and consistency

In-process `CrmSlice` stands in for the **per-team CRM DO**: serialized
deriver-vs-user writes and the killswitch. One DO per company is over-granular.
Named fallback: shard by company-domain hash within the team if a pilot team's
mail volume breaks the hot key. Physical Durable Objects are a later lift.

## Storage and indexes

In-process company + contact maps (authority) + N3 outbox topic `soup` + N4
`ProjectionPlane` (lists/search for `crm_company`). N3 `STORAGE_OWNERS` rows:
`crm_company` (DO), `crm_contact` (D1). Directory is a KV stand-in. Email-link
and activity slots are join projections, empty until N11 / N17.

## RPC/API contract

Typed `CrmApi` capability (ADR-002). Not added to kernel `api.ts`. Company /
contact CRUD, hide, enrich, killswitch, kanban move, evidence apply/retract,
company-view join. No Instantly send/activate methods. Enrichment `fetcher` is
accepted so tests can prove it is never invoked (OD-6 / Apollo Gatekeeper later).

## Commands and UI surfaces

3 soup-entity rows: `soup-entity.company-stage` / `company-owner` /
`company-revenue`. Chrome: `go-to.companies`. Pointer-driven `block-company` /
`block-contact` (parity via fixtures). React: `CompanyWorkspace` /
`CompanyKanban` / company view on Shell path `/companies` (split `companies`).

## Authorization matrix

`crm_company_access`: team member → view; admin → edit; owner → owner.
`crm_contact_access`: same lattice, inherits parent company. Killswitch: team
admin (`canToggleCrmKillswitch`). Directory reads are global but
tenant-decorated (`directoryTracksDomain`). Cross-tenant mint denies.

## Events, jobs, retries, and replay

Topic `soup` (no dedicated CRM bus topic in the frozen 12). Replay from outbox.
Poison publishes marked-and-skipped. Evidence apply is idempotent by
`(team, domain, evidence id)`. Activity facts use the closed 10-action
vocabulary (`created` / `edited` / `deleted` / `property_changed`).

## External providers

Apollo + unfurl-fallback are Gatekeeper / safe-fetch consumers (OD-6). This
node ships a directory stub only. Instantly is out of scope. Mailbox send is
N11 — this package does not send mail.

## Migration and reconciliation

OD-1 Branch A: shapes + fixture mapping dry run from `crm_companies` /
`crm_contacts` / `email_links` / `crm_directory` / `crm_hidden`
(`wrote=false`). No Postgres load. Derived rows re-derive from mail rather
than ETL. Manual Stage / Owner / Revenue / hides would ETL only under Branch B
(dead).

## Tests and parity fixtures

`packages/crm/src/slice.test.tsx` — mapping dry run `wrote=false`, row-10
company-view reconciliation, companies kanban vs Soup, company-linked contacts
(no contacts_service), enrichment stub + precedence, populate/depopulate +
killswitch, domain-keying across tenants, hide + SEC-3, idempotency + rebuild,
3-command freeze + no Instantly send, SSR CompanyWorkspace/CompanyKanban on
`/companies`, STORAGE_OWNERS rows.

## Observability/SLOs

Derivation lag from mail event → company visible (< 60s p95, N11). Enrichment
success rate; directory cache hit; per-team killswitch metric.

## Failure modes and rollback

`CrmError` / `AuthzError` / missing receipt / killswitch. Projection rollback
= drop + `rebuildProjection()`. Wrapper rollback = previous package; kernel
untouched. Derived data rebuildable by construction.

## Open decisions

- **OD-6** — live Apollo / unfurl fetch behind safe-fetch (stub only here).
- N11 email-link deriver feed (slots are ready).
- N17 activity / frecency consumer (slots are ready).
- Physical team CRM DO + domain-hash shard fallback.
- Full 18-key option palettes beyond Stage seed (N8 leftover, Stage seeded).
