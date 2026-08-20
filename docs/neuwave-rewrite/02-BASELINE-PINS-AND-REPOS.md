# Baseline, pins, and repository setup

These are **observed source references at package generation time**, not assumptions Codex may skip verifying.

| Source | Observed reference | Intended role |
|---|---|---|
| `DavidSuperwave/Outreach-OS` main | `dec12f2df3d205965838526076b910cdb8a845ce` | Baseline wrapper repository. |
| Outreach OS `cloudflare-os` gitlink | `bf7f762d7fa73553284d731ab6a978d3ea17be24` | Cloudflare OS kernel/platform pin. |
| `DavidSuperwave/Neuwave` | `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf` | Pinned old-product behavior reference. |
| Outreach OS planning branch | `merge/nuewave-docs` observed at `8c3cf7a4e3c25ada27bb89850964702d07a34988` | Planning evidence, not implementation baseline. |
| Outreach OS research branch | `research/nuewave-longtail` observed at `13c2847543326f8c2ce8485b26a1c1f0520cfa1b` | Long-tail audit evidence, not implementation baseline. |

## Recommended local layout

```text
Projects/
├── New-Neuwave-Cloudflare/     # new repo based on Outreach OS
├── Outreach-OS/                # optional untouched baseline clone
└── Neuwave/                    # reference clone pinned to 9f7a26b
```

## Verification commands

From the new repository:

```bash
git status --short --branch
git remote -v
git rev-parse HEAD
git submodule status --recursive
git ls-tree HEAD cloudflare-os
```

From the Neuwave reference repository:

```bash
git status --short --branch
git rev-parse HEAD
```

Codex must record:

- actual repository URL and HEAD;
- actual submodule pin;
- whether the worktree is clean;
- local branches with relevant unmerged work;
- whether the closed ledger and all audit files are present locally;
- any difference from the observed references above.

A pin mismatch is not automatically an error. It is a fact that must be explained before using the package’s source pointers.
