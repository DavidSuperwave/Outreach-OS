# Neuwave Frontend Route / Navigation Inventory

- **Source**: Neuwave monorepo, git `main`, pinned SHA `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf`
- **Date**: 2026-08-19
- **Paths**: relative to the Neuwave clone root
- **App**: SolidJS + Solid Router SPA at `apps/web` (HashRouter under Tauri, Router on web)

Navigation model: the router has a small set of literal routes plus a catch-all splat route `/*splits`. The splat encodes alternating `{type}/{id}` pairs (e.g. `component/inbox/channel/<id>`), where `type` is either `component` (resolved via the split component registry) or a block/entity type (rendered by the block system). The 12 literal "app routes" (`/inbox`, `/mail`, ...) reuse the same layout component so their path segments become split pairs.

## 1. Top-level routes

All registered in `ROUTES` in `apps/web/src/routes/Root.tsx:223` (mounted at `Root.tsx:597` with root layout `Layout`). 27 route entries.

| Path | Component | Purpose | Source |
|---|---|---|---|
| `/task-slug/:taskSlug` | `TaskRoute` | Resolve a task slug deep link to its entity | `apps/web/src/routes/Root.tsx:225` |
| `/*splits` | `LayoutRoute` (`LAYOUT_ROUTE`) | Catch-all split layout; splat = alternating `{type}/{id}` pairs | `apps/web/src/components/app/split-layout/SplitLayoutRoute.tsx:21`, `Root.tsx:228` |
| `/inbox` | `LAYOUT_ROUTE.component` | Inbox view (split layout, `component/inbox`) | `apps/web/src/routes/Root.tsx:230` |
| `/activity` | `LAYOUT_ROUTE.component` | Activity timeline view | `apps/web/src/routes/Root.tsx:234` |
| `/reminders` | `LAYOUT_ROUTE.component` | Reminders list view | `apps/web/src/routes/Root.tsx:238` |
| `/calendar` | `LAYOUT_ROUTE.component` | Calendar view | `apps/web/src/routes/Root.tsx:242` |
| `/agents` | `LAYOUT_ROUTE.component` | Agents/automations list view | `apps/web/src/routes/Root.tsx:246` |
| `/mail` | `LAYOUT_ROUTE.component` | Email list view | `apps/web/src/routes/Root.tsx:250` |
| `/documents` | `LAYOUT_ROUTE.component` | Files/documents list view | `apps/web/src/routes/Root.tsx:254` |
| `/tasks` | `LAYOUT_ROUTE.component` | Tasks list view | `apps/web/src/routes/Root.tsx:258` |
| `/channels` | `LAYOUT_ROUTE.component` | Channels list view | `apps/web/src/routes/Root.tsx:262` |
| `/calls` | `LAYOUT_ROUTE.component` | Calls list view | `apps/web/src/routes/Root.tsx:266` |
| `/companies` | `LAYOUT_ROUTE.component` | CRM companies view (flag-gated inside split) | `apps/web/src/routes/Root.tsx:270` |
| `/files` | `LAYOUT_ROUTE.component` | Files view (alias surface) | `apps/web/src/routes/Root.tsx:274` |
| `/` | `BasePathComponent` | Base path: routes to default view / auth | `apps/web/src/routes/Root.tsx:280`, `apps/web/src/routes/BasePath.tsx` |
| `/signup` | `Login` (`signupMode`) | Signup screen | `apps/web/src/routes/Root.tsx:284` |
| `/email-signup-callback` | `EmailCallback` | Email-auth OAuth/verification callback | `apps/web/src/routes/Root.tsx:288` (paths defined `Root.tsx:176`) |
| `/inbox-link-callback` | `EmailLinkCallback` | Inbox (email account) linking callback | `apps/web/src/routes/Root.tsx:292` |
| `/login/popup/success` | inline component | Popup-login success page; broadcasts `login-success` and closes | `apps/web/src/routes/Root.tsx:296` |
| `/login` | `Login` | Login screen | `apps/web/src/routes/Root.tsx:330` |
| `/welcome` | `MobileAuthWelcome` / `Login` | Native-mobile welcome, else login | `apps/web/src/routes/Root.tsx:334` |
| `/mobile-email-signup` | `MobileWebSignup` | Mobile-web email capture (send desktop link) | `apps/web/src/routes/Root.tsx:344` |
| `/onboarding` | `MobileOnboarding` / `OnboardingRoute` | Onboarding flow (v4 flag-gated on web/desktop) | `apps/web/src/routes/Root.tsx:347` |
| `/setup` | `SetupRoute` | Retired path; forwards to `/onboarding` (query intact) or `/` | `apps/web/src/routes/Root.tsx:357` |
| `/team-invite` | `TeamInviteAcceptance` | Accept a team invitation | `apps/web/src/routes/Root.tsx:360` |
| `/channel-invite` | `ChannelInviteAcceptance` | Accept a channel invitation | `apps/web/src/routes/Root.tsx:364` |
| `*404` | `NotFound` | Fallback; native → default route, web → origin | `apps/web/src/routes/Root.tsx:369` |

## 2. Component splits (split registry)

Registered via `registerComponent()` in `apps/web/src/components/app/split-layout/componentRegistry.tsx`; resolved by `resolveComponent()` (line 128) when a split pair is `component/{key}`. 28 always-registered keys, plus 19 `LOCAL_ONLY` and 5 `DEV_MODE_ENV` dev-only keys.

### Always registered (28)

| Split key | Component | Feature dir | Purpose | Source (componentRegistry.tsx) |
|---|---|---|---|---|
| `unified-list` | `RedirectSplit` → `inbox` | — | Legacy id, redirects to inbox | `:140` |
| `home` | `Home` | `features/home` | Home / chat-first landing view | `:145` |
| `getting-started` | `GettingStarted` | `features/getting-started` | Getting-started checklist view | `:153` |
| `inbox` | `SoupView` ("Inbox") | `features/next-soup` | Unified inbox list | `:161` |
| `activity` | `ActivityView` (lazy) | `features/activity-timeline` | Activity timeline (flag `ENABLE_ACTIVITY`, else redirect) | `:184` |
| `reminders` | `SoupView` ("Reminders") | `features/next-soup` | Reminders list (flag `ENABLE_REMINDERS`, else redirect) | `:197` |
| `calendar` | `CalendarView` (lazy) | `features/calendar` | Calendar (flag-gated, else redirect to inbox) | `:243` |
| `firehose` | `RedirectSplit` → `activity` | — | Retired id, redirects | `:247` |
| `my-activity` | `RedirectSplit` → `activity` | — | Retired id, redirects | `:250` |
| `agents` | `SoupView` ("Agents") | `features/next-soup` | Agents/automations list | `:254` |
| `mail` | `SoupView` ("Email") | `features/next-soup` | Email list | `:276` |
| `documents` | `SoupView` ("Files") | `features/next-soup` | Files/documents list (accepts filter params) | `:292` |
| `tasks` | `SoupView` ("Tasks") | `features/next-soup` | Tasks list | `:320` |
| `channels` | `SoupView` ("Channels") | `features/next-soup` | Channels list | `:340` |
| `calls` | `SoupView` ("Calls") | `features/next-soup` | Calls list | `:356` |
| `companies` | `SoupView` ("Customers") | `features/next-soup` + `features/companies` | CRM view (flag `ENABLE_CRM`; `?crmView=` saved-view param) | `:372` |
| `folders` | `SoupView` ("Folders") | `features/next-soup` | Folders list | `:402` |
| `search` | `SoupView` ("Search") | `features/next-soup` | Search results list (query/filter params) | `:428` |
| `loading` | `LoadingBlock` | — (`lib/core`) | Loading placeholder split | `:447` |
| `preview-empty` | `EmptyStatePanel` | — | Preview-pair viewer placeholder before selection | `:453` |
| `non-member-channel` | `NonMemberChannelPreview` | `features/next-soup` | Join prompt for a visible-but-unjoined channel | `:483` |
| `channel-compose` | `ChannelCompose` | `features/block-channel` | New channel composer | `:507` |
| `email-compose` | `EmailCompose` | `features/block-email` | New email composer (mailto `?to=` supported) | `:511` |
| `task-compose` | `ComposeTask` | `features/block-md` | New task composer | `:523` |
| `skill-compose` | `ComposeSkill` | `features/block-md` | New skill composer | `:527` |
| `import-linear` | `ImportLinear` (lazy) | `features/integrations/import-linear` | Linear import flow | `:531` |
| `settings` | `SettingsPanelComponentWrapper` | `features/settings` | Settings panel docked in a split | `:535` |
| `icon-gallery` | `IconGallery` (lazy) | — (`lib/core/internal`) | Icon gallery reference page | `:673` |

### Dev-only, `LOCAL_ONLY` (19)

`theme-debug` (:538), `core` (:542), `md` (:546), `data` (:553), `noise` (:557), `svg-noise` (:561), `chat` (:565), `chat-attachment` (:570), `chat-tool` (:574), `http-stream` (:578), `static-markdown-stream` (:582), `resize` (:588), `notifications-playground` (:593), `props-debug` (:602), `entity-debug` (:607), `quick-access-list` (:612), `hotkey-debugger` (:617), `user-icon` (:622), `dynamic-ui` (:627) — debug/demo pages for theme, markdown editor, AI chat internals, notifications, properties, entities, quick access, hotkeys, and the dynamic-UI gallery.

### Dev-only, `DEV_MODE_ENV` (5)

`document-where-playground` (:634), `projection-playground` (:643), `pixel-icon` (:651), `md-parse` (:655), `md-builder` (:664).

## 3. Block types

Type system in `apps/web/src/lib/core/block.ts`: `BlockRegistry` (17 names, `block.ts:50`), of which `write` is virtual (`VirtualBlockRegistry`, `block.ts:71`) → 16 concrete blocks, each with a `defineBlock` definition in its feature dir. Aliases: `BlockAliasRegistry = ['csv','task','snippet','skill']` (`block.ts:88`).

| Type | Component / renderer | Purpose (from definition `description`) | Source |
|---|---|---|---|
| `automation` | `Automation` | View and edit a single automation | `apps/web/src/features/block-automation/definition.ts:6` |
| `call` | `CallBlockAdapter` | Call block (recording/transcript view) | `apps/web/src/features/block-call/definition.ts:15` |
| `canvas` | `CanvasBlock` | Edit canvas | `apps/web/src/features/block-canvas/definition.ts:15` |
| `channel` | `NewChannelBlockAdapter` | Channel (messaging) block | `apps/web/src/features/block-channel/definition.ts:6` |
| `chat` | `BlockChat` | AI chat block | `apps/web/src/features/block-chat/definition.ts:18` |
| `code` | `BlockCode` | Edit code files with syntax highlighting; alias `csv` | `apps/web/src/features/block-code/definition.ts:12` |
| `company` | `CompanyBlockAdapter` | View a CRM company | `apps/web/src/features/block-company/definition.ts:6` |
| `contact` | `ContactBlockAdapter` | View a CRM contact | `apps/web/src/features/block-contact/definition.ts:6` |
| `email` | `EmailBlock` | View and manage email threads | `apps/web/src/features/block-email/definition.ts:6` |
| `image` | lazy `./component/Block` | View images | `apps/web/src/features/block-image/definition.ts:14` |
| `md` | `MarkdownBlock` | Write markdown notes; aliases `task`, `snippet`, `skill` | `apps/web/src/features/block-md/definition.ts:26` |
| `pdf` | lazy `./component/Block` | Work with PDF files | `apps/web/src/features/block-pdf/definition.ts:15` |
| `pr` | lazy `./component/Block` | View a GitHub pull request | `apps/web/src/features/block-pr/definition.ts:5` |
| `project` | lazy `./component/Block` | View individual folders (projects) | `apps/web/src/features/block-project/definition.ts:13` |
| `unknown` | `BlockUnknown` | Fallback block for unknown file types | `apps/web/src/features/block-unknown/definition.ts:11` |
| `video` | `BlockVideo` | Block for video file types | `apps/web/src/features/block-video/definition.ts:52` |
| `write` (virtual) | — resolves via a concrete block | Virtual name routed to another block implementation | `apps/web/src/lib/core/block.ts:71` |

Aliases: `csv` → `code` (`block-code/definition.ts:15`); `task`, `snippet`, `skill` → `md` (`block-md/definition.ts:30-34`). Non-document block types listed at `block.ts:101`.

## 4. Generated API clients

### Web app orval config — `apps/web/src/lib/service-clients/orval.config.ts` (13 entries)

| Client name | Spec file | Service | Codegen |
|---|---|---|---|
| `authService` | `service-auth/openapi.json` | Auth service | fetch (`orval.config.ts:4`) |
| `cognitionService` | `service-cognition/openapi.json` | Cognition (AI) service | fetch (`:17`) |
| `connectionGateway` | `service-connection/openapi.json` | Connection gateway (websocket/API) | fetch (`:30`) |
| `contactService` | `service-contacts/openapi.json` | Contacts service | fetch (`:43`) |
| `emailService` | `service-email/openapi.json` | Email service | fetch (`:56`) |
| `notificationService` | `service-notification/openapi.json` | Notification service | zod (`:70`) |
| `organization` | `service-organization/openapi.json` | Organization service — **spec/output dir absent at this SHA (stale entry)** | zod (`:84`) |
| `propertiesService` | `service-properties/openapi.json` | Properties service | zod (`:99`) |
| `scheduledActionService` | `service-scheduled-action/openapi.json` | Scheduled actions (agents/automations) | fetch (`:115`) |
| `searchService` | `service-search/openapi.json` | Search service | fetch (`:128`) |
| `staticFileService` | `service-static-files/openapi.json` | Static files service | fetch (`:141`) |
| `storageService` | `service-storage/openapi.json` | Document storage service (webhook schemas excluded) | zod (`:154`) |
| `unfurlService` | `service-unfurl/openapi.json` | Link unfurl service | fetch (`:189`) |

### Hand-written clients (same dir, not codegen'd) (4)

| Client | Path | Service |
|---|---|---|
| call | `apps/web/src/lib/service-clients/service-call/client.ts` | Call service (uses storage-service schemas) |
| stripe | `apps/web/src/lib/service-clients/service-stripe/client.ts` | Stripe/billing (via auth service) |
| sync | `apps/web/src/lib/service-clients/service-sync/client.ts` | Sync service (collab/live sync) |
| ai-editing-worker | `apps/web/src/lib/service-clients/ai-editing-worker/client.ts` | AI editing worker (document ops) |

### SDK codegen — `packages/sdk/openapi-ts.config.ts` (hey-api, 12 services)

One entry per service in `packages/sdk/services.ts:7`: `auth`, `cognition`, `connection`, `contacts`, `email`, `notification`, `properties`, `scheduled-action`, `search`, `static-files`, `storage`, `unfurl` — specs in `packages/sdk/specs/<service>.json`, output to `packages/sdk/generated/<service>/` (no `organization`, matching the missing web spec).

## 5. Feature directory map (`apps/web/src/features/*`)

| Directory | What it is |
|---|---|
| `activity-timeline` | Activity feed view (entity event rows, collapsing) |
| `auth` | Login/signup, email auth, permission prompts, reauth banners |
| `block-automation` | Automation block (view/edit one automation) |
| `block-call` | Call block (recording, transcript, incoming-call sidebar) |
| `block-canvas` | Canvas block editor |
| `block-channel` | Channel block + channel compose |
| `block-chat` | AI chat block |
| `block-code` | Code editor block (incl. CSV alias) |
| `block-company` | CRM company block |
| `block-contact` | CRM contact block |
| `block-email` | Email thread block + email compose |
| `block-image` | Image viewer block |
| `block-md` | Markdown block (notes, tasks, snippets, skills) + composers |
| `block-pdf` | PDF viewer block |
| `block-pr` | GitHub PR block |
| `block-project` | Folder/project block |
| `block-unknown` | Fallback block for unknown file types |
| `block-video` | Video player block |
| `calendar` | Calendar view (month/period navigation) |
| `channel` | Channel domain: calls, bots, attachments, create-channel modal, activity tracking |
| `channel-invitations` | Channel invite acceptance page |
| `chat` | Chat entry points (chat-with-agent button, soup chat input) |
| `command` | Command menu / launcher (Cmd-K), favorites commands |
| `companies` | CRM companies UI (create modals, CRM saved views) |
| `contacts` | CRM contacts UI |
| `devtools` | Dev status bar, hotkey debugger, debug playgrounds |
| `dynamic-ui` | AI-driven dynamic UI widgets / dashboard tool views |
| `entity` | Unified entity layer: extractors, bulk edit, entity modal, queries |
| `favorites` | Favorites (icon, sidebar section) |
| `getting-started` | Getting-started checklist view |
| `home` | Home view (chat composer, examples, backfill progress) |
| `inbox` | Inbox dialogs (add inbox, share-inbox conflict) |
| `integrations` | Integrations: Linear import, MCP setup |
| `next-soup` | The unified list engine ("soup"): filters, sorting, presets, SoupView, sidebar |
| `notifications` | Notification handling, election, platform routing, playground |
| `onboarding` | Interactive onboarding modal, mobile web signup |
| `paywall` | Paywall / plan grid (team owner & member views) |
| `property` | Property system (custom fields): API, components, context |
| `reminders` | Reminder composer and scheduling |
| `settings` | Settings panel and all tabs |
| `setup` | Onboarding flow (v4) — connectors, imports, modules |
| `sharing` | Share modal, iOS share sheet |
| `team-invitations` | Team invite modal + acceptance page |
| `theme` | Theming: constants, signals, utils, components |

## 6. Settings / secondary navigation

Settings tab config (single source of truth): `apps/web/src/lib/core/constant/settingsTabsConfig.tsx:48` (`SETTINGS_TAB_GROUPS`), consumed by the settings panel (`apps/web/src/features/settings/Settings.tsx`) and the app sidebar dropdown. URL: `/settings/<slug>` page or `settings/<slug>` split pair (slug map `settingsTabsConfig.tsx:89`).

| Group | Tab | Label | Slug | Component | Gate |
|---|---|---|---|---|---|
| General | `Account` | Account | `account` | `features/settings/Account.tsx` | always |
| General | `Billing` | Billing | `billing` | `features/settings/Billing.tsx` | always |
| General | `Appearance` | Appearance | `appearance` | `features/settings/Appearance.tsx` | always |
| General | `Mobile App` | Mobile App | `mobile-app` | `features/settings/MobileApp.tsx` | QR flag, not native mobile |
| General | `Shortcuts` | Shortcuts | `shortcuts` | `features/settings/Shortcuts.tsx` | not touch device |
| Workspace | `Team` | Team | `team` | `features/settings/Team.tsx` | always |
| Workspace | `Tags` | Tags | `tags` | `features/settings/Tags.tsx` | always |
| Workspace | `CRM` | CRM | `crm` | `features/settings/Crm.tsx` | `enable-crm` flag |
| Workspace | `Connected` | Connections | `connections` | `features/settings/ConnectedAccounts.tsx` | always |
| Workspace | `Agent` | MCP server | `mcp-server` | `features/settings/Agent.tsx` | not native mobile |
| Workspace | `Bots` | Bots | `bots` | `features/settings/Bots.tsx` | bot-management flag |
| Admin | `Admin` | Debug | `admin` | `features/settings/Admin.tsx` | `WRITE_ADMIN_PANEL` permission |

Additional `SettingsTab` slugs exist without a nav-group entry (legacy/URL-only, `settingsTabsConfig.tsx:89`): `Subscription`, `Organization`, `Mobile` (native+dev only), `AI Memory`, `Inbox`, `Email`, `GitHub` — `Email.tsx` / `GitHub.tsx` / `Integrations.tsx` components exist in `features/settings/` but are not in the current tab groups.

Other secondary navigation: command menu / launcher (`apps/web/src/features/command/CommandMenu.tsx`, `Launcher.tsx`) and the sidebar within the soup engine (`apps/web/src/features/next-soup/sidebar/`), including view presets (`soup-filter-presets`) that back the app routes in section 1. Settings hotkeys (Tab/Shift+Tab/1-9/Escape) are registered in `features/settings/Settings.tsx:134-205`.
