# Initial gap and risk register

Codex must validate, refine, and assign each item. Do not treat this list as complete.

| ID | Gap/risk | Why it matters | Required resolution |
|---|---|---|---|
| G-001 | Closed ledger may live on planning branches rather than implementation baseline | Agents can implement stale scope | Locate canonical ledger and record its exact commit/path. |
| G-002 | Approximate RPC method count | Silent contract loss | Generate exact interface/method ledger and caller map. |
| G-003 | Distributed/dynamic command registrations | Keyboard/command parity can be lost | Generate sites, then manually expand runtime loops and scopes. |
| G-004 | Entity access was misclassified as chrome in earlier scoping | Authorization touches every kept domain | Design first-class policy/receipt subsystem and port test semantics. |
| G-005 | Soup requires cross-entity query/live-update architecture | DO isolation does not provide a unified list automatically | Define materialized index, subscription, hydration, and access filtering. |
| G-006 | Static-file metadata source was incompletely harvested | Migration can lose files or ownership | Inventory old metadata store and reconcile objects. |
| G-007 | DNS-resolution-based SSRF defense does not map directly to Workers | Unfurl/image/webhook fetches can become vulnerable | Design an explicit safe-fetch service/policy and adversarial tests. |
| G-008 | Self-hosted converter depends on LibreOffice and possibly ffmpeg | Cloudflare Workers cannot host the same substrate | Isolate exception, define API, capacity, sandbox, observability, rollback. |
| G-009 | Notification scope may be stale in old provisional plans | Kept domains emit notifications | Reconcile 19 types, preferences, unread, and three egress channels. |
| G-010 | Seven-source search is an owner override | Simplified D1 search may violate product intent | Harvest source mix, ranking, freshness, enrichment, and failure behavior. |
| G-011 | Native/desktop assumptions in routes, hotkeys, files, updates | Browser-only rewrite can silently lose behavior | Classify each native behavior: keep, web replacement, desktop later, or owner decision. |
| G-012 | Cloudflare OS is pinned early-access software | Custom shell/kernel changes create upgrade burden | Pin, diff, contract-test, and budget kernel/frontend deltas. |
| G-013 | Cross-domain data migration is not yet executable | A green new system may still be unusable | Produce source profiles, mapping tables, resumable loaders, reconciliation. |
| G-014 | Deliberate OpenAI proxy exception is ungoverned | Cost, security, and reliability exposure | Document isolation, quotas/alerts where allowed, and owner. |
| G-015 | Branding/source-reuse tripwires | Legal/product risk | Automated scans for `macro-*`, logos, copied assets, and Rust reuse. |
| G-016 | Plan documents contain historical contradictions | Agents may pick whichever plan is convenient | Write one conflict report with authoritative resolution and open decisions. |
