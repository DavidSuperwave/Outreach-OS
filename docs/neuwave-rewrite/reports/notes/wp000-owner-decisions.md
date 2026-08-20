# WP-000 — Owner decisions needed

Surfaced during ground-truth verification (2026-08-20). Evidence base: canonical ledger and roadmap at `DavidSuperwave/Outreach-OS` branch `research/nuewave-longtail` @ `13c2847543326f8c2ce8485b26a1c1f0520cfa1b`, paths under `docs/plans/nuewave-native/`. None of these were resolved or simulated; nothing here changes any verdict.

These are restatements of open items already recorded in the owner's own planning documents, plus two package-hygiene questions from this packet. They should seed `reports/06-owner-decisions-needed.md`.

## A. Ledger-closure premise

1. **Confirm the "closed ledger" reading.** 43 rows carry explicit dated verdicts; 57 researched rows have empty `Verdict:` slots and are covered only by the Q19 default ruling ("every row not explicitly ruled or parked is KEEP — faithful recreation", `merge/merge-ledger.md` header). Decision: may the rewrite program treat Q19-default-KEEP as the binding verdict for those 57 rows, or must ruling batches finish first (the roadmap's own "Next" step)?
2. **Reconcile the coding-agent row glyph.** Ledger line 87 is `☐` but carries the A3 verdict ("future-only, not pilot scope"). Roadmap says only David should reconcile the glyph.

## B. Standing deferrals (already logged as deferred by the owner)

3. **B — auth mount** (`merge/route-reconciliation.md`).
4. **C3 — `/.well-known`** (`merge/route-reconciliation.md`).

## C. Items the roadmap says "need David rather than more research" (`roadmap.md` status log)

5. **Mega-row splits.** `documents` (audit §G offers splits G1/G2/G3) and the Lambda-families row (audit §/options); also `dss-native-chrome` split options N1/N2/N3 (`audits/dss-native-chrome-audit.md`).
6. **DLP has no ledger row** — a daily job that deletes user content on policy. Needs a row and a verdict.
7. **Redis** appears as infrastructure with no Cloudflare successor named.
8. **ffmpeg has no Workers-native successor** (call recording previews); related second hard substrate gap: `convert_service` embeds LibreOffice and must be ruled together with the documents content-location model, not alone (`audits/standalone-services-audit.md`).

## D. Long-tail findings needing rulings or rows (`audits/standalone-services-audit.md`, `audits/dss-native-chrome-audit.md`)

9. Grouped for one sitting:
   - **SSRF-by-DNS**: one ruling covering unfurl, image-proxy, outbound webhooks, and any connector accepting user-entered endpoints — Workers cannot resolve hostnames, so the old defence does not port.
   - **`notification_service` provisional "Drop" is load-bearing**: 19 types / 3 egress channels; every producing domain is ruled keep, so dropping relocates work rather than removing it.
   - **Missing ledger rows**: `frecency` (the real recents engine, consumed by five domains) and the `activity_events` action vocabulary.
   - **Unharvested DynamoDB table**: `static_file_service` file metadata (schema-harvest hole).
   - **Entity-type canonicalization (D2 rider)**: `property_entity_type` (10) vs `EntityType` (16); THREAD/TASK exist only as document facets — canonicalization requires deciding whether thread and task are entities.

## E. Package/pin hygiene (from this packet)

10. **Merge-branch pin drift.** Local `merge/nuewave-docs` = `05436fe` (one commit ahead of the package pin and origin at `8c3cf7a`; content contained in `origin/research/nuewave-longtail`). Decision: update `manifest/source-pins.json` to the research-branch head as the single canonical evidence ref, push/fast-forward origin's merge branch, or leave as-is with the drift documented.
11. **Node 24 enforcement.** "Node 24, pnpm 11" is enforced only by `.cursor/Dockerfile` + corepack `packageManager`; no `engines`/`.nvmrc` anywhere. Decision: add an `engines` field (and optionally `.nvmrc`) to make local shells fail fast, or keep convention-only.
