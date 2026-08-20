# Domain specification — Business chrome / onboarding / billing (N19 / SUP-566)

## Verdict and source evidence

**PARKED.** Do not start without an owner-approved flow spec (ledger 2026-08-19;
05-MAP row 18). Mechanical primitives (sign-in, `/onboarding`, `/getting-started`
routes in N5) stay in the 27-route map so deep links do not rot. The experience
is redesigned to David's spec later.

Harvestable for that future spec (not built here): read-triggers-work onboarding
state; connector-first first-run. Known bug not to recreate: dual gate
(`tutorialComplete` vs `user_onboarding`).

## User journeys

None until the owner spec exists.

## Invariants

Do not implement paywall, tutorial, or billing chrome in this wave. N1 identity
sign-in remains the only first-run path.

## Open decisions

Owner flow spec (OD-5 residue). Not schedulable until provided.
