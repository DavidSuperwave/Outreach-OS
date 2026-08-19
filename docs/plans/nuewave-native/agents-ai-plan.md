# Agents & AI plan — Nuewave-native rebuild (workstream D)

> Status: planning draft, session 1 of the multi-session Nuewave-native effort
> Scope: model layer, agent runtime, tool/Gatekeeper roadmap, safety guardrails
> Constraint: Cloudflare-native only (no AWS), no Macro source reuse — concept-level rewrite.
> Companions: `cf-os-capability-map.md`, `platform-parity-map.md`, `shell-ux-rebuild-plan.md`, `roadmap-and-licensing.md` (other workstreams)

## Verdict up front

The Workshop kernel already implements, natively on Durable Objects, almost everything the old
Nuewave plan was going to build on ECS: a durable agent loop with restart-resume, a human-approval
queue with auto-approval rules, capability-scoped tool access (Gatekeeper sessions), scheduled and
event-driven wakeups (hooks), programmatic agent spawning, MCP, observation-based sharing
enforcement, and fail-closed AI Gateway inference. **We build Gatekeepers and configuration at the
wrapper layer; we do not build an agent runtime.** The Broker/runner/verifier-on-ECS design is dead.
The one Nuewave governance idea we carry forward is the GitHub-verified "Done" pathway, expressed as
a scheduler-driven check against the GitHub gatekeeper's PR state instead of a bespoke verifier
service.

---

## 1. Model layer: OpenRouter through AI Gateway (Milestone 1)

### Where it stands (SUP-536 / SUP-465)

Path B — OpenRouter as a first-class kernel `AiModelProvider` — is already designed and parked on
this branch (`david/sup-536-home-cannot-load-ai-models-for-openrouter`); see
`docs/sup-536-openrouter-changes.md` for the full inventory. Summary of the split:

- **Wrapper (committed):** `deployment.jsonc` names `openrouter` in `aiGateway.providers`; deploy
  script validator and docs updated.
- **Kernel (parked as `patches/sup-536-openrouter-kernel.patch`):** provider enum + suggested
  models (`workshop-shared/api.ts`), chat-completions routing native OpenRouter path in
  `ai-models.ts`, `tryGetAiGatewayConfig()` so a half-configured gateway degrades the *catalog*
  instead of throwing on Home, attachment rules (text+images, no PDF), Add-Model UI label.
- **Deliberately preserved:** *inference* still uses the throwing `getAiGatewayConfig` — spend
  stays **fail-closed** when gateway credentials are missing. Only catalog listing was softened.

### What Milestone 1 (M1-AI) delivers

1. **Pin/fork decision for the kernel patch.** The starter's `AGENTS.md` forbids forking
   `workshop-backend`; the patch is exactly that kind of change. Three options, decide before
   building anything else on top:
   - (a) upstream the patch to `cloudflare/cloudflare-os` (preferred; it is a generic provider
     addition with tests, not Superwave-specific);
   - (b) maintain a fork pin of the submodule with the patch applied;
   - (c) keep `git apply` of the patch as a documented deploy step (fragile; acceptable only while
     (a) is in review).
2. **Gateway provisioning (human-only):** a named AI Gateway with OpenRouter BYOK;
   `CF_AI_GATEWAY`, `CF_AI_GATEWAY_ACCOUNT_ID`, `CF_AI_GATEWAY_API_TOKEN` (AI Gateway Read+Edit),
   `CF_AI_GATEWAY_PROVIDERS=openrouter`. Secrets go in Wrangler secrets / `.dev.vars`, never in
   tracked config, never in Linear.
3. **Verification:** Home lists the three suggested OpenRouter models; a chat turn completes
   through the gateway; removing the gateway token blocks inference (fail-closed proof).
   Evidence review happens in a separate session per the SUP-536 note — the implementer session
   does not mark it Done.
4. **Optional later:** per-user billing/limits via `ENABLE_CLOUDFLARE_LIMITS` (kernel already
   ships the free-daily-allowance + user-credits flow, `docs/ai-gateway-billing.md`). Off for the
   pilot; single-tenant spend control is the gateway budget itself.

This closes SUP-536 and SUP-465 together: SUP-465's "spend fail-closed" requirement is exactly the
kernel's existing behavior once inference runs through the gateway config.

---

## 2. Agent runtime mapping: old concepts → what the kernel already has

### What the kernel gives us (verified in source, `bf7f762` + patch)

| Kernel facility | Where | What it is |
|---|---|---|
| Agent loop | `workshop-backend/src/agent.ts` (`runAgentLoopContinue`, pi-agent-core) | Streaming tool-loop with typed tool calls, thinking, compaction (`agent-compaction.ts`) |
| Durable sessions + resume | `overseer.ts` (`ActiveAgentRecord`, `#resumeAgent`, DO alarm) | In-progress turns are recorded; a DO/server restart **guarantees resume via alarm**, or posts an explicit "interrupted" error if the model is gone |
| Capability-scoped tools | `workshop-shared/gatekeeper.ts` sessions + per-chat `bindings` (frozen at chat start) | Agents reach external systems only through named bindings to Gatekeeper sessions; no ambient reach |
| Human approval (HITL) | `ApprovalQueue`, `ActionRecord`, `approveAction`/`rejectAction`, `auto-approval.ts` | Writes are **pending actions**; auto-approval requires BOTH the author's `autoApprovable` verdict AND a user-enabled per-type rule; drains stop at the first manual gate, never skipping past a human |
| Observations + sharing enforcement | `ObservationDescription`, observers/verifiers (`docs/observers.md`) | Every read is recorded; sharing re-verifies each observer's own account can read what the gadget read |
| Wakeups | `HookController`/`HookInitiator` + `gatekeeper-scheduler` (one-shot, interval, calendar) | External events and schedules wake chats |
| Delegation | `AgentSpawnerConfig` / `newAgentSpawnerGatekeeper` | Spawn child chats with a snapshotted, explicit env of bindings — the spawned agent sees only those |
| MCP | `gatekeeper-mcp`, `gatekeeper-mcp-portal` | Outbound MCP servers as gatekeepers |
| Model routing | `ai-models.ts`, `ai-gateway.ts`, `ai-invoke.ts` | AI Gateway BYOK routing, fail-closed inference |
| Templates | Blueprints (`docs/blueprints.md`) | Shareable gadget designs: code + binding shapes, no credentials/history |

### Mapping table

| Old concept (Macro / old-Nuewave plan) | Cloudflare-native answer | Build needed? |
|---|---|---|
| Macro agent loop (`crates/agent`), toolsets (`ai_tools`) | Kernel agent loop + Gatekeeper sessions | **None** |
| Macro MCP client/server | `gatekeeper-mcp` (outbound); external-facing MCP is out of pilot scope | None |
| Macro chat streaming/connection gateway | Kernel chat threads + Workshop UI streaming | None |
| Nuewave **Flow** (durable task holding pending work) | A chat thread with its frozen binding env; "state survives restart" is the kernel's resume guarantee | None |
| Nuewave **AgentSession** with idempotent streaming | `ActiveAgentRecord` + history replay/re-adoption in the overseer | None |
| Nuewave **Broker** (provider-neutral session API) | Model choice is per-chat via the AI Gateway catalog; provider switch = pick a different model. A "Codex CLI adapter" style runner fleet is **not** rebuilt | None (scope cut) |
| Nuewave **runner cluster on ECS, no ambient credentials** | Dead. Agents run in the Workshop's DO-backed loop; "no ambient credentials" is structural (bindings only). Long-lived external coding runners are explicitly out of pilot scope | Scope cut |
| Nuewave **verifier: GitHub is the only Done-setter** | Kept, re-expressed — see below | **Small wrapper build** |
| Nuewave coordinator bot in a channel | Agent spawner + scheduler hook inside a gadget | Configuration, not code |
| Nuewave approval queue → channel Decisions | Kernel action queue *is* the approval surface | None |

### The GitHub-verified "Done" pathway (kept)

What survives from old Nuewave is the governance rule: **an agent may claim work is finished, but
only externally-verifiable GitHub state marks it Done.**

Verified support in `gatekeeper-github`: repo/issue/PR sessions; the PR session type exposes
`merged`, `mergeable`, review and discussion comments; the underlying API client can read merge
state. Not found: CI check-runs/commit-status surface, and no `HookController` (webhook) in the
GitHub gatekeeper — so event-push verification is not available today.

Concept design (wrapper-side, no kernel change):

1. A **verifier gadget** owns two bindings: the GitHub repo session and a scheduler session.
2. Work items record a claim: `{ prUrl, expected: merged }`.
3. A scheduler interval/one-shot wakes the verifier; it reads PR state through the GitHub session
   (each read is an observation — auditable) and flips the item's status to Done **only** when
   `merged === true`.
4. Until check-runs are exposed, "merged" is the verification bar (branch protection on the repo
   makes merged imply green CI). If we need check-runs directly, that is a small upstream
   contribution to `gatekeeper-github`, not a fork.

---

## 3. Tool / Gatekeeper roadmap for the pilot

Order matters: each stage produces something the next stage exercises.

### 3.1 Context playbooks + Intraplex ICP seeding (M2)

- **What the OS has:** `gatekeeper-context` is a full Context Library: private and public (admin)
  collections, documents, agent skills, git-token sync (`ContextGitTokenCreateResult`,
  `DEFAULT_GIT_BRANCH`), and an `AgentCatalog` so agents can discover collection titles without
  reading everything.
- **Build:** none — this is content seeding, not code. Admin creates public collections
  ("Outreach Playbooks", "Intraplex ICP", "Company Context"); documents go in via the library UI
  or git sync.
- **HITL:** none needed for reads; collection editing is admin/owner-scoped already.
- **Done when:** an agent, asked an ICP question, searches the collections via its context binding
  and cites playbook content.

### 3.2 Inspect-ask-table loop over lead files (M2)

- **What the OS has:** gadgets with SQLite storage, chat attachments (text-like MIME types
  validated per provider), and the agent's ability to build UI (gadgets) — the "table gadget"
  the Outreach OS pilot required is a normal gadget the agent writes.
- **Build:** none kernel-side. Pilot behavior contract (carried from the Outreach OS pilot spec):
  agent **asks before building**, table survives refresh (gadget SQLite, not chat scrollback),
  cheap model (OpenRouter `openai/gpt-5-mini` per the patch's suggested-model ordering) does the
  first-pass inspect.
- **HITL:** implicit — the agent proposes, the human approves the build step conversationally.

### 3.3 Instantly READ-ONLY Gatekeeper (M3) — the one real build

- **Pattern:** wrapper's `packages/custom-gatekeeper` (credential-free read-only example) is the
  scaffold; upstream's `write-gatekeeper` skill documents observer design. Copy, don't fork.
- **Safety boundary carried forward verbatim from the Outreach OS pilot:** the session type
  **must not contain** any send/activate/pause method. Not "blocked" — *absent from
  `types.d.ts`*, so no approval flow can ever reach one. Read surface at concept level:

  ```
  InstantlySession {
    listCampaigns(): CampaignSummary[]
    getCampaign(id): CampaignDetail          // status, schedule, counts
    listCampaignAnalytics(id, range): AnalyticsRow[]
    listLeads(campaignId, cursor): LeadPage  // paginated, Cursor<T> pattern
    listEmailsForLead(leadId): EmailEvent[]  // opens/clicks/replies
  }
  ```

- **Credentials:** Instantly API key is a Wrangler secret on the gatekeeper Worker, set by the
  human operator. Single-account vendor: `autoProvisionsAccount: true`, `providesAuth: false`.
- **Observations:** every read recorded with a description ("Read campaign analytics for X").
  **Observer policy must NOT copy the example's allow-everyone verifier** — campaign data is
  tenant-confidential; v1: only the connecting admin's sharing domain verifies.
- **HITL:** reads need no approval; there are no writes. If a write surface is ever proposed, it
  arrives as a new session type + `ActionDescription` with manual gates, in its own review.
- **Done when:** reads land in a results gadget; grep of the gatekeeper proves no send method
  exists.

### 3.4 Scheduler-driven automations (M4)

- **What the OS has:** `gatekeeper-scheduler` (one-shot, interval, calendar rules) driving hooks;
  agent spawners for scoped delegation.
- **Build:** none — configuration. Example pilot automation: nightly spawner run
  "pull yesterday's Instantly analytics into the reporting gadget", env limited to
  `{ INSTANTLY: <gatekeeper>, CONTEXT: <library> }`.
- This is also where the GitHub-verified-Done verifier gadget (§2) runs.

---

## 4. Safety and guardrails

| Guardrail | Mechanism | Notes |
|---|---|---|
| Spend fail-closed | Inference-path `getAiGatewayConfig` throws when gateway creds are absent (patch deliberately did not soften this); gateway budget caps upstream spend | SUP-465 satisfied structurally |
| Human-only credentials | Wrangler secrets / `.dev.vars` only; never in Linear, `deployment.jsonc`, or tracked files | Existing repo rule, restated as policy for every new gatekeeper |
| No ambient credentials | Structural: agents only reach systems through per-chat frozen bindings to Gatekeeper sessions; spawned agents get an explicit env snapshot and nothing else | Old Nuewave audit issue (P.C) becomes a non-issue; keep a periodic review that no gatekeeper exposes creds in returned data |
| Kill-survival (old P.K scoring) | Kernel guarantee: active turns are recorded, DO alarm forces restart-resume, unresumable turns post an explicit interruption message | Pilot acceptance test: kill the dev server mid-turn, observe resume or explicit interruption — never silent loss |
| Write approval | All gatekeeper writes are pending actions; auto-approval needs author verdict AND user rule; drains never skip a manual gate | Instantly has no writes at all in v1 |
| Sharing/data-leak | Observer verification re-checks every collaborator against every observation source | Do not ship the example gatekeeper's allow-all verifier |
| Local dev state | Two launch modes persist DO state in different `.wrangler/state` dirs → "invalid session token" | Known trap; documented in `docs/sup-536-openrouter-changes.md`; pick one launch mode |

## Milestone summary

1. **M1-AI:** OpenRouter live through AI Gateway, fail-closed verified; kernel-patch pin/fork
   decision made (upstreaming preferred). Closes SUP-536 + SUP-465.
2. **M2:** Context collections seeded (playbooks + ICP); inspect-ask-table proven on one lead
   file with a persistent table gadget.
3. **M3:** Instantly read-only gatekeeper deployed; reads in a results gadget; no-send proof.
4. **M4:** Scheduler automations + GitHub-verified-Done verifier gadget running.

## Open questions

1. **Kernel patch destiny:** will upstream accept OpenRouter as a provider, or do we commit to a
   pinned fork of the submodule? Blocks everything past M1 being clean.
2. **GitHub check-runs:** PR `merged` is the only verification signal exposed today. Is
   branch-protection-implies-green acceptable as the Done bar, or do we contribute a check-runs
   read to `gatekeeper-github`?
3. **GitHub webhooks:** the GitHub gatekeeper has no hook delivery; verification is poll-based via
   scheduler. Is polling cadence (e.g. 5 min) acceptable, or is webhook support worth an upstream
   contribution?
4. **Instantly API shape:** rate limits, pagination, and whether analytics endpoints need
   workspace-level vs campaign-level keys — needs a spike against the real API before the session
   type is frozen.
5. **Multi-user vs single-tenant pilot:** observer policy and billing/limits both simplify if the
   pilot stays single-sharing-domain. When does the team want multi-user?
6. **Old Nuewave scoring bar (R-9/P.1–P.5):** the five founder-selected scoring tasks were
   Macro-repo tasks. Do we re-select five Cloudflare-native equivalents, or drop the scoring
   framing entirely? (Roadmap workstream owns this.)
