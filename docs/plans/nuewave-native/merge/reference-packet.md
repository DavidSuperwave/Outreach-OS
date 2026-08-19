# Reference packet — ruling session

> Updated 2026-08-19 after the merge-review pass (v1 served that pass; this
> v2 pairs with the ruling-session `next-agent-prompt.md`). Everything here
> is a pointer, not a copy — read the named files; do not work from this
> summary alone.

## 1. The two codebases

| | Build repo | Reference repo |
|---|---|---|
| GitHub | `DavidSuperwave/Outreach-OS` | `DavidSuperwave/Neuwave` |
| Local | `C:\Users\Kecin\Projects\Outreach-OS` | `C:\Users\Kecin\Projects\Neuwave` |
| State | branch `david/sup-536-home-cannot-load-ai-models-for-openrouter` (all merge docs uncommitted by David's order) | **pinned** `main@9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf` — never reference a movable branch |
| Role | All new docs land here | Read-only harvest source |

Kernel = the `cloudflare-os` submodule; capability ground truth is
`../cf-os-capability-map.md`. Note two corrections from the review pass:
`cloudflare-os/packages/custom-gatekeeper` does not exist (gatekeeper-github
is the registration reference), and the old team's handoff docs
(`19_BUILD_HANDOFF.md` etc.) do not exist at the pin — see the corrected
table in `agent-brief.md`.

## 2. Read in this order

| # | File (under `docs/plans/nuewave-native/`) | Why |
|---|---|---|
| 1 | `merge/README.md` | The eight rulings, the pin, the folder map (now incl. this pass's five outputs) |
| 2 | `merge/agent-brief.md` | Binding rules: tripwires, pointer pinning, source-over-Linear, verdicts-are-David's |
| 3 | `merge/merge-ledger.md` | **The ledger of record** — verdicts land here; the two ⚠ premise-corrected rows; pattern rows awaiting batch D |
| 4 | `merge/pattern-review.md` | **Batch D options** (D1–D4) with failure modes; the kernel-gap finding (EAV query half) |
| 5 | `merge/route-reconciliation.md` | **Batches A + C options** (§9); the collision register; superseded prefixes |
| 6 | `merge/audits/connectivity-layer-audit.md` | P1 centerpiece: analogues, kernel seams, 9-gap delta, its open questions (feed later design sessions) |
| 7 | `merge/audits/crm-audit.md` | CRM facts; §A3 = **batch E** basis (contacts_service is not CRM) |
| 8 | `merge/audits/company-mailbox-audit.md` | Mailbox facts (24 tables, GCP dependency, token custody question — interacts with batch B) |
| 9 | `merge/endpoint-inventory-backend.md`, `endpoint-inventory-frontend.md`, `schema-harvest.md` | The inventories (do not regenerate); their coverage caveats still apply |
| 10 | `../MISSION.md`, `../roadmap.md` §Status log | Parent context; the "merge review pass" entry summarizes what just happened |

## 3. Ruling state (as of 2026-08-19, end of merge-review pass)

**Ruled and standing:** full absorption; keep-faithful default; channels
full; Soup UX on native RPC (graphql_soup killed); split-layout shell;
CRM + mailbox in pilot; calls/calendar/reminders/activity; real
multi-tenant auth rebuilt (FusionAuth dead, Access rejected); kernel is
the one agent runtime (`ai_toolset` semantics → Gatekeeper session APIs);
four CF services lifted as-is (but see A3 below); five invariants
preserved; agent connectivity layer = P1 centerpiece; business chrome
parked-prepare; patterns were parked pending review — **review is now
done**, rulings pending.

**All five batches ruled (David, 2026-08-19, ruling session)** — dated
"Ruled:" lines live in the review docs; verdicts in the ledger:
- **A**: A1 = R3 hybrid · A2 = L1 router-strips, prefixes confirmed ·
  A3 = coding-agent-worker **dropped from the lift set** (all-history
  search proved no source ever existed and it was never a CF Worker; lift
  set = three services; future coding-agent capability = new ☐ row).
- **B**: **deferred** to auth design time (recorded as the ruling).
- **C**: C1 = supersede by kernel `/api` session push · C2 =
  `/hooks/<source>/*` unified ingress · C3 = **deferred** to the
  native-app-links/MCP-host rows.
- **D**: 1a · 2a · 3a · 4a (riders standing — see `pattern-review.md`).
- **E**: contacts_service = keep as its own capability, in the pilot
  (standalone user↔user connections graph).
`business-chrome-primitives.md` exists (written 2026-08-19, Q19).

**Still-open ledger rows (☐, research columns unfilled)** — for workstream
4 if time remains: documents, projects, search_service, properties,
favorites, foreign_entity, webhook, bots, github, DSS-native chrome
(activity/pins/recents/…), memory, import, onboarding, ai_usage,
ai_projections, streaming/completions, notification_service,
static_file_service, unfurl_service, image_proxy_service,
search_processing_service, scheduled_action, convert_service,
analytics-proxy, Lambda/batch families (~20 handlers — never extracted),
most frontend ◐ rows, most block types, most table groups.

## 4. Coverage caveats to inherit (do not re-trust silently)

- Backend inventory: ~20 queue/Lambda workers and TS-service internals
  never extracted; some DSS handlers from registration lines only.
- Frontend inventory: stale `organization` client entry; 7 legacy settings
  slugs outside nav groups.
- Schema harvest: 4 created-then-dropped tables; TEXT→UUID id migration
  half-finished in source (pattern-review §1 confirms and locates it).
- Each review-pass output states its own coverage in its final section —
  those caveats bind anyone building on it (e.g. `PublicApiImpl`'s RPC
  method surface was never enumerated; soup dynamic SQL ~90% unread;
  `upsert_message.rs` body unread).
- Concept docs in `../reference/platform-context/` still say "four
  databases" — the one-physical-DB finding wins.
