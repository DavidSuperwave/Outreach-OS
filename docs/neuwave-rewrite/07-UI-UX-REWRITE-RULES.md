# UI/UX rewrite rules

## Goal

Faithfully recreate Neuwave’s interaction model and visual system as original React code in the new repo, using the old product as a reference and the Cloudflare OS platform as the runtime.

## Source restrictions

- Do not ship Macro names, logos, brand icons, agent identity, or trade dress.
- Treat any `macro-*` icon or asset as a tripwire requiring replacement.
- Do not mechanically translate SolidJS source into React file-by-file.
- UI source can establish behavior and structure, but implementation must be original and adapted to the new state model.

## Required UI inventories

Before a surface is rewritten, capture:

- route and deep-link shape;
- component/split/block registration;
- view tabs and filter presets;
- command/hotkey behavior;
- focus model;
- keyboard navigation;
- selection and bulk actions;
- loading, empty, error, offline, and permission states;
- responsive/mobile behavior;
- design-token usage;
- accessibility roles and labels;
- analytics events;
- native-only assumptions.

## Design tokens

The old design-token system is concentrated in an OKLCH-based CSS file. Use it as source evidence for semantic roles and relationships, then create a governed token layer in the new React app.

Recommended layers:

1. raw color/spacing/type scales;
2. semantic surface/text/border/status tokens;
3. component tokens;
4. theme variants;
5. runtime accent/brand overrides.

Do not hardcode extracted colors repeatedly in components.

## Visual parity process

For each surface:

1. Capture reference screenshots at agreed viewport sizes.
2. Record interaction state and data fixtures.
3. Build the original React implementation.
4. Run visual regression against the reference.
5. Test keyboard/focus behavior separately.
6. Test empty/loading/error/permission states.
7. Record intentional differences in the parity matrix.

## SolidJS → React risk areas

Codex must explicitly check:

- reactive memo timing vs React render/effect timing;
- signal-derived subscriptions and cleanup;
- imperative focus after transitions;
- event propagation and hotkey scope activation;
- state retained across split navigation;
- dynamic command registration/disposal;
- optimistic query cache behavior;
- drag/drop and pointer capture;
- portal/dialog stacking;
- theme preview and rollback.

## Shell decision

The first architecture pass must compare:

- stock Cloudflare OS shell plus apps/gadgets;
- wrapper-owned custom shell speaking the current RPC contract;
- targeted frontend fork;
- hybrid shell that embeds selected upstream surfaces.

The recommendation must include implementation cost, compatibility coverage, upgrade burden, and whether Neuwave’s split/Soup UX can be faithfully represented.
