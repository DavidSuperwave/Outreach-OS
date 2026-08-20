# OD-2 — Four "deliberate exception" ruling entries (RULED-IN-SESSION)

**RULED-IN-SESSION 2026-08-20 (canonical-ledger transcription pending).**
All four entries were ruled by the owner in the 2026-08-20 in-session batch
ruling walkthrough (conducted via the lead agent). **Entries 1, 3, and 4 are
CONFIRMED as drafted** (entry 3 with the wording correction it carries).
**Entry 2 was the contested choice and is ruled: option (a)
keep-with-governance** — the `/chat/completions` passthrough survives with
an owner, spend attribution, and a model allow-list; the "ungoverned"
wording is retired. This overrides the OD-5 packet's kill
sub-recommendation for that endpoint (recorded as the session's single
override in the packet tally). Each entry below carries its ruling line;
transcription of the "Ledger verdict text" blocks to the canonical ledger on
`research/nuewave-longtail` remains pending — this worktree cannot write
that branch. Governance-doc checklists remain open obligations
post-signature, per 01-AUTHORITY.

Drafted: 2026-08-20. Evidence pins: Neuwave @ `9f7a26b`; canonical ledger
`docs/plans/nuewave-native/merge/merge-ledger.md` on
`research/nuewave-longtail` @ `13c2847` (read-only via `git show`); this
registry cannot write to that branch — once signed, each **"Ledger verdict
text"** block below is transcribed verbatim into the `Verdict` column of the
named ledger row (dates filled from the signature line).

Per `01-AUTHORITY-AND-SCOPE.md` §Deliberate exceptions, every kept exception
must document: (1) boundary and owner; (2) threat and failure model;
(3) observability; (4) deployment and rollback; (5) why it does not become
the default pattern for adjacent features. Each entry carries that
obligation as a checklist; an entry is not fully closed until its checklist
is, even after signature.

---

## Entry 1 — MCP server remains in the pilot

**Closes ledger row:** `mcp_service + mcp_auth_proxy`, merge-ledger.md:83
(§3 Standalone services) @ `13c2847`.

**Plain language.** Neuwave exposes itself *as* an MCP server — its
first-party toolset offered to external agents. That surface stays in the
pilot. It is kept because governed external-agent access to the platform's
tools is part of the product's connectivity story (consistent with the OD-4
ruling that connectivity is the P1 centerpiece: governed data ingress for
agents). It is *recreated* on the kernel's `gatekeeper-mcp` path, not ported.
The companion `mcp_auth_proxy` is **not** covered by the exception: it was an
OAuth 2.1 broker that existed only because FusionAuth lacked Dynamic Client
Registration (verified, `mcp_auth_proxy/README.md:1-6`), and FusionAuth is
ruled dead — the broker dissolves with the auth rebuild. This matches the
OD-5 packet's split recommendation (Batch 4 item 11: keep-adapted / kill).

**Ledger verdict text (transcribe into row :83 `Verdict` on signature):**

> KEEP (deliberate exception 1, OD-2) — the Macro-as-MCP-server surface
> remains in the pilot, recreated via `gatekeeper-mcp`; the `mcp_auth_proxy`
> broker is outside the exception and dissolves with the auth rebuild
> (substrate-motivated; FusionAuth is dead). Governance docs per
> 01-AUTHORITY §Deliberate exceptions tracked in
> `reports/notes/od2-exception-rulings-draft.md` entry 1. Ruled: {DATE}.

**Governance doc obligations (01-AUTHORITY §Deliberate exceptions):**

- [ ] Boundary and owner — to be authored in the MCP-surface/gatekeeper ADR
      (the one WP-030 ADR not yet drafted; OD-2 names it blocked on this
      ruling): which tools are exposed, to whom, under whose sign-off.
- [ ] Threat and failure model — external agents invoking first-party tools:
      authz model (kernel gatekeeper sessions), scope containment, abuse.
- [ ] Observability — per-tool invocation logging and attribution.
- [ ] Deployment and rollback — kill switch that withdraws the MCP surface
      without touching the tools it fronts.
- [ ] Non-default clause — why "expose capability X over MCP" does not
      become the default pattern for adjacent features; each new exposed
      toolset is a ledgered decision.

**Ruled: CONFIRMED as drafted — owner, in-session 2026-08-20 (batch ruling
walkthrough via lead agent). Date: 2026-08-20.** Ledger verdict text above
transcribes with this date. Governance checklist remains open.

---

## Entry 2 — The `/chat/completions` OpenAI passthrough proxy — RULED: OPTION (a) KEEP-WITH-GOVERNANCE

**Closes ledger row:** sub-verdict of `streaming/completions (native)`,
merge-ledger.md:65 (§2) @ `13c2847`. The row bundles four endpoints; the
other three are uncontested and ruled in the OD-5 batch (durable streams
dissolve into kernel DO-hosted sessions; `/structured-completion` becomes an
RPC method). **This entry decides only the fourth: `POST /chat/completions`.**

**What it is (verified, ledger:65).** A 47-line hardcoded, non-streaming
proxy to `https://api.openai.com/v1/chat/completions`, using the platform's
own OpenAI key, with `stream` forced to `false`. Premium-model access is
checked at this endpoint via `ChatModelAccess`. It is an *external* contract
shape — an OpenAI-compatible endpoint that outside callers could be using.

**The collision.** 01-AUTHORITY exception 2 says "the ungoverned OpenAI
proxy remains." The OD-5 batch packet (Batch 4 item 9) recommends the
opposite: **kill the OpenAI passthrough** — the row's own research calls it
"the one clear kill candidate," superseded outright by the model layer
(SUP-536 / OpenRouter). A rubber stamp in either direction would leave the
system of record contradicting itself; this must be an explicit dated choice,
and 01-AUTHORITY must be amended if option (b) is chosen.

### Option (a) — KEEP as a governed exception

The passthrough remains, but "ungoverned" ends: it becomes a bounded,
documented exception with an owner.

- What is preserved: the external OpenAI-compatible contract shape (any
  outside caller keeps working); the `ChatModelAccess` premium gate stays
  where it is; zero migration work for whatever depends on it.
- What it costs: the pilot permanently carries a raw model-API surface that
  the rest of the architecture supersedes — the model layer (SUP-536/
  OpenRouter) is the sanctioned path, and under the OD-10 zero-kernel-patch
  ruling that routing itself still needs its own ADR; every future audit
  will re-flag this endpoint (one already called it the one clear kill
  candidate); key custody, spend attribution, rate limits, and a model
  allow-list must all be built and owned for an endpoint with no known
  product consumer; the exception invites "just proxy it" as a pattern
  unless the non-default clause is policed.
- Obligations if chosen: the full five-item checklist below, plus a named
  owner for the OpenAI key and spend.

### Option (b) — KILL per the OD-5 packet recommendation

The passthrough is deleted; the model layer is the only model access path.

- What is gained: ~47 lines of deletion; no second, ungoverned door to
  models beside the governed one; no standing platform OpenAI key exposed on
  an external route; 01-AUTHORITY's exception list shrinks by its weakest
  member; every audit and the ledger research agree with the outcome.
- What breaks or is lost: **any external caller of the OpenAI-compatible
  endpoint breaks** — the row's research explicitly warns it is an external
  contract shape and must be checked for callers before removal (mandatory
  rider, below); the `ChatModelAccess` premium-model check enforced at this
  endpoint needs a new home in the model layer so the entitlement is not
  silently lost; a standing owner exception is reversed, which only a dated
  owner ruling can do — 01-AUTHORITY §Deliberate exceptions item 2 must be
  amended in the same commit that transcribes the verdict.
- Mandatory rider if chosen: caller audit first (logs/gateway evidence that
  nothing external calls it, or a deprecation window for whatever does);
  `ChatModelAccess` re-homed before deletion.

**Ledger verdict text (transcribe the chosen block into row :65 alongside
the batch verdict for the row's other three mechanisms):**

> [x] OPTION (a) KEEP **(SELECTED — ruled in-session 2026-08-20)** —
> sub-verdict `/chat/completions`: KEEP as governed
> exception (OD-2 entry 2a). The passthrough remains as an external contract
> surface with an owner, key custody, model allow-list, spend attribution,
> and rate limits; `ChatModelAccess` gate preserved in place. "Ungoverned"
> wording in 01-AUTHORITY replaced by "governed OpenAI-compatible proxy."
> Governance docs per 01-AUTHORITY tracked in
> `reports/notes/od2-exception-rulings-draft.md` entry 2. Ruled: {DATE}.

> [ ] OPTION (b) KILL **(NOT selected)** — sub-verdict `/chat/completions`: KILL (dated; OD-2
> entry 2b, supersedes 01-AUTHORITY deliberate exception 2, which is amended
> by this ruling). Superseded by the model layer; riders: caller audit
> before removal; `ChatModelAccess` premium gate re-homed in the model
> layer. Ruled: {DATE}.

**Governance doc obligations — apply only under option (a):**

- [ ] Boundary and owner — named owner of the endpoint, the OpenAI key, and
      the spend it can incur; allowed models enumerated.
- [ ] Threat and failure model — key exfiltration/abuse via an external
      route; quota exhaustion; prompt content leaving the platform boundary.
- [ ] Observability — per-call logging, spend attribution, anomaly alerting.
- [ ] Deployment and rollback — kill switch; behavior when OpenAI is down.
- [ ] Non-default clause — why direct provider passthrough does not become
      the pattern beside the model layer; any new proxy needs its own ADR.

**Under option (b) instead:** [ ] caller audit attached · [ ]
`ChatModelAccess` re-home designed · [ ] 01-AUTHORITY amendment staged.

**VERDICT: option (a) — KEEP-WITH-GOVERNANCE.** The passthrough survives
with a named owner, spend attribution, and a model allow-list;
`ChatModelAccess` gate preserved in place; "ungoverned" wording in
01-AUTHORITY retired in favor of "governed OpenAI-compatible proxy." This
ruling overrides the OD-5 packet's kill sub-recommendation for this
endpoint (Batch 4 row 9); the rest of that row's batch verdict stands.

**Ruled: option (a) — owner, in-session 2026-08-20 (batch ruling walkthrough
via lead agent). Date: 2026-08-20.** Ledger verdict text (option (a) block)
transcribes with this date. Option-(a) governance checklist remains open.

---

## Entry 3 — Seven-entity-type search remains (wording corrected from "seven-source")

**Closes ledger row:** `search_service`, merge-ledger.md:38 (§1) @
`13c2847`. (Sibling row :80 `search_processing_service` is ruled with it in
the OD-5 batch — "one system" per the ledger's own note; this entry supplies
the exception verdict for :38 and its coverage contract binds both halves.)

**Plain language.** Search stays, at full breadth. The old phrase
"seven-source search" was a mis-phrasing corrected by WP-010 (verdict C on
claim E2): there are not seven search providers — there are **seven indexed
entity types on one index**: document, project, chat, channel, email,
call_record, crm_company. What is kept is the **7-entity-type coverage
contract** plus ranking/freshness parity, because cross-entity search is
core product behavior, not an optional add-on. The substrate moves
(OpenSearch → the D1 projection plane per the OD-27 ruling, proposed D1 FTS5
with optional Vectorize), with a substrate election checkpoint at OD-15
after the golden-query gate. ADR-007 is the governance/boundary document.

**Ledger verdict text (transcribe into row :38 `Verdict` on signature):**

> KEEP (deliberate exception 3, OD-2) — wording corrected: **seven-ENTITY-
> TYPE search** (document, project, chat, channel, email, call_record,
> crm_company over one index), not "seven-source." The 7-type coverage
> contract is frozen; adding/removing a type is a ledgered compatibility
> change. Substrate per ADR-007 on the OD-27 topology (one D1 projection
> plane, two schema families), elected at the OD-15 checkpoint; rule with
> row :80 (`search_processing_service`) as one system. Governance docs:
> ADR-007. Ruled: {DATE}.

**Governance doc obligations (01-AUTHORITY §Deliberate exceptions):**

- [ ] Boundary and owner — ADR-007 §Decision (search projector solely owns
      index tables per ADR-005; query half is an ADR-002 RPC capability).
- [ ] Threat and failure model — ADR-007 §State and authorization impact
      (receipt-filtered results before enrichment, fail-closed; no
      title/snippet leak for revoked entities).
- [ ] Observability — ADR-007 §Operational consequences (per-type indexing
      lag, queue depth, poison count, golden-query score over time).
- [ ] Deployment and rollback — ADR-007 §Migration and rollback (no index
      migration ever; drop-and-rebuild; degraded mode = stale/absent search
      while lists keep working).
- [ ] Non-default clause — the search index is the *only* ranked-retrieval
      structure; adjacent features use the ADR-006 index plane, not private
      FTS tables (ADR-006/ADR-007 shared-slot design).

**Ruled: CONFIRMED as drafted (wording corrected to "seven-entity-type") —
owner, in-session 2026-08-20 (batch ruling walkthrough via lead agent).
Date: 2026-08-20.** Ledger verdict text above transcribes with this date;
binds rows :38 and :80. Governance checklist remains open.

---

## Entry 4 — Self-hosted converter (LibreOffice + ffmpeg) remains, as an isolated container boundary

**Closes ledger row:** `convert_service`, merge-ledger.md:82 (§3) @
`13c2847`. (The ffmpeg half lives on the call-recording-preview Lambda row
and is ruled with this per the ledger's own instruction; OD-8 ratifies the
substrate details.)

**Plain language.** Document conversion stays self-hosted. The converter
embeds LibreOffice (Collabora `core-co-25.04` assets, MS core-fonts EULA
accepted in-image so DOCX renders with correct metrics) and is the producer
of `ConvertedPdf` — the DOCX half of the documents content model, not a side
utility; dropping it would amputate the documents row. No Workers-native
successor exists, and an external conversion API would send user documents
to a third party (a data-boundary change the exception exists to avoid). It
is kept as **one isolated media-conversion substrate on Cloudflare
Containers per ADR-012**: a pure `{input R2 key} → {output R2 key}`
transformer with no product logic, reachable only via a wrapper orchestrator
DO, no inbound public route, egress locked to R2 with scoped short-lived
per-job credentials — because LibreOffice parsing hostile DOCX is the
largest attack surface in the platform, so it runs blind and boxed.

**Ledger verdict text (transcribe into row :82 `Verdict` on signature):**

> KEEP (deliberate exception 4, OD-2) — self-hosted converter remains, as an
> **isolated Cloudflare Container boundary per ADR-012**: one container
> family (LibreOffice + ffmpeg; ffmpeg may move to Media Transformations
> per OD-8 without changing the interface), no product logic, orchestrator-
> DO-only access, egress locked to R2, scoped per-job credentials,
> idempotent on `job_id`/`to_key` per D3/3a. Rule with the ffmpeg preview
> handler and the documents content-location model (OD-8/OD-18). The
> exception does not generalize: any new container needs its own ADR.
> Governance docs: ADR-012. Ruled: {DATE}.

**Governance doc obligations (01-AUTHORITY §Deliberate exceptions):**

- [ ] Boundary and owner — ADR-012 §Decision 2 (capability owned by the
      wrapper orchestrator DO; container owns no state, no standing keys).
- [ ] Threat and failure model — ADR-012 §Decision 2 + §Tests (hostile-DOCX
      isolation; network locked to R2; failure marks derived artifact
      unavailable, never corrupts the authority).
- [ ] Observability — ADR-012 §Operational consequences (job latency,
      failure taxonomy, queue depth; LibreOffice CVE patch cadence is an
      operational commitment of the exception).
- [ ] Deployment and rollback — ADR-012 §Migration and rollback (pinned
      image versions, independent rollback, idempotent regeneration; kill
      switch degrades to "preview unavailable," never data loss).
- [ ] Non-default clause — ADR-012 §Decision 4 (containers only for
      binary/native codecs with no Workers path; Browser Rendering and
      Cloudflare Images cover the adjacent needs; new containers need ADRs).

**Ruled: CONFIRMED as drafted (isolated container per ADR-012) — owner,
in-session 2026-08-20 (batch ruling walkthrough via lead agent).
Date: 2026-08-20.** Ledger verdict text above transcribes with this date.
Governance checklist remains open.

---

## Transcription note (signatures complete 2026-08-20; transcription PENDING)

All four entries are now ruled. Still to do, by a scribe with write access to
the canonical branch: (1) transcribe each "Ledger verdict text" block
verbatim (entry 2: the option-(a) block), dated 2026-08-20, into the named
row's `Verdict` column on `research/nuewave-longtail` (this worktree is
read-only toward that branch); (2) entry 2 = option (a), so no exception is
removed from `01-AUTHORITY-AND-SCOPE.md` — but its §Deliberate exceptions
item 2 wording "ungoverned OpenAI proxy" must be replaced with "governed
OpenAI-compatible proxy," and item 3's "seven-source" corrected to
"seven-entity-type"; (3) OD-2 is marked RULED in
`reports/06-owner-decisions-needed.md` (done 2026-08-20) — the blocked
acceptances (ADR-007, ADR-012, the MCP-surface and model-layer/proxy ADRs;
N10/N15/N16) are released, with propagation into ADRs and reports/04/05
owned by the sibling propagation agent.
