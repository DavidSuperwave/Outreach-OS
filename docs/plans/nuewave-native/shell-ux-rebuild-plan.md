# Shell & UX rebuild plan (Nuewave-native, workstream C)

> Status: planning draft, 2026-08-19
> Scope: the user-facing shell for the Cloudflare-native rebuild — what we adopt from the
> pinned Cloudflare OS, what we skin, what we build, and what we deliberately drop.
> Constraint: **no Macro source reuse.** Macro concepts inform the design; every line of UI
> we ship is original work or upstream Cloudflare OS. The kernel stays pinned and unforked.

## 1. What the Cloudflare OS shell actually is (verified against the submodule)

Evidence root: `cloudflare-os/packages/workshop-frontend`.

- **Stack**: React 19 + TanStack Router (file-based routes, `src/routes/*`,
  generated `routeTree.gen.ts`), Tailwind CSS v4, the **Cloudflare Kumo** design system
  (`@cloudflare/kumo`), Phosphor icons, Cap'n Web (`capnweb`) RPC to the workshop backend,
  Monaco + Yjs for code, react-markdown for chat.
- **Chrome**: `components/AppShell/AppShell.tsx` — a persistent left rail
  (`Sidebar.tsx`: Home, Workspaces, Blueprints, Outputs, then a **dynamic section of
  Gatekeeper apps**, then Explore), a thin top-notice strip, and routed content.
  Global **⌘K command palette** (`CommandPalette.tsx`). Mobile is an overlay drawer, not a
  responsive rail.
- **Workspace editor** (`/workspace/$id` → `GadgetEditor.tsx`) renders **fullscreen without
  the shell chrome** (`__root.tsx` special-cases it): a chat thread plus "workpieces" —
  Gadgets running in fully sandboxed iframes wired to their server-side Durable Object over
  MessagePort RPC (`GadgetUI.tsx`).
- **Home** (`routes/index.tsx`) is deliberately a launcher: hero + prompt composer + task
  suggestions; persistent navigation lives in the rail.
- **Outputs** (`routes/outputs.tsx`) is a cross-workspace index of everything produced —
  the OS-native answer to "where did my results go".
- **Theming** (`theme.ts`, `styles.css`): Kumo semantic tokens; light/dark via
  `data-mode` on `<html>`; a single admin-chosen **accent seed color** is expanded at runtime
  with CSS relative color (`oklch(from <seed> …)`). Site name, logo, and accent come from
  `/admin` with no redeploy.

### Extension points that need no upstream fork

1. **Gadgets / workpieces** — agent-built UI inside a workspace; sandboxed iframe + typed
   RPC to its own DO. This is where tables, dashboards, and interactive results live.
   They persist, are shareable, and surface in Outputs.
2. **Gatekeeper Apps** — any gatekeeper that declares
   `providesUi: { title, icon }` (`workshop-shared/src/gatekeeper.ts:159`) gets a
   **full-page sandboxed app** hosted at `/gatekeepers/$appId` and **auto-listed in the
   sidebar** (`useGatekeeperApps.ts` — "no gatekeeper is hardcoded here"). The reference
   implementation is the Context Library (`gatekeeper-context/app/ContextLibraryPage.tsx`),
   a full CRUD UI with its own bundle, Kumo components, theme bridge, and error boundary.
   Apps can navigate the host to workspaces, resolve workspace titles, and seed prompts
   (`SandboxedGatekeeperApp.tsx`: `OpenTarget`, `ResolveWorkspaceTitles`, `OpenPrompt`).
3. **Wrapper-owned custom gatekeepers** — this repo's `packages/custom-gatekeeper` pattern:
   deployment-owned Workers bound by service binding, no kernel patch.
4. **Blueprints** — packaged prompts/templates, featured via `/admin`.
5. **`/admin`** — branding, announcements, standing agent instructions, featured
   blueprints, connector availability.

**Conclusion:** the OS already ships a coherent shell. The rebuild is not "build a shell";
it is *adopt the shell, add our surfaces through Gatekeeper Apps and Gadgets, and brand it*.

## 2. Navigation model for the pilot

The Macro/Nuewave concepts we carry forward, translated to OS-native mechanics:

| Macro concept | Nuewave-native decision |
|---|---|
| Split panels / multi-pane workspace | **Drop.** Page navigation + fullscreen workspace editor. The workpiece picker already handles multiple artifacts per workspace. Re-introducing split panes would require forking upstream chrome. |
| Soup unified lists | **Simplify.** Workspaces list + Outputs page are the cross-entity lists. No new unified list engine. |
| Entity blocks (md, email, task…) | **Replace with Gadgets/Outputs.** An artifact is a workpiece; its viewer is the gadget itself. |
| Work tab (list + kanban, Nuewave M2) | **Rebuild as a Gatekeeper App** ("Work") backed by a wrapper-owned gatekeeper. Original UI, Kumo components. |
| Command menu | **Adopt as-is** (⌘K palette). |
| Chat block / agent loop UI | **Adopt as-is** (ChatInterface + workspace editor). No custom tool renderers — agent results land as gadgets. |
| Context / playbooks | **Adopt as-is**: the Context & Skills app from `gatekeeper-context`. Seed Playbooks + Intraplex ICP as collections. |
| Channels, email UI, calls, CRM screens | **Drop** (see §5). |

User journey: **Home** (compose task, standing instructions applied) → **Workspace**
(agent chat + gadgets; e.g. the inspect→ask→table loop over a lead file) → **Outputs**
(find the table later) → **Work app** (track the pipeline of tasks, kanban by status,
each card deep-links back to its workspace) → **Context & Skills app** (curate playbooks
and ICP the agent reads).

## 3. Surface inventory

| # | Surface | Build on | What we build | Data it binds to |
|---|---|---|---|---|
| 1 | Home | Upstream as-is | Nothing. Configure branding, announcements, standing instructions, task suggestions via `/admin`. | Admin-set config; models list (SUP-536 fix). |
| 2 | Session / chat + gadget view | Upstream `/workspace/$id` as-is | Nothing in the shell. Prompt/blueprint work only. | Workshop backend DOs. |
| 3 | Results tables (inspect→ask→table) | **Gadget pattern + Blueprint** | A certified "lead table" gadget prompt/blueprint (sortable table over an attached lead file; later Instantly-read results). No shell code. | Workspace files; gatekeeper session reads. |
| 4 | **Work** (tasks list + kanban) | **New Gatekeeper App** in a wrapper-owned gatekeeper (new `packages/gatekeeper-work` following `custom-gatekeeper` + `gatekeeper-context/app` patterns) | Board columns, task cards, status/priority pills, filter row, task detail drawer with "open workspace" (via `OpenTarget`). All original, Kumo-based. | Task store in the gatekeeper's DO/KV (typed-storage); workspace references; four system properties (status, owner, delegate, due) — the old Nuewave M2/SUP-491 concept, re-specified. |
| 5 | Context / playbooks / ICP | Upstream Context & Skills app as-is | Seed data only: Playbooks + Intraplex ICP collections. | `gatekeeper-context` collections (KV-backed). |
| 6 | Instantly reads | Wrapper-owned read-only Instantly gatekeeper (Session API proposal → **stop for David** per AGENTS.md) | Later, optionally, a `providesUi` dashboard app; v1 surfaces results as gadgets. | Instantly API (read-only), secrets in Wrangler secrets. |
| 7 | Admin / settings | Upstream `/admin` + Settings as-is | Nothing. | Admin config store. |

Build order that respects dependencies: 1→2→3 are configuration and prompting (near-zero
shell code, proves the loop), then 4 (Work app — the largest original UI), then 6.

## 4. Design-system approach

- **Inside sandboxed apps and gadgets there is no shared React context with the shell** —
  consistency is by convention, not inheritance. The convention, taken from
  `gatekeeper-context/app/`: own Vite bundle; import `@cloudflare/kumo` + Phosphor
  directly; ship an `ErrorBoundary` wired to error-reporting; implement the **theme
  bridge** (host pushes `setThemeMode` into the frame — see `ThemeReceiver` in
  `SandboxedGatekeeperApp.tsx`) and mirror `data-mode` handling from the app's own
  `theme.ts`.
- **Tokens**: use Kumo semantic classes (`bg-kumo-*`, `text-kumo-*`) and the accent
  variables (`--color-kumo-brand`, `--color-accent-*`) so `/admin` accent changes flow into
  our surfaces for free. Never hardcode brand colors.
- **New-component rules**: original implementations only; Kumo primitives first
  (Button, Dialog, DropdownMenu, Input, Banner, Loader); Phosphor for icons; Tailwind v4
  utility styling; match upstream idioms (`menuStyles.ts`, `WorkshopControls.tsx` show the
  house style — replicate the *style*, in our own code, inside our sandboxed bundles).
- **Branding** stays in `/admin` (site name, logo, accent seed). No CSS forks of upstream.

## 5. Not building

- **Mobile / native desktop apps** — the OS web app plus its mobile drawer is the pilot's
  entire client surface.
- **Collaborative rich-text editor** (Macro's Lexical system) — largest Macro subsystem,
  zero pilot need; documents live as context collections and gadget outputs.
- **Email client UI** — Instantly is read via a gatekeeper; no mailbox, threads, or compose.
- **Calls / LiveKit** — out of scope entirely.
- **CRM screens** (companies/contacts) — ICP lives as Context data, not a CRM.
- **Notifications service UI** — upstream activity/notice surfaces are enough.
- **Split-panel layout engine** — cost lands on a fork of upstream chrome; page nav suffices.
- **Custom chat tool renderers** — the chat timeline is upstream-owned; results are gadgets.

## 6. Upstream-constraint flags (things we do NOT assume)

1. **Primary nav is fixed.** Home/Workspaces/Blueprints/Outputs/Explore order and naming are
   upstream (`Sidebar.tsx`); our surfaces appear only in the dynamic Gatekeeper-apps section.
   Renaming/reordering would require an upstream change — flagged, not planned.
2. **Gatekeeper apps are iframes.** No shared state with the shell beyond the documented
   bridge (navigate, resolve titles, seed prompt, theme). Anything needing deeper host
   integration (e.g. a badge count on the sidebar item) is an upstream ask.
3. **Workspace editor chrome is closed.** We cannot embed a custom panel next to the chat;
   in-workspace UI must be a workpiece (gadget).
4. **`routeTree.gen.ts` is generated** — no route injection from the wrapper; new top-level
   routes are upstream-only.

## Open questions

1. Does the Work app's task store live in a new dedicated gatekeeper
   (`packages/gatekeeper-work`) or extend `packages/custom-gatekeeper`? (Recommend new
   package; custom-gatekeeper stays the credential-free example.)
2. Can a Gatekeeper App expose *multiple* nav entries, or one per gatekeeper? (Evidence so
   far: one `providesUi` per vendor — if Work and an Instantly dashboard both want entries,
   they likely need to be separate gatekeepers.)
3. Do we want tasks in the Work app to be creatable by agents (via a gatekeeper session
   the agent can call), humans, or both in v1? Workstream D's agent plan should decide the
   write path and approval posture.
4. Blueprint vs. bare prompt for the certified lead-table gadget — does the pilot want it
   featured on Home via `/admin` from day one?
5. How much of the old Nuewave M2 spec (saved views, filters) does the pilot Work app
   actually need before the R-9 scoring pass — list+kanban+status may be enough.
