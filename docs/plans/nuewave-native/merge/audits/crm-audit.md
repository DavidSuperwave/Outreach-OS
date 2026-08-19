# Domain audit — CRM (companies + contacts)

> Created 2026-08-19 by the merge-review pass (workstream 3, audit 2 of 3).
> Ruled 2026-08-19: "Keep, in the pilot — contents decided at design time
> from what the source really does." This audit is that design input.
> Pointers: `[NW]` = Neuwave clone @ `9f7a26b`, `[OS]` = this repo;
> `path:line` from each root. Facts from code only; verdicts are David's.
>
> **Headline correction for the ledger:** `services/contacts_service` is
> NOT part of the CRM (see §A3). The "keep with CRM" ruling on that row was
> made on a wrong premise and needs a re-look.

## A. Endpoints

### A1. CRM HTTP API — crate `crm`, mounted at `/crm` inside DSS
(`[NW] services/document_storage_service/src/api/mod.rs:250`; router
`crates/crm/src/inbound/axum_router/mod.rs:114-172`; error semantics
:174-266)

| Method | Path | Behavior |
|---|---|---|
| POST | `/crm/companies` | Manual create (name + bare domain) for caller's team; rejects generic email-provider domains; resolves directory metadata on miss; name → team-scoped `custom_name`; 409 if team already tracks domain. Any member. |
| GET | `/crm/companies/{id}` | Company + domains + directory metadata + full contact list in one round trip. Role decides hidden visibility. |
| PUT | `/crm/companies/{id}/email-sync` | Toggle `email_sync`. Admin/owner. 409 `CompanyHidden` when re-enabling on a hidden company. |
| PUT | `/crm/companies/{id}/hidden` | Toggle hidden; cascades to contacts; hide forces `email_sync=false`; un-hide restores contacts, leaves sync off. Admin/owner. |
| PUT | `/crm/companies/{id}/name` | Team-scoped `custom_name` override (COALESCEd over directory name). Any member. |
| GET/POST | `/crm/companies/{id}/contacts` | List (members see visible only) / manual create (email domain must match company; 409 dup; inherits hidden). |
| GET | `/crm/contacts/{id}` | Fetch; members 404 on hidden (or hidden parent). |
| PUT | `/crm/contacts/{id}/hidden` | Admin/owner. Display-only. |
| PUT | `/crm/contacts/{id}/name` | Any member. |
| GET/POST | `/crm/comments/{entity_type}/{entity_id}` | Threads on `crm_company`\|`crm_contact`; create comment / reply (`comments.rs:73-132`). |
| PATCH/DELETE | `/crm/comment/{id}` | Edit/soft-delete own comment only (`CommentNotOwned` 403). |
| GET/PUT | `/crm/settings` | Team CRM config; members may write `team_views`/default view; governance fields (`edit_stages_role`, `move_closed_deals_role`, `delete_records_role`, `closed_stage_ids`) admin/owner (`domain/service.rs:1012-1043`; `team_views` ≤256 KB JSON array). |

### A2. Non-HTTP inbound surfaces

- **Soup list feed:** `list_companies_for_soup` behind `/soup/ast`'s `ccf`
  filter tree (`crates/soup/src/inbound/axum_router.rs:1149-1153`;
  literals in `crates/item_filters/src/ast/crm_company.rs:9-17`). Sorts
  UpdatedAt/CreatedAt/ViewedAt/ViewedUpdated with keyset cursor
  (`crates/crm/src/domain/companies_repo.rs:20-47`); ViewedAt joins
  per-user `UserHistory`. Soup's `populate_properties` pass attaches
  entity-property values to each company row
  (`crates/soup/src/domain/service.rs:502`).
- **Unified search:** `CrmSearchService::search_company_names` +
  `enrich_companies` (`crates/crm/src/domain/search_service.rs`), wired
  into search_service as a Postgres-only source parallel to OpenSearch
  (`crates/search_service/src/api/search/crm_company.rs:1-80`).
- **Email-scope precheck:** `crm_scope_precheck(team_id, domains,
  addresses)` — batched authorization probe the email service runs before
  a CRM-widened email query (`crates/crm/src/domain/model.rs:222-271`;
  consumer `crates/email/src/domain/service/previews.rs:162-202`).
- **Populate/depopulate pipeline** invoked from email_service SQS
  consumers (`crates/crm/src/domain/service.rs:25-144`;
  `services/email_service/src/pubsub/backfill/populate_crm_contact.rs`).
- **AI toolset:** `ListCompanies` (filters, include_hidden admin-gated,
  ≤200) and `GetCompany`; property writes via generic `SetEntityProperty`
  with `entity_type=company` (`crates/crm/src/inbound/toolset/`).

### A3. `services/contacts_service` — NOT CRM

A user↔user connections graph ("who does this user know"): table
`contacts_connections(user1,user2)` with `CHECK(user1<=user2)`
(`crates/macro_db_client/migrations/20260126191437_contacts_db_schema.sql`).
`GET /contacts` (connected user ids), `POST /contacts` (rate-limited
50/user/hour) (`crates/contacts/src/inbound/http.rs:217-245`). Fed by an
SQS `ContactsQueue` produced by DSS (channel membership) and the auth
service; has an outbox worker pushing cache-invalidation to the connection
gateway. It shares only the word "contacts" with the CRM; the CRM has no
dependency on it. **Ledger row needs re-ruling on the corrected premise.**

## B. Tables (`crates/macro_db_client/migrations/`)

- **`crm_companies`** (20260512120000 + alters): team-scoped
  (FK→team CASCADE), `email_sync` (default true), `hidden`,
  `custom_name` (team override — original global `name` dropped
  20260521120000), `manually_created`, `first/last_interaction`,
  updated-at trigger; partial index `(team_id) WHERE hidden=FALSE`.
- **`crm_domains`**: company's lowercased domains;
  `UNIQUE(team_id, LOWER(domain))` — team_id denormalized specifically to
  kill a concurrent-populate duplicate-company race (20260514130000).
- **`crm_contacts`**: `UNIQUE(company_id, email)`, `name`, `hidden`,
  `manually_created`, interaction range.
- **`crm_contact_sources`** (20260514120000): provenance —
  `(contact_id, link_id FK→email_links CASCADE)` unique; **cross-domain FK
  into the email domain** (which mailbox produced this contact).
- **`crm_domain_directory`** (20260521120000 + 20260529164720): **global,
  not team-scoped** enrichment cache keyed `UNIQUE(LOWER(domain))` — name,
  description, icon, plus ~27 Apollo.io columns (industry, keywords[],
  technologies[], employees, revenue, funding, founded, ticker, phone, HQ
  address, `raw jsonb`, `enriched_at`). All-NULL row = negative cache.
- **`team_crm_settings`** (20260522131111 + 20260717161623):
  `crm_enabled` killswitch (**no row = disabled**; owned by the teams
  crate, `PATCH /team/crm`), three governance roles (default admin),
  `closed_stage_ids uuid[]`, `team_views jsonb` (opaque, frontend-owned),
  `default_team_view_id`.
- **`crm_thread` / `crm_comment`** (20260527194808): thread has
  `company_id` XOR `contact_id` (CHECK num_nonnulls=1), resolved flag,
  soft delete; comments ordered, author-owned.
- **`crm_cleanup_candidates` / `crm_cleanup_jobs`** (20260723160259):
  deduped `(link_id, contact_email)` written on email message delete;
  nightly job with a unique-partial-index single-active-job invariant.
- **EAV attachment**: generic `property_definitions`/`property_options`/
  `entity_properties` (20251030100000); enum value `COMPANY` added
  20251128000000 — **no `CONTACT` value; contacts have no custom
  properties**. Seeded system definitions (20260707183206): **Stage**
  (SELECT_STRING, 7 options Lead→Churned), **Owner** (ENTITY→USER),
  **Revenue** (NUMBER). `entity_properties.entity_id` is text — no FK to
  `crm_companies`.
- The per-service `basic_schema_for_testing.sql` snapshots contain **no**
  CRM tables.

## C. UI features (`[NW] apps/web`, SolidJS)

- **Customers view** (sidebar `sidebar.tsx:982`; split id `companies`,
  `componentRegistry.tsx:373`), built on the Soup engine:
  - List/grid with property columns (Stage/Owner/Revenue, sortable Last
    Interaction), per-user column show/hide in localStorage
    (`features/companies/crm/display-options.ts`).
  - **Kanban board grouped by Stage**
    (`features/next-soup/soup-view/views/companies/CompanyKanban.tsx`):
    drag between stage columns bulk-writes the Stage property; NO_STAGE
    column; closed-stage moves gated by `canMoveClosedDeals`.
  - **Saved views** (`companies/crm/saved-views.ts`): `CrmViewConfig`
    {filters, searchText, groupBy, sort, viewMode list|board, stageFilter,
    ownerFilter, activeTab, isDefault} in three tiers — personal (server
    `/saved_views`), team (`team_crm_settings.team_views` via
    `/crm/settings`), and share links (config base64url in
    `/companies?crmView=` — state only). Personal default beats team
    default (`CrmDefaultView.tsx`).
  - **Deal stages** (`companies/crm/deal-stages.ts`): system Stage options
    are immutable, so team customization creates a team-scoped shadow
    SELECT_STRING definition that replaces the system Stage everywhere;
    legacy values label-mapped at read time. Closed set: explicit
    `closedStageIds` else regex heuristic
    `/customer|churned|closed|won|lost/i` (`team-crm-config.ts:90`).
- **Company panel** (`features/companies/Company/Company.tsx`): inline
  rename (custom_name), Discussion threads, **Emails with Team/Me ×
  Signal/All tabs** (Team = soup `ecd` CRM-domain scope; Me = raw `ef`
  address/domain OR-tree over own mailbox — `Company/emailFilter.ts`),
  Details, Properties side section (COMPANY entity type), Contacts with
  add-modal (email pinned to a company domain), Sharing ("Visible in CRM"
  hidden toggle + "Sync Emails", sync disabled while hidden). TODO in
  source: References section blocked on backend `crm_company` entity-type
  support (`Company.tsx:77-78`).
- **Contact panel** (`features/contacts/Contact/Contact.tsx`): rename,
  Discussion, Emails (same tabs, `eca` team scope), link to parent
  company, hidden toggle. No properties.
- Blocks `block-company`/`block-contact` are thin split registrations
  loading by DSS id.

## D. Invariants and business rules (from code)

1. **The CRM is derived from email traffic; manual records are the
   exception.** Populate runs per message per counterparty address from
   the email backfill/upsert fanout
   (`services/email_service/src/pubsub/backfill/populate_crm_contact.rs:12-19`).
2. **Directional write matrix** (`crates/crm/src/domain/service.rs:66-76`):
   *sent* messages may create company+contact+source and merge
   interactions (LEAST/GREATEST); *received* messages never create
   companies — they only bump `last_interaction` on tracked companies and
   upsert contact/source.
3. **Self-domain skip** — own-domain counterparties never populate
   (:575-586). **Generic-provider skip** — gmail/yahoo/etc. never become
   companies, on populate and manual create (:590-596, 700-704;
   `domain/generic_email_domains.rs`).
4. **Company identity = domain set per team** (unique lowercased domain
   per team). **Contact identity = (company, email)**; first observed
   display name wins (:38-41).
5. **Enrichment**: global negative-cached directory; resolver = Apollo.io
   adapter (`outbound/apollo_resolver.rs`) or unfurl fallback; resolve in
   its own transaction, sent-direction only; user renames never write the
   shared directory.
6. **`email_sync` is read-side only** — populate writes regardless;
   re-enabling exposes full history with no backfill (:31-34, 74-76). It
   gates team-wide visibility of members' emails with that company.
7. **Hide semantics**: cascade to contacts + force sync off; un-hide
   restores contacts, not sync; hidden reads/listing require admin.
8. **Team killswitch**: no settings row or `crm_enabled=false` ⇒ populate
   no-ops, endpoints 403, email CRM-scope queries rejected.
9. **GC**: message deletes write cleanup candidates; a nightly single-
   active job depopulates — source row → contact (if no sibling sources
   and not manual) → company (if no contacts, not sync-killswitched, not
   manual). Leaving a team bulk-depopulates that member's link.
10. **Access** (`crates/entity_access/.../crm_company_access.rs:86-93`):
    member+visible→Edit, member+hidden→none, admin→Edit, owner→Owner;
    contacts resolve via parent company.
11. **Property changes are activity events** flowing through
    soup_realtime's Kafka consumer for live lists
    (`crates/properties/src/domain/activity.rs:31`,
    `crates/soup_realtime/src/inbound/kafka_consumer.rs:354`).
12. CRM entities are **not favoritable** at the pin (no references found).

## E. What CF-OS already provides (per `../cf-os-capability-map.md`)

Typed-storage collections over DO SQLite (the relational core fits);
scheduler + hooks (replaces the SQS nightly job); the agent loop +
gatekeeper observations/actions (replaces the ListCompanies/GetCompany
toolset — a CRM surface exposing read methods gets agent access with
approval-gated writes for free). **Missing in-kernel:** any cross-entity
list engine (no Soup equivalent, no cross-workspace data plane), search,
per-record ACL/hidden flags with team roles, comments/discussions,
properties/EAV, activity feeds, favorites, an email link/thread store to
populate from, enrichment (ZoomInfo gatekeeper exists as a resolver
reference pattern).

## F. Factual delta to build

1. The entity model (company/domains/contacts/provenance/settings/threads,
   §B) on typed-storage or D1.
2. The populate/depopulate pipeline driven by an email source — write
   matrix, skips, first-name-wins, interaction merging, provenance-counted
   GC with manual/killswitch preservation.
3. The global domain→metadata directory with negative caching and a
   pluggable resolver (a gatekeeper in CF-OS terms).
4. Visibility machinery: killswitch, hidden cascade + sync forcing,
   member/admin/owner gates.
5. List/board UX: keyset-paginated sortable list (Viewed sorts need a
   per-user view-history store — none in kernel), Stage kanban with
   closed-stage gating, personal + team saved views + URL share links,
   column preferences.
6. Company property/EAV layer (system Stage/Owner/Revenue, team shadow
   stage sets, custom properties, tagged-union values).
7. Comment threads (author-only edit, soft delete, XOR entity constraint).
8. Company name/domain search.
9. Team CRM settings document.
10. The email↔CRM cross-view (`ecd`/`eca` + precheck) — depends entirely
    on what the new email source exposes; old mailbox-scope semantics
    don't map 1:1.

## G. Open design questions for David

1. **What replaces `email_links` as the populate source?** The CRM derives
   from synced mailboxes; under the connectivity-layer model, do Instantly
   campaign leads/replies drive populate, and what is the provenance unit
   replacing `link_id` (per connected account? per campaign?) that GC
   counts against?
2. **Does `email_sync` still mean anything** when email isn't per-teammate
   mailboxes? If not, the hidden/email_sync/precheck triad collapses to
   just `hidden`.
3. **Where does the CRM live** — per-workspace gadget (no cross-workspace
   joins) vs. wrapper Worker/DO storage serving the custom shell? The
   Customers list + search + saved views resemble a shell-level surface,
   pushing toward wrapper-owned storage.
4. **Enrichment provider** — keep the directory concept with which
   resolver (ZoomInfo gatekeeper? none for v1?), and is a global-across-
   teams cache acceptable in the new tenancy model?
5. **EAV or columns for v1** — rebuild the generic property layer or
   hard-code Stage/Owner/Revenue? The team-customizable shadow stage set
   is significant carried complexity.
6. **Role mapping** — source gates member/admin/owner; CF-OS has admins +
   collaborator build/use. What maps to admin-only operations?
7. **Comments** — reuse a chat/thread primitive or port crm_thread/
   crm_comment?
8. **Generic-provider domains**: the source can never CRM a gmail
   counterparty. Acceptable for an outreach product where lead lists are
   often free-mail?
9. **Recently-viewed sorts** — build a view-history store or drop
   ViewedAt/ViewedUpdated?
10. **contacts_service** (§A3) — re-rule on the corrected premise: keep as
    a social/connections capability, park, or kill.
    **Ruled (David, 2026-08-19, batch E): keep as its own capability, in
    the pilot** — standalone user↔user connections graph, independent of
    CRM.

## H. Coverage

Not read (invariants above come from domain-trait doc comments,
migrations, and use sites): `outbound/companies_repo.rs` /
`search_repo.rs` / `apollo_resolver.rs` SQL/impl bodies; axum extractor
internals; full `get_company`/`get_contact` response structs; soup service
internals beyond CRM touchpoints; several FE files skimmed only
(CompanyKanban beyond :50, grid components, create modals via grep);
email-producer fanout beyond grep context; the contacts crate's outbox
internals; whether/where the FE writes UserHistory on company views; all
tests. The CF-OS side was taken from `cf-os-capability-map.md` without
independently re-verifying against `cloudflare-os/` sources.
