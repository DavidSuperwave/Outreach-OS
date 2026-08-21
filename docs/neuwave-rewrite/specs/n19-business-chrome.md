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

None until the owner spec exists. `/onboarding` and `/getting-started` stay in
the 27-route map and render a parked placard (`data-surface="n19.parked"`) so
deep links do not 404. Sign-in remains N1.

## Invariants

Do not implement paywall, tutorial, or billing chrome in this wave. N1 identity
sign-in remains the only first-run path. Dual-gate bug (`tutorialComplete` vs
`user_onboarding`) is not recreated.

## Tests and parity fixtures

`packages/shell` SSR of `/onboarding` and `/getting-started` shows the parked
surface and no paywall copy. `packages/seed` N19 parked-route freeze. Fixture
gallery `#onboarding`.

## Open decisions

Owner flow spec (OD-5 residue). Not schedulable until provided.
