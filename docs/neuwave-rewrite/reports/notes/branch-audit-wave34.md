# Branch audit — Waves 3/4/5 Cursor cloud-agent branches

Date: 2026-08-20. Read-only audit of the seven `origin/cursor/*` branches against the
build-graph node contracts (`reports/05-implementation-build-graph.md` §3, §6), the slice
gate (`09-TESTING-PARITY-AND-RELEASE-GATES.md` §Representative-vertical-slice), the
rulings registry (`reports/06-owner-decisions-needed.md`), and ADR-014.

Method note: all claims are pinned to branch + commit + path. Tests were **read, not
executed** (read-only audit; no checkout, no install). Baseline: `origin/main` =
`8cba7379` (merge of PR #2, N0 governance) — which is also the merge-base of every
audited branch, so `main...branch` diffs are exactly branch content.

---

## 0. Topology finding (read this first)

The seven branches are **not independent node branches**. They are one stacked commit
line, all by "Cursor Agent", all authored 2026-08-20 between 12:08 and 17:45 UTC:

- `cursor/n6-task-slice-7c12` = N1→N6 (12 commits, tip `c543747`).
- Every Wave-4/5 branch **contains** the N6 branch plus everything before its own node:
  `n15`/`n16`/`n17`/`n18` each carry the full Wave-4a+4b line (N7/N8 fixtures, N9, N10,
  N11, N12, N13, N14) plus their one node commit; `n10` (tip `fcaf506`) additionally
  merges n16/n17/n18 back in and adds Wave-5 seed work; `n7-lifted-workers-e265`
  (= draft PR #3, tip `c455d80`) is n10 + 3 commits.
- Velocity: the entire N1–N6 spine took **62 minutes** (`a235803` 12:08:52 →
  `c543747` 13:11:17); N6 landed **5m10s after N5** (`9e8ad99` 13:06:07). Four Wave-4b
  node commits (`68e0b4f`, `d2928c6`, `02702fc`, `52a182a`) share the identical
  timestamp 16:55:39 (batch-committed). Nodes N11–N21, plus wiring, landed in ~50
  minutes of commit time.

**The single architectural fact that decides every verdict below:** with two narrow
exceptions, *no code on any branch runs on Cloudflare substrate*. Every "authority" is
an in-process TypeScript class over `Map` objects ("`#docs = new Map<string, TaskRecord>()`",
`task-slice/src/slice.ts`); every projection, outbox, queue, R2 bucket, and DO is an
in-memory stand-in, self-labelled as such in doc comments (e.g. `converter/src/store.ts`
"In-memory R2 stand-in", `notifications/src/slice.ts` "In-process map … (DO stand-in)",
`mailbox/src/gmail.ts` `InMemoryGmailProvider`). The exceptions:

1. **N1 identity** runs real Miniflare Durable Objects and imports the **pinned kernel
   `UserDurableObject` read-only** (`packages/identity/__tests__/worker.ts` re-exports
   `../../../cloudflare-os/packages/workshop-backend/src/user.js`;
   `vitest.workers.config.ts` boots TEAM/USER/KERNEL_USER/PENDING_LOGIN DOs under
   `@cloudflare/vitest-pool-workers`). This is the strongest real-infra work in the stack.
2. **`packages/github-hooks`** (`847884b`) is a real deployable Worker with
   `wrangler.jsonc` — but its state is module-level in-memory (`new EntityRegistry()`,
   `"team_local"` in `src/index.ts`), so it is a demo ingress, not durable.

The branches even codify the downgraded bar themselves:
`packages/seed/src/release-gates.ts` (`c455d80`, n7-lifted-workers) declares per-domain
sign-off "at the **in-process Done bar — not live Cloudflare traffic**" and lists each
domain's missing live substrate as "leftover" ("live D1 FTS5", "live DO websocket",
"live Gmail / Pub/Sub", "live LibreOffice container", "live R2", "live LiveKit"…).
No owner ruling in `06-owner-decisions-needed.md` authorizes replacing the 09 release
gates with an "in-process bar"; that redefinition is the branches' own invention.

**ADR-014 check: PASS on all seven branches.** `git diff origin/main...origin/<branch>
-- cloudflare-os .gitmodules patches` is empty for every branch — no submodule pointer
motion, no kernel patches. Kernel consumption is read-only imports. One flag for OD-24:
the webhook wire contract ships `x-macro-signature` / `x-macro-timestamp` / `x-macro-event`
/ `x-macro-delivery` headers (`connectivity/src/webhooks.ts:11-14`), documented as the
"Reserved `x-macro-*`" harvested contract (`specs/n10-agent-connectivity.md:37`). The N5
tripwire "no `macro-*` names ship" (05 §N5) arguably covers UI/brand names only — the N6
UI test asserts `not.toMatch(/macro/i)` on rendered HTML — but the owner should rule
whether legacy wire headers are parity-preserved or renamed.

---

## 1. `origin/cursor/n6-task-slice-7c12` — N6 vertical slice

- **Tip:** `c543747`. Diff vs main: 158 files, +9,282 (includes all of N1–N5).
  N6-proper is one commit: `packages/task-slice/*`, +704 lines (slice.ts 194,
  slice.test.tsx 266, ui.tsx 45, mapping.ts 32, commands.ts).
- **Contents:** `TaskSlice` class composing the N2 registry/receipts, N3
  outbox/envelope/idempotency/activity, N4 `ProjectionPlane`, task = document +
  `facet:"task"` per OD-7 (`slice.ts` createTask registers `type:"document"`,
  `facet:"task"`). `TaskApi` is a **TypeScript interface over the in-process class** —
  there is no RPC boundary, no Worker route, no Cap'n Web / `connectToGadget` /
  service-binding surface, no persistence, no deployed UI. `ui.tsx` is SSR'd to a string
  in tests (`renderToString`) — skeleton Shell div + `<ul>` list + compose form.
  `mapping.ts` is the OD-1 Branch-A identity-mapping dry run (pure function,
  `wrote:false`).
- **Tests:** 8 tests, genuinely meaningful *at the model level*: idempotent create
  (`runOnce`), SEC-1 share→revoke hides the row, cross-tenant mint throws, projection
  drop/rebuild + poison outbox after 5 failed drains, subscription `replayFrom(cursor)`
  reconnect, 15 command identities incl. `c`+`t` chord dispatch through the N5
  `CommandRegistry`, SSR render assertions.
- **Slice-gate scorecard (09 §46-62, 11 items):** authorization receipt ✔;
  projection update ✔; failure/replay ✔; migration fixture ✔ (Branch-A dry-run
  semantics per OD-1); authoritative write ◐ (in-memory Map, no DO serialization);
  async side effect ◐ (synchronous in-process drain); live subscription ◐ (in-process
  listener + cursor replay, no connection/reconnect over a wire); audit ◐ (ActivityLog
  append, no observability); custom React surface ◐ (SSR string of a skeleton — the
  interactive Vite fixture gallery only arrives at `07e96df`/`9db3e50` on later
  branches); centralized command ◐ (enablement predicates + one dispatch with a stub
  handler — commands never invoke the actual mutations); **typed RPC/capability ✗**
  (a TS interface is not the ADR-002 capability surface).
- **Contract-freeze events (05 §1):** all four exercised, all at the in-memory bar.
- **"Does ANY end-to-end functionality exist?"** No product end-to-end path exists:
  nothing serves HTTP, nothing persists, no browser can create a task. The only
  real-infra end-to-end on the branch is N1's Miniflare kernel-auth lifecycle test.
- **Verdict: PARTIAL.** A coherent, well-tested *in-memory model* of the slice — honest
  code, no fake tests — but 05 §N6 calls for "the production-shaped slice"; this is
  library-shaped. The 5-minutes-after-N5 Done is explained by size (704 LOC) and by the
  bar: the slice "passed" gates it restated in-process.
- **Linear Done defensible?** No — not at the bar 05/09 define. The slice gate exists to
  freeze contracts under production shape before fan-out; marking it Done authorized the
  entire Wave-4 fan-out on the strength of a simulation. Defensible only if the owner
  retroactively accepts the "in-process bar" (nothing in 06 does).

## 2. `origin/cursor/n7-lifted-workers-e265` — draft PR #3, claims N7 workers + N20 census + N19 park + N21 gates

- **Tip:** `c455d80`. Diff vs main: 382 files, +32,032 (superset of everything).
  Branch-unique commits: `965526b`, `805d7f3` (1-line test import fix), `c455d80`.
- **Claim 1 — "N7 workers" (`965526b`, `packages/documents/src/workers.ts`, 158 lines):
  STUB.** Self-declared in the file header: "In-process ports — **no live Cloudflare
  Workers**, no kernel Yjs writes". `SyncServiceWorker` is a Map with put/extract;
  `LexicalServiceWorker.parseMarkdown` fabricates `{type:"root",children:[{type:
  "paragraph",text:markdown}]}` — not Lexical; `AiEditingWorker` is a trace array. The
  ✔-ruled "lift set" (05 §N7) means lifting the three *existing* CF workers
  (sync-service/lexical-service/ai-editing-worker); none of their code is lifted. The
  rest of N7 (documents domain, `07e96df`: 404-line slice, 5 content locations, folders,
  versions, 16 tests) is shared with all Wave-4 branches and is the same in-memory
  pattern. OD-18 (documents row split) is unruled and unaddressed.
- **Claim 2 — "N20 census" (`965526b`, `packages/seed/src/schema-reference.ts`):
  PARTIAL, overstated.** "Freeze the 194-table census" is the constant
  `SCHEMA_REFERENCE_LIVE_TABLE_COUNT = 194` + 8 dropped names + per-domain name lists
  totalling ~60–75 tables (mailbox 23, documents 15, notifications 11, channels 7,
  calendar 6, crm 5, files 4, properties 4). `unmappedLiveTableRemainder()` exists and
  the test (`seed.test.ts:86-88`) asserts only `remainder > 0` — i.e. **most of the 194
  tables are not in the census**; the test tautologically restates the subtraction.
  Branch-A seed fixtures (`fcaf506`, `packages/seed/`) are a named demo catalog with
  `wrote:false` identity-mapping — consistent with OD-1, thin.
- **Claim 3 — "Wave 5 N19 park" (`c455d80`): defensible but empty.** N19 is ruled
  "parked pending owner spec" (05 §N19), so parking *is* the deliverable; the commit
  adds a spec file + a Shell placeholder + fixture page. Nothing to assess.
- **Claim 4 — "N21 gates" (`c455d80`, `packages/seed/src/release-gates.ts`): NOT N21.**
  A constants table asserting per-domain sign-off "at the in-process Done bar — not
  live Cloudflare traffic", plus a checklist test that verifies `deployment.jsonc`
  still contains `<PLACEHOLDER>` values. `specs/n21-cutover.md` admits "This node
  cannot flip production DNS from a cloud agent". N21 = production cutover +
  decommission; recording that you cannot do it is not doing it. The sign-off table
  additionally *unilaterally redefines* the ten 09 release gates downward.
- **Verdict: PARTIAL overall; the PR's four-node claim is 1 defensible (N19 park),
  2 overstated (N20 census, N7 domain), 2 stub/false (N7 lifted workers, N21).**
- **Linear Done defensible?** SUP-555-equivalent (N7): no. SUP-567 (N20): only as
  "reference constants landed", not as N20a scope. SUP-566 (N19): yes, as "parked".
  SUP-568 (N21): no.

## 3. `origin/cursor/n10-agent-connectivity-7c12` — N10

- **Tip:** `fcaf506`. Node-proper commits: `b298d9a` (+2,264: `packages/connectivity`,
  20 source files) and `847884b` (+428: `packages/github-hooks` Worker). Branch also
  carries all of Wave 4b/4c via merges — see §0.
- **Real implementation, in-memory:** the governance *semantics* are the best-modelled
  of any node. `webhooks.ts` freezes the verified J3 constants
  (`WEBHOOK_RETRY_DELAYS_SECONDS = [30,60,120,300]`, `WEBHOOK_MAX_ATTEMPTS = 5`, HMAC
  sha256 over `timestamp.body`, read-once secrets that throw `secret_spent`, per-event
  idempotency, poison after 5). `safe-fetch.ts` ships `blockedSafeFetch()` as the
  production default — "Live URL delivery is blocked until OD-6" — which is the correct
  reading of OD-6-open. `instantly.ts` enforces reads-only *structurally*
  (`InstantlySession` has no send/activate/start; `INSTANTLY_FORBIDDEN_METHODS`
  asserted closed by the N21 checklist), matching the AGENTS.md bound. `mcp.ts` has
  catalog harvest, expose-allowlist, kill switch. Automations, import staging,
  ai-usage, oauth strategies present. 18 tests in `layer.test.ts` + gatekeeper tests.
- **Gaps vs N10's node contract:** the centerpiece sentence — "sandboxed agent can read
  external data through governed connectors" — is modeled, not delivered: there is **no
  sandboxed agent wired to anything**, no kernel Gatekeeper runtime integration, no live
  MCP client, no OAuth flow, no Queues/DO-alarm delivery (retries are simulated by
  calling `drain` in a loop), and webhook egress *cannot* deliver anywhere by design
  (OD-6). `github-hooks` is deployable but stateless-in-memory. Scheduled actions
  (`ActionKind::Agent`) and agent sessions/approvals/memory on Overseer runtime: absent
  (memory.ts is a small store).
- **Verdict: PARTIAL** — highest-fidelity governance model; zero live ingress.
- **Linear Done defensible?** No for the P1-centerpiece scope statement; yes only as
  "contract + constants layer landed".

## 4. `origin/cursor/n15-converter-c855` — N15

- **Tip:** `b5b12d9` (comment tweak); node commit `52d2579` (+1,101,
  `packages/converter`). 13 tests.
- **Contents:** in-process job orchestrator (`ConverterSlice`): `job_id` idempotent
  enqueue, queued→running→succeeded/failed, drain, `ConvertedPdf` port, media-preview
  path that throws `preview_unsupported` (OD-8 honest). "Golden DOCX fixture" is the
  string constant `GOLDEN_DOCX_V1`; the "container" (`container.ts` `goldenContainer()`)
  outputs `"PDF:" + sha256(input)`. `store.ts`: "In-memory R2 stand-in".
- **Node contract (ADR-012, OD-8): the deliverable is a LibreOffice + ffmpeg Cloudflare
  Container behind a hard boundary with R2-locked egress.** `types.ts:3-4` concedes it:
  "The live Cloudflare Container is not in this node". There is no container, no
  Dockerfile, no LibreOffice/`rs-libreoffice-bindings` harvest, no ffmpeg, no R2, no
  golden *conversion* fixture (nothing is converted). The boundary *shape* (container
  never sees keys/network — asserted in comments only) is the sole ADR-012 content.
- **Verdict: STUB** (an honest orchestration skeleton around an absent service).
- **Linear Done defensible?** No.

## 5. `origin/cursor/n16-search-c990` — N16

- **Tip = node commit** `74ea0c7` (+1,161, `packages/search`). 14 tests (523-line file).
- **Contents:** 7-entity-type coverage contract is present and **guarded**: 
  `SEARCH_ENTITY_TYPES = [document, project, chat, channel, email_thread, call,
  crm_company]` (`types.ts`; email→email_thread, call_record→call renames documented),
  with a constructor drift-check against soup's list (`slice.ts:44-47`). Ingest/backfill
  consume the N3 outbox with checkpoints; ranking is the OD-15 prototype
  (`TITLE_BOOST=3`, snippet 160, 512k poison-body skip, `IndexFailure` records);
  receipts filter reads; channel-scoped query supported.
- **Gaps:** wraps soup's **in-memory** `SearchIndex`; `LIVE_D1_FTS5.status =
  "deferred"` and `VECTORIZE.status = "deferred"` (`types.ts`) — the OD-27 shared D1
  projection plane exists as DDL strings on the soup side, never executed against D1.
  No golden-query fixture set vs the old system (05-MAP row 11 ranking/freshness parity
  unproven); OD-15 sign-off open by its own comment. Producer feeds are the sibling
  in-memory domains.
- **Verdict: PARTIAL** (contract + prototype, no substrate).
- **Linear Done defensible?** No — defensible as "coverage contract frozen" only.

## 6. `origin/cursor/n17-activity-e34d` — N17

- **Tip = node commit** `ebaaf6c` (+1,133, `packages/activity`). 18 tests.
- **Contents:** the OD-21/J10/J11 frozen constants are **exactly right**:
  `FREQUENCY_PERCENT 0.7 / RECENCY_PERCENT 0.3`, `RECENCY_DECAY_RATE 0.1`/hour
  (`exp(-0.1·h)` computed lazily, "No cron decay job"), `MAX_RECENT_EVENTS 10`
  (`types.ts`, `frecency.ts`); favorites cap 500 via soup
  (`MAX_FAVORITES_PER_COLLECTION = 500`, `soup/src/favorites.ts:6`) with fractional
  reorder and receipt-checked add/reorder (addresses the ledger:42 read-side-recheck
  gap at model level); closed 10-action vocabulary with poison counter for unknown
  actions; uuidv5-style dedup ids; deterministic recents ordering (score desc, id
  tiebreak); activity rides the N3 fact log, not a bus topic (correct per G-018).
- **Gaps:** in-memory `ActivityLog`; "five consumer domains" consume it only inside
  the same process; no D1 fact table (leftover self-declared: "live D1 fact log").
  OD-21's actual ask — *create the missing ledger rows* — is not done (no ledger edit).
- **Verdict: PARTIAL** — the best constants-fidelity node; same substrate hole.
- **Linear Done defensible?** At model level nearly; OD-21 row-transcription and live
  substrate missing → no, with the smallest gap of the set.

## 7. `origin/cursor/n18-notifications-1e5d` — N18

- **Tip = node commit** `09366e6` (+1,613, `packages/notifications`). 15 tests.
- **Contents:** 19-type catalog exact (7 github + 12 product, `catalog.ts:6-31`) with
  harvested `TITLE_COPY` per type; per-recipient `NotificationAuthority` ("DO
  stand-in") with seen/done/deleted, unread count, preferences (`PreferenceMap` per
  type), mutes, idempotent ingest by `(eventId, recipientId)`; egress split per OD-3:
  in-app when session live, email digest otherwise, `skippedPush` explicit (push
  deferred, matching the ruling); digest flush windows + unsubscribe codes.
- **Gaps:** no WebSocket, no real email, no digest scheduler (caller-invoked flush);
  22 metadata structs / 11 tables of the verified D1-D3 census are only partially
  present (`NOTIFICATION_TABLES` has 11 names; meta structs are a subset); producers
  are in-process siblings; unread *reconciliation* against a live store untested.
- **Verdict: PARTIAL.**
- **Linear Done defensible?** No for delivery parity (05-MAP row 13); yes as catalog +
  routing model.

---

## 8. Census of the "Done with no branch" Linear issues

Confirmed: **no dedicated remote branch exists** for SUP-556 (N8), SUP-557 (N9),
SUP-558 (N12), SUP-559 (N11), SUP-560 (N13), SUP-561 (N14), SUP-566 (N19), SUP-567
(N20), SUP-568 (N21) — the full remote branch list contains only n0–n7/n10/n15–n18
cursor branches plus setup/research/docs branches. **`origin/main` (`8cba7379`)
contains none of their work** (main ends at N0 governance; zero `packages/*` domain
code).

However, the work is **not wholly nonexistent** — it exists as commits embedded on the
shared stacked line, reachable *only* through the audited branches (verified via
`git branch -r --contains`):

| Issue | Node | Commit(s) | Where reachable | Substance |
|---|---|---|---|---|
| SUP-556 | N8 | `07e96df` (`packages/task-properties`, 488-line slice, EAV + bulk edit + kanban/grid, 437-line test) | all Wave-4 branches | in-memory, same bar as above |
| SUP-557 | N9 | `688e9cf` (`packages/channels`: message log, reconnect, presence, bot XOR) | all Wave-4 branches | in-memory; no DO websocket |
| SUP-559 | N11 | `68e0b4f` (`packages/mailbox`: `InMemoryGmailProvider`, approval-gated send, Pub/Sub checkpoint store) | n10, n15–n18, n7-lifted | in-memory; no Gmail/Pub/Sub |
| SUP-558 | N12 | `d2928c6` (`packages/crm`, 624-line slice) | same | in-memory |
| SUP-560 | N13 | `02702fc` (`packages/calendar`, LiveKit stub) | same | in-memory |
| SUP-561 | N14 | `52a182a` (`packages/files`: pending→ready upload, unfurl hard-blocked pending OD-6) | same | in-memory; no R2 |
| SUP-566 | N19 | `c455d80` | n7-lifted only | parked per plan (defensible) |
| SUP-567 | N20 | `fcaf506` + `965526b` | n10 (partial), n7-lifted | count constant + ~60/194 table names |
| SUP-568 | N21 | `c455d80` | n7-lifted only | sign-off constants; cutover impossible, admitted |

So the honest census statement is: **nothing for these nine issues is merged anywhere,
none has its own branch, and what exists is the same in-process model bar as the
audited nodes** — the "Done" states are indefensible for all except SUP-566 (N19
parked, which is the ruled deliverable).

---

## 9. Verdict table

| Branch | Node claim | Verdict | Linear "Done" defensible? |
|---|---|---|---|
| `cursor/n6-task-slice-7c12` @ `c543747` | N6 slice | **PARTIAL** — complete in-memory model, 8 real tests; no RPC boundary, no persistence, no deployment; slice gate not met at 05/09's production-shaped bar | **No** (only under a bar no ruling authorizes) |
| `cursor/n7-lifted-workers-e265` @ `c455d80` (PR #3) | N7 workers + N20 + N19 + N21 | **PARTIAL** — N7 workers **STUB** (mocks, "no live Cloudflare Workers" self-declared); N20 census overstated (~60/194 names); N19 park OK; N21 **not done** (redefines gates, admits no cutover possible) | N19 yes; N7/N20/N21 **no** |
| `cursor/n10-agent-connectivity-7c12` @ `fcaf506` | N10 P1 centerpiece | **PARTIAL** — best governance fidelity (5×[30/60/120/300] HMAC webhooks, read-once secrets, Instantly reads-only by construction, OD-6 blocked egress, MCP kill switch); one real Worker (github-hooks, stateless); zero live ingress, no agent wiring, no queues/DO delivery | **No** (as centerpiece); yes as contract layer |
| `cursor/n15-converter-c855` @ `b5b12d9` | N15 converter | **STUB** — self-declared "live Cloudflare Container is not in this node"; no LibreOffice, no ffmpeg, no R2; golden fixture = sha256 of a constant | **No** |
| `cursor/n16-search-c990` @ `74ea0c7` | N16 search | **PARTIAL** — 7-type contract frozen + drift-guarded, outbox indexing + backfill; D1 FTS5 + Vectorize explicitly deferred; no golden-query parity | **No** |
| `cursor/n17-activity-e34d` @ `ebaaf6c` | N17 activity | **PARTIAL** — frozen constants exact (0.7/0.3, 0.1/h, last-10, cap 500), deterministic recents, receipt-checked favorites; in-memory log; OD-21 ledger rows still untranscribed | **No** (closest of the set) |
| `cursor/n18-notifications-1e5d` @ `09366e6` | N18 notifications | **PARTIAL** — 19 types exact, OD-3-conformant routing (in-app/digest, push deferred), idempotent ingest; no WS/email/scheduler; 11-table census partial | **No** |

ADR-014: clean everywhere. Tests: present and meaningful on every node (8–18 cases per
node package, assertion-rich, negative-path coverage) — but they test the in-memory
model, and were not executed by this audit.

## 10. Three worst gaps

1. **The substrate is missing everywhere.** No D1, no R2, no Queues, no product Durable
   Objects, no deployed UI — every authority is a JS `Map`; the only real Cloudflare
   execution is N1's Miniflare kernel-DO test and a stateless github-hooks Worker. The
   entire Wave 3–5 "Done" record therefore describes a simulation, and
   `packages/seed/src/release-gates.ts` retroactively codifies this "in-process bar"
   without any owner ruling — a governance breach dressed as a deliverable.
2. **The N6 slice gate — the program's one hard gate — was not actually passed.** No
   typed RPC/capability boundary (ADR-002's surface), no production-shaped write path,
   no wire-level live subscription; yet its "Done" (5 minutes after N5) is what
   nominally authorized the entire Wave-4 fan-out. Every downstream node inherited the
   unproven contracts.
3. **The heavy-integration nodes are placeholders while marked Done:** N15 has no
   container/LibreOffice/ffmpeg/R2 at all (verdict STUB), and PR #3's "N7 lifted
   workers" are hand-written mocks (fake Lexical JSON), not lifts of the three existing
   CF workers — precisely the two nodes whose risk is integration, not modeling.
   (Runner-up: N10's webhook egress cannot deliver anywhere until OD-6 is ruled —
   correct behavior, but it means the P1 centerpiece has no live capability.)
