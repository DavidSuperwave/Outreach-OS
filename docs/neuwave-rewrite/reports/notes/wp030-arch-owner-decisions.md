# WP-030 (part A) — NEW owner decisions raised by the architecture pass

Source: `reports/04-target-architecture-decisions.md` (2026-08-20). Numbered `OD-301…` to avoid
colliding with `OD-1…OD-10` (`reports/notes/wp010-owner-decisions.md`) and the un-numbered items
in `reports/notes/wp000-owner-decisions.md` / the WP-020 notes. Items already raised elsewhere
are NOT repeated here except OD-303, which re-raises a wp000 item because WP-030 now hard-blocks
on it. Format matches the intended `reports/06-owner-decisions-needed.md` ledger.

---

## OD-301 — Dispositions for the 4 `needs-review` kernel RPC rows

- **Evidence:** `reports/02-rpc-compatibility-ledger.csv` + WP-020 coverage note: 178/182 rows
  `preserve`; 4 flagged: `PublicApi.authenticateFromCfAccess` (only meaningful behind Cloudflare
  Access — is Access-mode auth in scope for the Neuwave deployment at all, given the ruling
  "Access is not the auth model"?), and the Cloudflare free-tier limits/top-up trio
  `AuthenticatedApi.getCloudflareUsage` / `listCloudflareAccounts` / `selectCloudflareAccount`
  (+ `ServerConfig.cloudflareLimitsEnabled`): keep live, keep-but-disabled, or defer?
- **Affected:** ADR-002 freeze contents; §1 and §18.5 of `04-target-architecture-decisions.md`.
- **Options:** (a) keep all four live (zero kernel delta, dormant surfaces); (b) keep-but-
  disabled via ServerConfig (recommended default [R]); (c) defer/remove (requires kernel-budget
  ADR-014 justification — not recommended).
- **Blocked work:** none hard; the compatibility freeze note should record the answer.

## OD-302 — One projection substrate or two: Soup index vs search index

- **Evidence:** Ledger `search_service` row: "the ruled 'required materialized-index layer' and
  the search index are the same architectural slot and should be designed together, not as two
  stores" — a proposal with an **empty verdict**. §4/§11 of the architecture doc keep them as
  separate D1 schema families with one owning consumer each (compatible with either ruling) but
  the ADR-005/ADR-006 pair should not freeze without the owner picking.
- **Options:** (a) one D1 projection plane, two schema families, shared consumer framework
  (what part A assumes); (b) fully unified index (one consumer, FTS columns on the soup index —
  cheaper ops, riskier coupling of freshness SLOs); (c) fully separate services (more moving
  parts; cleanest blast-radius).
- **Blocked work:** ADR-005/ADR-006 finalization; W3/W7 consumer implementation split.

## OD-303 — (Re-raise, now blocking) Create ledger rows for frecency and the activity-events vocabulary

- **Evidence:** wp000 §D9 raised these missing rows; WP-030 §12 now *designs* against exact
  harvested constants (frecency 0.7/0.3, 0.1/h decay, 10 events; the closed 10-action
  vocabulary whose renames are storage migrations). Building per-user User-DO frecency lanes
  and the D1 activity log without rows means two load-bearing contracts exist only in prose.
- **Options:** (a) add both rows with Q19-default-keep verdicts and the constants as the
  contract; (b) fold them into the DSS-native split rows when OD-5's N1/N2/N3 choice is made.
- **Blocked work:** §12 parity fixture sign-off; ADR-012 vocabulary registration.

## OD-304 — Does the daily whole-workspace memory sweep (and the Home-recommendations surface) survive in an outreach product?

- **Evidence:** Ledger `memory` row: generation is "a full agent session over the user's
  workspace … one of the most expensive recurring AI costs in the old system"; the row's own
  open question is affordability/desirability. Ledger `ai_projections` row: "does the
  Home-recommendations surface exist in an outreach product at all — the whole row is
  downstream of that." Both rows are default-keep via Q19, but Q19 cannot answer a cost/product
  question; §14 designs the mechanism (per-user alarms, regenerate-on-staleness) either way.
- **Options:** memory — (a) keep 24h cadence; (b) keep mechanism, stretch cadence / trigger on
  activity thresholds; (c) drop background generation, keep on-demand. Home recommendations —
  (a) keep; (b) park with business chrome; (c) drop.
- **Blocked work:** §14 wrapper scope for W6; AI-cost budget line (AiFeature `Memory`,
  `AiProjection` tags make the spend visible either way).

## OD-305 — Team-scoped external credentials (GitHub App installations and successors)

- **Evidence:** verified — GitHub App installations are the only *team-scoped* external
  connection at the pin (`github_app_installation`, `source_type ∈ team|user`); the kernel's
  connected-accounts/gatekeeper grants are per-user; `audits/connectivity-layer-audit.md` §C3
  records team-credential sharing as an open gap. §15 assumes a Team-DO-owned install lane; the
  connectivity centerpiece (Instantly etc.) will hit the same question immediately (team-shared
  API keys vs per-user connections).
- **Options:** (a) wrapper-owned team-connection model (Team DO custody, gatekeeper sessions
  minted per use) — no kernel change, what part A assumes; (b) kernel extension for team grants
  (ADR-014 budget case required); (c) per-user-only connections with sharing conventions
  (contradicts the harvested GitHub behavior).
- **Blocked work:** §15 GitHub scope; connectivity-layer connector design (P1 centerpiece);
  ADR-002 connector posture.

## OD-306 — Analytics/telemetry stance (PostHog + Datadog vs kernel-native)

- **Evidence:** Ledger `analytics-proxy` row (verdict empty): "the row is a stance, not an
  engineering task" — keep PostHog+Datadog behind the first-party `/i/*` proxy (already a CF
  Worker; near-zero effort) or adopt the kernel's own analytics/flag position. Two behaviors
  need an *explicit* decision if kept: the session-replay recorder rename (`runtime.js`,
  deliberate ad-blocker evasion — a privacy/product decision) and server-side DD_API_KEY
  injection (worth keeping deliberately). CMD-L telemetry parity (§0.4-11, `hotkey_use` etc.)
  and every §-Observability block in part A currently assume *some* product-analytics sink
  exists; feature-flag machinery (PostHog flags gate onboarding generations and sidebar links)
  also hangs on this.
- **Options:** (a) keep the proxy + both providers as-is (fastest; recorder-rename decision
  required explicitly); (b) keep Datadog OTLP only, drop PostHog (loses product flags —
  replacement needed for flag-gated surfaces); (c) kernel-native/none (respec telemetry parity
  rows in CMD-L).
- **Blocked work:** observability sections' sink choice; flag-gated command rows (`go-to`
  sidebar expansion, onboarding generations); G-019 disposition of the worker itself.
