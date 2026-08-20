# WP-010 — Plan falsification and gap review

## Objective

Attack the current plan before implementation. Find stale assumptions, incomplete coverage, contradictions, and premise-breaking facts.

## Method

For each audit/domain:

1. Verify pin and source path.
2. Sample high-value positive claims.
3. Re-run every negative claim.
4. Compare endpoint/route/schema inventories with source registries.
5. Check whether the audit covered generated, dynamic, feature-gated, native, and background-worker surfaces.
6. Separate observation from recommendation and owner verdict.
7. Escalate facts that change the meaning or cost of a ruling.

## Mandatory gap checks

- entity-access scope and tests;
- materialized indexes/Soup;
- notifications;
- search sources/ranking;
- static-file metadata;
- converter/LibreOffice/ffmpeg;
- SSRF-by-DNS behavior;
- already-Cloudflare workers outside lift sets;
- native/desktop paths;
- env/secrets inventory;
- migrations and source object counts;
- command/hotkey dynamic registrations;
- exact kernel RPC surface.

## Deliverables

- `reports/01-plan-gap-review.md`
- updates to `reports/06-owner-decisions-needed.md`
- updated gap register

## Acceptance

Every reviewed claim is marked verified, corrected, unverified, or owner-dependent with source evidence and coverage limits.
