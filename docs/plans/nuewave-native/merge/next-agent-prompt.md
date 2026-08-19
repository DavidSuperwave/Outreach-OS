# Prompt for the next merge agent — the research pass (cloud-ready)

> Rewritten 2026-08-19 at the end of the ruling session (that session's
> record: roadmap Status log, entry "ruling session"; all five batches
> A–E ruled or explicitly deferred). Paste the block below verbatim as the
> next session's opening prompt — it works both for a local session and
> for a **cloud agent** starting from a fresh clone. It pairs with
> `cloud-handoff.md`, which the agent must read first.

---

You are running the **research pass** for the Nuewave × Outreach-OS full
absorption. All five ruling batches (A–E) were ruled by David on
2026-08-19; the patterns, route model, and corrected premises are settled.
Your job: fill the research columns of the still-open ☐ ledger rows so
David can rule them, working highest-leverage first. You do not build
anything and you never write a verdict.

**First action:** read
`docs/plans/nuewave-native/merge/cloud-handoff.md` in full and follow its
§1 environment steps if you are on a fresh machine (clone
`DavidSuperwave/Neuwave` as a sibling dir and
`git checkout 9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf`; init the
`cloudflare-os` submodule). Then read the files in its §2 order. Do not
start before that.

**Your work, in order:**

1. **Research the ☐ ledger rows, highest-leverage first:**
   1. **documents** (the core artifact: versions, annotations, blocks —
      cross-check `schema-harvest.md` + frontend block types),
   2. **projects** (folders/containers),
   3. **properties** (the EAV domain service — note ruling D2/2a already
      fixes the storage direction; research what the *domain surface* is:
      endpoints, toolset, side-effect pipeline),
   4. **search_service + search_processing_service**,
   5. **connection_gateway internals** (ruled superseded by kernel `/api`
      session push, C1 — enumerate its event types so the kernel session
      events can be designed),
   6. **the Lambda/batch families** (~20 handlers, never extracted — the
      known inventory hole; find them via `infra/`, deploy configs, and
      queue consumer registrations),
   then as time allows: favorites, foreign_entity, webhook, bots, github,
   DSS-native chrome (activity/pins/recents/…), memory, import, onboarding,
   ai_usage, ai_projections, streaming/completions, notification_service,
   static_file_service, unfurl_service, image_proxy_service,
   scheduled_action, convert_service, analytics-proxy, frontend ◐ rows,
   block types, table groups.
2. **For each row researched**, fill the ledger's research columns (old
   pointers, what it does, endpoint/schema cross-refs, proposed CF-native
   target under the ruled patterns, effort note) and leave `Verdict:`
   empty. Where a row's design is materially shaped by a ruling (D1/D2
   index layer, D3/D4 idioms, R3 surface, C1/C2 conventions), say how in
   the proposed-target cell — cite the ruling, don't re-argue it.
3. **Deep audits** (separate files under `merge/audits/`, same format as
   the existing three) for any row whose complexity warrants it —
   documents and the Lambda families almost certainly do.
4. **If David is present**, offer ruling batches for rows whose research
   is complete — grill-style, one question at a time, concrete options,
   his verdicts recorded immediately (ledger + dated "Ruled:" lines). If
   he is absent, do NOT simulate rulings — leave rows ◐ and keep
   researching.

**Rules that bind you (full versions in `cloud-handoff.md` §6 and
`agent-brief.md`):**
- Verdicts are David's. You present options and record; you never rule.
- Every code pointer `path/from/clone/root:line` against `Neuwave@9f7a26b`.
- Tripwires: no Macro branding; no Rust code reuse (three lifted CF
  services excepted — coding-agent-worker was dropped from the lift set,
  ruling A3).
- No Linear writes. Never delete or regenerate the ledger or inventories.
  Do not delete unchosen options from review docs.
- State coverage in every output. Ask in small batches; park non-blocking
  questions in the output docs.
- Git: doc updates may be committed to the designated docs branch (David's
  2026-08-19 order); nothing else without an explicit order.

**Definition of done for this pass:** the six highest-leverage rows fully
researched (ledger columns + audits where warranted); any additional rows
you reached; every output states its coverage; the roadmap Status log gets
an entry; and you end by restating what still stands between the ledger
and the Linear scope-map pass (remaining ☐/◐ rows by name, plus the two
standing deferrals: B auth mount, C3 `/.well-known`).

---
