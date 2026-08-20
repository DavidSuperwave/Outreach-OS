# Kernel patches

The rewrite carries **zero** kernel patches (ADR-014 / OD-10).

Do not add `*.patch` files here unless every admission gate in `KERNEL-STATUS.md` and `docs/neuwave-rewrite/reports/adrs/ADR-014-kernel-change-budget.md` is satisfied:

1. The need cannot be expressed via the extension ladder.
2. A compatibility impact report exists.
3. Upgrade/rebase cost is estimated.
4. The change is isolated and tested.
5. An ADR records why an edge extension was insufficient, and the owner signed off.

`pnpm governance` fails any patch file that lacks an `ADR-NNN` reference and a listing in `KERNEL-STATUS.md`.

The OpenRouter kernel patch from the planning branches (`sup-536-openrouter-kernel.patch`) is **parked**. It must not land in this repository without a retroactive ADR.
