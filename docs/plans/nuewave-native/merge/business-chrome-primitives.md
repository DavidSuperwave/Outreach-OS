# Business-chrome primitives — billing/paywall, onboarding, getting-started

> Created 2026-08-19 under the **parked-prepare mandate (Q19)**: reference-only
> documentation of how the OLD platform's business chrome mechanically works,
> as input to David's *different* plan. **Zero proposals, zero verdicts** —
> this file describes what the pinned source does, nothing more.
>
> All pointers are `path/from/clone/root:line` against the pinned clone at
> `main@9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf`
> (`C:\Users\Kecin\Projects\Neuwave`). Tripwires respected: mechanics only, no
> trade dress reproduced; short quotes are evidence, not ported code.

---

## 1. Billing / paywall

### 1.1 Flow narrative

**Every user is a Stripe customer from signup.** User creation in the
authentication service calls Stripe first and stores the resulting customer id
in the user row — `create_user` at
`services/authentication_service/src/service/user/create_user.rs:11` calls
`create_stripe_user` (`:65`, `stripe::Customer::create`) and persists
`stripe_customer_id`, which is `NOT NULL` on `macro_user`
(`crates/macro_db_client/migrations/0001_baseline.sql:37`, unique index
`:940`). A source comment notes this adds ~400 ms to signup
(`create_user.rs:19-20`).

**Entitlements are DB roles/permissions, not live Stripe reads.** The
`Role` / `Permission` / `RolesOnPermissions` / `RolesOnUsers` tables (baseline
migration) carry the whole model; the `roles_and_permissions` crate types them
(`crates/roles_and_permissions/src/domain/model.rs:29-62` roles,
`:132-155` permissions). The load-bearing bits at the pin:

- **`read:professional_features`** = "is a paying user". It drives
  `license_status` ("active"/"inactive") in
  `services/authentication_service/src/api/user/get_legacy_user_permissions.rs:121-132`,
  skips the quota (`.../get_user_quota.rs:36-41`), unlocks premium AI models in
  chat (`crates/chat/src/inbound/http/extractors.rs:69-71,133`), gates premium
  models for AI projections
  (`crates/ai_projections/src/inbound/axum_router/upsert_projection.rs:108-111`),
  and lifts the free two-inbox cap on Gmail linking
  (`services/authentication_service/src/api/link/gmail.rs:211-226`).
- **`write:proai`** = paid AI models. Introduced by the collapse migration
  `crates/macro_db_client/migrations/20260624175951_collapse_ai_permissions_to_proai.sql`,
  which retired the per-tier `write:haiku/sonnet/opus` permissions ("free users
  get haiku, paid users get everything").
- Subscription roles: `professional_subscriber` plus a tier role
  (`sub_haiku`/`sub_sonnet`/`sub_opus`) for personal subs;
  `team_subscriber` + `sub_opus` for team members. Seeded by
  `20251029204527_add_legacy_roles_and_permissions.sql` and
  `20251029204532_add_team_subscriber_role.sql`; all team users were force-set
  to opus by `20260514174907_update_team_roles_to_opus.sql`.

**Checkout** is `POST /user/stripe/checkoutv2`
(`services/authentication_service/src/api/user/stripe/create_checkout_session_v2.rs:41-179`,
mounted at `services/authentication_service/src/api/user/mod.rs:52-60`):
look up `stripe_customer_id` from the DB → reject with 409 `AlreadySubscribed`
if any active/trialing subscription exists (`:76-91`) → optional promo-code
lookup (404 `PromoCodeNotFound` if invalid, `:94-111`) → if the caller owns a
team, stamp `team_id` + `owner_id` into the subscription metadata (`:117-125`)
→ attach `ga_client_id`/`fbp`/`fbc` tracking metadata (`:127-135`) → create a
subscription-mode Checkout Session for **one line item: the single configured
price id × quantity 1** (`ctx.stripe_price_id`, `:144-166`; config at
`services/authentication_service/src/config.rs:115-116`) → return the raw
signed session URL. There is exactly one paid product; error mapping lives in
`services/authentication_service/src/api/user/stripe/shared.rs`.

**Portal** is `POST /user/stripe/portal`
(`.../stripe/create_portal_session.rs:19-57`): customer id from DB →
`stripe::BillingPortalSession::create` → return URL. All plan management
(cancel, payment method) happens inside Stripe's hosted portal.

**The Stripe webhook rides on `authentication_service`:**
`POST /webhooks/user/stripe`
(`services/authentication_service/src/api/webhooks/user/mod.rs:16`, nested via
`.../webhooks/mod.rs:9` and `.../api/mod.rs:117-122`; the `/webhooks` nest gets
a connection-drop-prevention middleware). The handler
(`.../webhooks/user/stripe_webhook.rs:97-183`) verifies the
`stripe-signature` header against `ctx.stripe_webhook_secret` and handles two
event families; everything else logs "unexpected event type" and 200s:

- `customer.subscription.{created,updated,deleted,paused}` →
  `handle_customer_subscription_event` (`:337-602`):
  - `incomplete` subs are skipped; an `updated` transitioning
    incomplete→active/trialing is treated as a new subscription (`:355-394`).
  - Splits on `subscription.metadata.team_id`: present → team path (below),
    absent → personal path (`:460-481`).
  - Personal path: **duplicate-subscription guard** — if a new active sub
    isn't the customer's oldest active sub, it is cancelled server-side and no
    permissions change (`:483-527`). `trialing` sets `macro_user.has_trialed`
    and mirrors `has_trialed=true` into Stripe customer metadata (`:541-557`).
    `active` triggers referral processing (`:559-564`). Then roles are updated
    via `update_user_roles_and_permissions_for_subscription` with
    `ProductTier::Opus` hardcoded (`:574-582`) — the price id on the sub is
    read but unused (`:566-572`).
  - Conversion analytics (GA purchase/refund, Meta Purchase/CancelSubscription,
    PostHog subscription_created/canceled) fire-and-forget (`:722-844`).
- `invoice.{payment_failed,payment_succeeded,paid}` → `handle_payment_event`
  (`:186-334`): failed → revoke (mapped to `PastDue`), succeeded/paid →
  restore (`Active`) — but a failed invoice does **not** revoke if the
  customer has another active personal subscription (`:297-323`). Same
  team/personal split by metadata.

**The roles writer** is
`crates/roles_and_permissions/src/domain/service.rs:45-81`: resolve user id by
customer email → roles = `[professional_subscriber, sub_<tier>]` → `Active`
adds them, `Canceled|IncompleteExpired|PastDue|Paused|Unpaid` removes them
(`trialing` maps to `Active` at
`crates/roles_and_permissions/src/domain/model.rs:271-285`).

**Team billing is seat-count bookkeeping against one subscription.** The
`teams` crate owns it:

- `is_user_premium` = "customer has an active Stripe subscription"
  (`crates/teams/src/domain/team_service.rs:626-645`, listing via
  `crates/teams/src/outbound/customer_repo.rs:150-165`). The
  `PremiumUserExtractor` turns that into a 403 "active subscription required"
  (`crates/teams/src/inbound/axum_router/premium_user.rs:25-103`) — present
  but team creation itself no longer requires it: teams are free up to
  `FREE_TEAM_MAX_MEMBERS = 5` (`crates/teams/src/domain/model.rs:57`;
  create handler links a sub only if the owner has one,
  `crates/teams/src/inbound/axum_router/create_team.rs:38-49`).
- Paid team caps come from `team.plan` (`team_plan` enum
  `idea/pre_seed/seed/series_a/growth`, seat caps 3/6/10/25/unlimited —
  `crates/teams/src/domain/model.rs:28-51`). Invite/join paths check
  `seat_count + new > cap` (`team_service.rs:703-724, 1773, 1880`).
- Joining/leaving a paid team increments/decrements the Stripe subscription
  item quantity with `AlwaysInvoice` proration
  (`team_service.rs:861-886, 1298, 1335, 1929`;
  `outbound/customer_repo.rs:57-127` — decrement never drops below one seat).
- `convert_subscription_to_team` stamps `team_id`/`owner_id` metadata onto the
  owner's existing personal subscription (`outbound/customer_repo.rs:129-147`,
  driven from `team_service.rs:368-398,582`), which is exactly what the
  webhook later keys on.
- Webhook team path (`stripe_webhook.rs:640-699`): persist `subscription_id`
  onto the team row, then `active|trialing` →
  `restore_permissions_for_team_members` (adds `team_subscriber` + `sub_opus`
  to **every** member, `team_service.rs:1470-1492`) + `team.paying = true`;
  any bad status → `revoke_permissions_for_team_members`
  (`team_service.rs:1444-1468`) + `paying = false`.
- `team.enterprise = true` teams are billed out-of-band; membership changes
  skip all Stripe bookkeeping (migration
  `20260715190633_add_team_enterprise.sql`).

**Free-tier quota** is tiny and hard-coded: `crates/user_quota/src/lib.rs`
declares `MAXIMUM_USER_QUOTA = { documents: 10, ai_chat_messages: 10 }`.
`GET /user/quota` returns 204 for premium users, else current counts + maxima
(`services/authentication_service/src/api/user/get_user_quota.rs`, counting via
`crates/macro_db_client/src/user_quota.rs`).

**Backend paywall enforcement points** (where a request is refused for plan
reasons):

| Check | Where | Failure mode |
|---|---|---|
| Premium AI model in chat stream | `services/document_cognition_service/src/api/stream/chat_message/mod.rs:178-186` via `ChatModelAccess` (`crates/chat/src/inbound/http/extractors.rs:55-124`) | 403 "No access to model …" |
| Premium model for AI projections | `crates/ai_projections/src/inbound/axum_router/upsert_projection.rs:108-111` | professional-features error (`crates/ai_projections/src/domain/model.rs:295`) |
| >2 linked inboxes on free | `services/authentication_service/src/api/link/gmail.rs:30` (`FREE_INBOX_LIMIT = 2`), `:211-226` enforcement, `:62` → **402 Payment Required** |
| Free team > 5 members / paid team > plan seat cap | `crates/teams/src/domain/team_service.rs:703-724` (invites), `:1773,1880` (joins) | domain errors → HTTP via `crates/teams/src/inbound/axum_router/mod.rs` |
| Doc/AI-message quota (free) | `crates/user_quota` + `GET /user/quota`; client-side gating from the counts | client shows paywall |
| Active-subscription-required extractor | `crates/teams/src/inbound/axum_router/premium_user.rs:75-103` | 403 |
| Double checkout | `create_checkout_session_v2.rs:85-91` | 409 |

**Referral program (Stripe-adjacent).** `referral_tracking` table (migrations
`20260317134548`, `20260319143005`); router nested at `/referral`
(`services/authentication_service/src/api/mod.rs:104-113`;
`crates/referral/src/inbound/axum_router.rs` — get-referral-code + send-invite).
When a referred user's subscription goes active, the webhook calls
`check_and_process_referral` (`stripe_webhook.rs:604-634`), and the referral
service credits the **referrer's** Stripe balance with a negative
`CustomerBalanceTransaction`
(`crates/referral/src/outbound/stripe_discount_client.rs:30-56`).

**Side note:** `services/bots/stripe-payment-bot/` is a standalone Cloudflare
Worker channel-bot that receives its own Stripe webhook and posts
payment-received notifications into channels; it is not part of the
entitlement pipeline.

### 1.2 Tables (all in the MacroDB migration chain, `crates/macro_db_client/migrations/`)

| Table / column | Purpose | Migration |
|---|---|---|
| `macro_user.stripe_customer_id` (TEXT NOT NULL, unique) | 1:1 user↔Stripe customer | `0001_baseline.sql:32-40,940` |
| `macro_user.has_trialed` (bool, default true for pre-existing) | trial-once tracking, mirrored to Stripe metadata | `20260227152447_add_has_trialed_to_macro_user.sql` |
| `Role`, `Permission`, `RolesOnPermissions`, `RolesOnUsers` | entitlement model | baseline + seeds `20251029204527`, `20251029204532`, `20260130213952_super_user_write_stripe.sql`, `20260624175951` (proai collapse), `20260514174907` (team users → sub_opus) |
| `team.subscription_id` (TEXT, nullable) | the team's Stripe subscription | `20251029143302_team_subscription_id.sql` |
| `team.seat_count` (INT default 0) | local seat mirror | `20251029143307_team_seat_count.sql` |
| `team.plan` (`team_plan` enum, nullable) | seat-cap tier | `20260514192605_team_plans.sql` |
| `team.paying` (bool) | webhook-maintained payment status | `20260525122155_add_team_paying_boolean.sql` |
| `team.enterprise` (bool) | out-of-band billing, skip Stripe bookkeeping | `20260715190633_add_team_enterprise.sql` |
| `team_user.tier` / `team_invite.tier` | per-member tier — **added then removed** | added `20260325131311`/`20260325154744`, dropped `20260514170455`/`20260514170723` |
| `referral_tracking` | referrer↔referred + status | `20260317134548`, constraints `20260319143005` |
| Legacy `User.stripeCustomerId`, `Organization.stripeCustomerId` | pre-`macro_user` era, still in baseline | `0001_baseline.sql:102,156,962,982` |

### 1.3 Endpoints

All on `authentication_service` unless noted; router root
`services/authentication_service/src/api/mod.rs:78-123`.

| Method + path | Handler | Notes |
|---|---|---|
| `POST /user/stripe/checkoutv2` | `api/user/stripe/create_checkout_session_v2.rs:55` (route `api/user/mod.rs:52-60`) | checkout session; 409 if already subscribed |
| `POST /user/stripe/portal` | `api/user/stripe/create_portal_session.rs:31` (route `api/user/mod.rs:61-64`) | billing portal session |
| `POST /webhooks/user/stripe` | `api/webhooks/user/stripe_webhook.rs:97` (route `api/webhooks/user/mod.rs:16`) | signature-verified event intake |
| `GET /user/quota` | `api/user/get_user_quota.rs` (route `api/user/mod.rs:51`) | 204 when premium |
| `GET /user/legacy_user_permissions` | `api/user/get_legacy_user_permissions.rs:100` (route `api/user/mod.rs:65-67`) | permissions + `license_status` + `has_trialed` + `referral_code` + `created_at` — the frontend's "user info" |
| `POST/GET/PATCH/DELETE /team/*` | `crates/teams/src/inbound/axum_router/mod.rs:95-142` (nest `api/mod.rs:94-103`) | create/invite/join/remove drive the seat bookkeeping above |
| `GET /referral/*`, `POST /referral/*` | `crates/referral/src/inbound/axum_router.rs` (nest `api/mod.rs:104-113`) | referral code + invite email |

### 1.4 Frontend

- **Global paywall dialog.** State machine
  `apps/web/src/lib/core/constant/PaywallState.tsx`: `PaywallKey` enum
  (PROJECT_LIMIT, FILE_LIMIT, IMAGE_LIMIT, CHAT_LIMIT, O1_LIMIT,
  CANVAS_CLIKED, SAVED_PROMPT, REMOVE_SIGNATURE, MULTI_INBOX, TEAMS) with
  per-key title/description/learn-more copy, plus a module-level
  `showPaywall(key)` signal. Mounted once in
  `apps/web/src/components/app/Layout.tsx:485` (`<Paywall />`,
  `apps/web/src/features/paywall/Paywall.tsx`); also re-shown post-login via a
  `sessionStorage.showUpgradeModal` flag (`Layout.tsx:411-416`). ~16
  `showPaywall(...)` call sites, e.g. chat creation
  (`lib/core/util/create.ts:415-416`, CHAT_LIMIT), storage/file limits
  (`lib/service-clients/service-storage/client.ts:1267` etc., FILE_LIMIT),
  extra inbox (`lib/core/email-link/index.ts:259,306`, MULTI_INBOX), premium
  model lock (`lib/core/component/AI/component/input/ChatInput.tsx:271`,
  O1_LIMIT), chat send (`features/chat/SoupChatInput.tsx:76-78`).
- **402/403 → paywall mapping**:
  `apps/web/src/lib/core/util/handlePaymentError.ts` — `FORBIDDEN` code, or
  `HTTP_ERROR` whose message contains `402`/`payment_required`/`403`.
- **Paywall body**: `apps/web/src/features/paywall/PaywallComponent.tsx` —
  $40 per seat/month copy, feature list; unpaid → checkout
  (`stripeServiceClient.createCheckoutSessionV2`, `:64-81`), paid → portal
  (`:83-90`); team **members** get a disabled button ("managed by your team
  owner", `:62,168-194`). `PaywallTeamOwnerView.tsx`,
  `PaywallTeamMemberView.tsx`, `PlanGrid.tsx`, `SubscriptionTier.tsx` exist in
  the folder but nothing imports them at the pin (legacy).
- **Paid-access hook**: `apps/web/src/lib/core/auth/license.ts:4-10` —
  `licenseStatus === 'trialing' | 'active'`; `licenseStatus` flows from user
  info (`lib/core/context/user.ts:66,119`), i.e. from
  `legacy_user_permissions`.
- **Billing settings page**: `apps/web/src/features/settings/Billing.tsx` —
  current plan card, upgrade/manage buttons gated on the
  `write:stripe_subscription` permission (`:49-51`) and team role; $40/seat
  copy; plan feature lists at `:15-27`.
- **Plans catalogue**: `apps/web/src/features/paywall/plans.ts` — exactly two
  tiers, `free` and `premium` ($40), with a 3-row feature comparison.
- **Checkout return handling**:
  `apps/web/src/features/paywall/use-checkout-completion-listener.ts` — on
  `?subscriptionSuccess=true`, toast + poll user info up to 10×1 s until the
  license flips (the flip is asynchronous via webhook).
- **Client wrapper**:
  `apps/web/src/lib/service-clients/service-stripe/client.ts` — collects GA
  client id + Meta `_fbp`/`_fbc` cookies, default success/cancel URLs
  (`/app/?subscriptionSuccess=true`), delegates to the generated auth-service
  client.

### 1.5 Stripe touchpoints (complete list at the pin)

| Touchpoint | Code |
|---|---|
| Customer create at signup | `services/authentication_service/src/service/user/create_user.rs:65-79` |
| Checkout session create (+ subscription list, promo list) | `api/user/stripe/create_checkout_session_v2.rs` |
| Billing portal session create | `api/user/stripe/create_portal_session.rs` |
| Webhook intake (subscription + invoice events; customer retrieve/update; duplicate-sub cancel) | `api/webhooks/user/stripe_webhook.rs` |
| Team seat quantity update / sub cancel / metadata conversion / active-sub lookup | `crates/teams/src/outbound/customer_repo.rs` |
| Referral credit (customer balance transaction) | `crates/referral/src/outbound/stripe_discount_client.rs` |
| Config: secret key, price id, webhook secret | `services/authentication_service/src/config.rs:83,115-116`, `src/main.rs` wiring |
| Standalone payment-notification channel bot (own webhook) | `services/bots/stripe-payment-bot/` |

---

## 2. Onboarding (the `setup` flows)

### 2.1 Flow narrative

Two generations coexist at the pin, switched by a PostHog feature flag
(`useOnboardingV4Flag`, `apps/web/src/features/setup/flow/useOnboardingV4Flag.ts`):

**Generation 1 — the interactive tutorial modal.**
`apps/web/src/features/onboarding/InteractiveOnboardingModal.tsx` (+
`lessons/`, `sandbox/`, `create-onboarding-state.ts`) is an in-app guided
tutorial. Root auto-opens it for authenticated users with
`tutorialComplete === false` when the v4 flag is off or on mobile
(`apps/web/src/routes/Root.tsx:483-530`). Completing it PATCHes
`/user/tutorial` (`services/authentication_service/src/api/user/patch_tutorial.rs`,
route `api/user/mod.rs:49`), flipping the baseline `tutorialComplete` boolean
(`crates/macro_db_client/migrations/0001_baseline.sql:103`) — **this legacy
flag is still the gate the whole app keys off** (see redirect below). The
getting-started page can replay the same modal on demand
(`features/getting-started/getting-started.tsx:92-96,177-182`).

**Generation 2 — onboarding v4, the full-screen `/onboarding` flow.**
The old split-screen `/setup` surface is retired: `/setup` 302-forwards to
`/onboarding` with query intact (`apps/web/src/routes/Root.tsx:183-201,357`),
and `/onboarding` renders `OnboardingFlow`
(`Root.tsx:348`, `apps/web/src/features/setup/flow/OnboardingFlow.tsx`).
Desktop first-time users are pushed there from anywhere in the app by
`NewOnboardingRedirect` (`apps/web/src/components/app/Layout.tsx:305-340`),
which fires on `tutorialComplete === false`, preserves the arrival deep link
as `?next=`, and skips auth routes.

Backend state is one row per user in **`user_onboarding`**
(migration `20260720224652_user_onboarding.sql`: `status
'active'|'completed'`, `skipped`, `started_at`, `completed_at`) owned by the
`onboarding` crate and mounted on **document_cognition_service**
(`services/document_cognition_service/src/api/mod.rs:107-112`):

- `GET /onboarding` (`crates/onboarding/src/inbound/axum_router.rs:69,80-104`)
  returns the aggregate `OnboardingState` — the row, the user's MCP connector
  connections, and `suggested_team_domain` (the email domain unless it's a
  generic consumer provider; same judgment the teams service uses for domain
  auto-join — `crates/onboarding/src/domain/service.rs:26-30`). Reading the
  state is **what drives the flow**: while the row is `active`, each read
  starts any due import gather runs — one auto-importing gather per
  authenticated connector that never had one, CAS-protected
  (`service.rs:104-119,129-140`). The frontend polls it every 12 s
  (`apps/web/src/lib/queries/onboarding.ts:40-49`).
- A **post-OAuth hook** reconciles instantly: the moment an MCP connector
  finishes OAuth, DCS spawns `service.reconcile(user)`
  (`services/document_cognition_service/src/main.rs:618-633`), which is a
  no-op for users not actively in the flow (`service.rs:142-167`).
- `POST /onboarding/complete` (`axum_router.rs:70,106-129`) marks the row
  completed (idempotent, `skipped` recorded;
  `crates/onboarding/src/outbound/pg_onboarding_repo.rs:46-63` is an
  insert-or-return upsert) and best-effort deletes unreserved
  onboarding-staged import candidates (`service.rs:169-194` — deleted, not
  "discarded", so they stay re-stageable).

The connector work itself lives in the **import pipeline** (`crates/import`,
also mounted on DCS at `api/mod.rs:101-106`): `GET /import/state`,
`POST /import/run`, `POST /import/runs/{source}/retry|dismiss`
(`crates/import/src/inbound/axum_router.rs:73-81`), backed by
`import_entity` (staged→importing→imported/discarded ledger, sources
linear/notion/slack, initiator onboarding/chat) and `import_run` (per
user×source gather status) — migrations
`20260720221050_import_entities.sql` and
`20260723150434_support_auto_import_runs.sql`.

Separately, **`PATCH /user/onboarding`** on the authentication service
(`services/authentication_service/src/api/user/patch_user_onboarding.rs`,
route `api/user/mod.rs:70`) is a plain profile write: first/last name, title,
industry into `macro_user_info` (baseline `0001_baseline.sql:50-62`). Despite
the name it carries no flow state.

**The v4 flow's steps** (`OnboardingFlow.tsx`; step defs `:150-226`, order
resolved by feature-flag config in
`features/setup/flow/onboardingConnectorConfig.ts`):

1. `connect-<name>` — one step per configured connector (Linear, Notion,
   Slack, GitHub copy at `:103-140`), MCP OAuth via `ConnectorStep.tsx`;
   gather runs start server-side the moment auth completes (hook above).
2. `email` — link Google accounts (`EmailStep.tsx`).
3. `team` — `TeamStep.tsx`: already-member confirmation, pending invites to
   join (team endpoints), or create-team with same-domain teammate prefill
   (cap 6, `features/setup/flow/teamInvites.ts:4`), driven by
   `suggested_team_domain`.
4. `building` — chromeless transition (`BuildingStep.tsx` + brand-handoff
   overlay).
5. `summary` — what the gathers found (`SummaryStep.tsx`, reads
   `/import/state`).
6. `plan` — `PlanStep.tsx`: Free vs Premium ($40) using the paywall's plan
   catalogue. Premium calls `createOnboardingCheckoutSession`
   (`features/onboarding/use-onboarding-checkout.ts:27-41`) with success/cancel
   URLs pointing back at `/onboarding` — the flow stays **incomplete during
   checkout**, both Stripe legs land back on the plan step (step index
   persisted in sessionStorage), and on `?subscriptionSuccess=true` the step
   polls user info up to 10×1 s until the webhook flips the license
   (`PlanStep.tsx:15-60`).

**Finishing** (`features/setup/flow/createFlowFinish.ts`): fire
`POST /onboarding/complete` and `PATCH /user/tutorial` together, verify
`tutorialComplete` actually stuck by refetching user info (otherwise the
redirect would bounce the user straight back, `:74-102`), clear the
sessionStorage step/next keys, then navigate to the sanitized `?next=` deep
link or `AFTER_SETUP_ROUTE = '/component/getting-started'`
(`apps/web/src/lib/constants/defaultRoute.ts:6`). Free and premium exits share
this path (`finishFree` / `finishPremium`); `startPremiumCheckout` hands the
page to Stripe without completing (`:118-137`).

Dead seam worth knowing: `savePendingTeam`/`getPendingTeam`/`clearPendingTeam`
in `use-onboarding-checkout.ts:44-62` (localStorage "create team after
checkout" plumbing) have **no callers** at the pin.

Mobile has its own signup/welcome surfaces
(`features/auth/mobile-onboarding/`, `features/onboarding/MobileWebSignup.tsx`,
routes in `Root.tsx`) that funnel into the Gen-1 modal, not the v4 flow.

### 2.2 State written by onboarding

| State | Where | Written by |
|---|---|---|
| `user_onboarding` row (status/skipped/timestamps) | MacroDB, `20260720224652_user_onboarding.sql` | `GET /onboarding` (ensure), `POST /onboarding/complete` |
| `tutorialComplete` bool | `User` table, `0001_baseline.sql:103` | `PATCH /user/tutorial` — the app-entry gate |
| Profile fields (name/title/industry) | `macro_user_info`, baseline | `PATCH /user/onboarding` |
| `import_entity` / `import_run` rows | `20260720221050`, `20260723150434` | gather jobs + `/import/run` |
| MCP server connections | `mcp_client` crate storage | connector OAuth during the flow |
| Email links, team membership/invites, Stripe subscription | their own domains | email/team/plan steps |
| Step index + `?next` deep link | sessionStorage (`FLOW_STEP_STORAGE_KEY`, `FLOW_NEXT_STORAGE_KEY`, `features/setup/flow/shared.tsx`) | the flow itself |

### 2.3 Endpoints

| Method + path | Service | Handler |
|---|---|---|
| `GET /onboarding` | document_cognition_service | `crates/onboarding/src/inbound/axum_router.rs:80` |
| `POST /onboarding/complete` | document_cognition_service | `crates/onboarding/src/inbound/axum_router.rs:106` |
| `GET /import/state`, `POST /import/run`, `POST /import/runs/{source}/retry`, `POST /import/runs/{source}/dismiss` | document_cognition_service | `crates/import/src/inbound/axum_router.rs:73-81` |
| `PATCH /user/tutorial` | authentication_service | `api/user/patch_tutorial.rs` |
| `PATCH /user/onboarding` | authentication_service | `api/user/patch_user_onboarding.rs` |
| `POST /user/stripe/checkoutv2` (plan step) | authentication_service | §1.3 |

---

## 3. Getting-started

### 3.1 What it is

A **frontend-only checklist page** where new users land after onboarding
(`AFTER_SETUP_ROUTE = '/component/getting-started'`). It is registered as a
component split (`apps/web/src/components/app/split-layout/componentRegistry.tsx:154`)
rendering `GettingStarted`
(`apps/web/src/features/getting-started/getting-started.tsx`), and as a
sidebar link (`apps/web/src/components/app/app-sidebar/sidebar.tsx:998-1001`,
inserted at `:1046`). The page acts as a "Preview Pair Controller": activating
a row opens its result (settings tab, doc, chat) in the adjacent split
(`getting-started.tsx:49-56,98-118`).

**Who sees it:** only accounts created on/after `2026-07-28`
(`GETTING_STARTED_MIN_ACCOUNT_CREATED`,
`features/getting-started/account-gate.ts:12-26`), judged from
`userInfo.createdAt` — which the backend serves from
`legacy_user_permissions` (`get_legacy_user_permissions.rs:39-42`). The
sidebar link can also be removed by the user; that flag is its own store
(`features/getting-started/sidebar-visibility.ts`, localStorage key
`macro:getting-started-sidebar-hidden`, hide-only, optimistic).

### 3.2 What it shows

Three sections of actions (`getting-started.tsx:152-241`):

1. **Connect your tools** — single `connect-tools` action opening the
   Connected settings tab. Live-complete when the user has >1 email link, a
   linked GitHub account, or any authenticated MCP server (`:163-168`; MCP
   query polls every 4 s because OAuth finishes in a popup, `:75-80`).
2. **Set up your account** — `play-tutorial` (replays the Gen-1
   `InteractiveOnboardingModal`), `how-to-guide` (opens the how-to doc seeded
   at signup, id from `useStarterDocsQuery`, falling back to the public docs
   site), `set-name` (live-complete when a real first/last name or legacy
   display name exists), `choose-theme` (observer-complete on any theme-signal
   change while mounted).
3. **Put the agent to work** — one action per entry in
   `features/getting-started/agent-examples.ts`; each creates a chat and
   auto-sends the example prompt, pinning the model to
   `defaultModelForPlan(hasPaidAccess())` so free users don't trip the
   premium-model 403 (`:120-141` — the paywall touchpoint on this page).

### 3.3 Completion state — what is tracked, where

All persistence is **client-side localStorage**, user-scoped under the key
prefix `macro:getting-started`
(`features/getting-started/getting-started-store.ts`): a JSON snapshot of
`completedActionIds` + `collapsedSectionIds`. Reactive layer in
`getting-started-state.ts` (signals + persist-on-change; unknown ids kept on
load so renames don't erase progress). There is **no backend table and no
endpoint** for getting-started progress; the seams (`GettingStartedStore`,
`GettingStartedSidebarStore`) are interfaces a backend store could implement
but only localStorage implementations exist at the pin.

The completion model (`getting-started-types.ts`, applied at
`getting-started.tsx:243-264`):

| Mechanism | Persisted? | Example |
|---|---|---|
| `isComplete()` — live derived state, ORed with the persisted set, never persisted itself ("stays honest when a tool is disconnected") | no | connect-tools, set-name |
| `observe(markComplete)` — event observers registered once at page setup, persist on fire | yes | choose-theme |
| default — successful `onActivate` with neither of the above persists completion ("clicking it completes it") | yes | play-tutorial, how-to-guide, agent examples |

Section headers show `completed/total` progress and are collapsible
(collapse state persisted in the same snapshot).

---

## Coverage

**Read in full (file by file):**
`services/authentication_service/src/api/{mod.rs, user/mod.rs,
user/stripe/mod.rs, user/stripe/shared.rs,
user/stripe/create_checkout_session_v2.rs, user/stripe/create_portal_session.rs,
webhooks/mod.rs, webhooks/user/mod.rs, webhooks/user/stripe_webhook.rs,
user/get_legacy_user_permissions.rs, user/patch_user_onboarding.rs}`;
`crates/roles_and_permissions/src/domain/{model.rs, service.rs}`;
`crates/onboarding/src/{domain/models.rs, domain/ports.rs, domain/service.rs,
inbound/axum_router.rs}`; `crates/user_quota/src/lib.rs`;
`crates/teams/src/inbound/axum_router/premium_user.rs`;
`crates/teams/src/domain/customer_repo.rs`;
`crates/referral/src/outbound/stripe_discount_client.rs`;
migrations `0001_baseline.sql` (targeted sections: enums, macro_user*, team*,
saved_view boundary) and, whole: `20251029143302/143307/204527/204532`,
`20260130213952`, `20260227152447`, `20260317134548`, `20260325131311/154744`,
`20260514170455/174907/192605`, `20260525122155`, `20260624175951`,
`20260715190633`, `20260720221050/224652`, `20260723150434`;
frontend: all of `features/getting-started/` except `agent-examples.ts` and
`getting-started-rows.tsx` (skimmed), `features/paywall/{Paywall.tsx,
PaywallComponent.tsx, plans.ts, use-checkout-completion-listener.ts}`,
`features/settings/Billing.tsx`, `features/setup/flow/{createFlowFinish.ts,
PlanStep.tsx, teamInvites.ts}`, `features/onboarding/use-onboarding-checkout.ts`,
`lib/core/constant/PaywallState.tsx`, `lib/core/util/handlePaymentError.ts`,
`lib/core/auth/license.ts`, `lib/queries/onboarding.ts`,
`lib/constants/defaultRoute.ts`, `lib/service-clients/service-stripe/client.ts`
(head), `OnboardingFlow.tsx` (first ~140 lines + step-definition region).

**Read in targeted excerpts (grep + sed windows, not whole-file):**
`crates/teams/src/domain/{team_service.rs (is_user_premium, seat paths,
revoke/restore, patch_*), model.rs (TeamPlan, FREE_TEAM_MAX_MEMBERS)}`;
`crates/teams/src/outbound/customer_repo.rs`;
`crates/teams/src/inbound/axum_router/{mod.rs routes, create_team.rs}`;
`crates/chat/src/inbound/http/extractors.rs`;
`services/document_cognition_service/src/{api/mod.rs mounts,
api/stream/chat_message/mod.rs model check, main.rs reconcile hook}`;
`crates/import/src/inbound/axum_router.rs` (routes only);
`crates/ai_projections` (grep hits only);
`services/authentication_service/src/{service/user/create_user.rs,
api/link/gmail.rs, api/user/get_user_quota.rs, api/user/patch_tutorial.rs,
config.rs}` ; `crates/referral/src/domain/service.rs` (signatures);
`crates/onboarding/src/outbound/pg_onboarding_repo.rs` (ensure_row);
frontend `components/app/{Layout.tsx, app-sidebar/sidebar.tsx,
split-layout/componentRegistry.tsx}`, `routes/Root.tsx`,
`lib/core/context/user.ts`, showPaywall call-site grep across the app,
`features/setup/flow/TeamStep.tsx` (structure grep),
`services/bots/stripe-payment-bot/README.md` (head).

**Grepped only (existence/absence checks):** `write:proai` runtime usages
(none outside roles crate + migrations at the pin — enforcement runs on
`read:professional_features`), `PaywallTeamOwnerView`/`PlanGrid`/
`SubscriptionTier` imports (unused except one internal import),
`getPendingTeam` callers (none), `.reconcile(` callers, `license_status`
producers, quota enforcement sites.

**Skipped:** the interactive tutorial's lesson/sandbox internals
(`features/onboarding/lessons/`, `sandbox/`, `InteractiveOnboarding.tsx`
bodies), mobile onboarding surfaces beyond routing, generated SDK clients
(`packages/sdk/generated/*`), OpenAPI spec JSON (source-of-truth handlers read
instead), `teams` crate test/fixture files, seed/xtask tooling Stripe
references, infra Pulumi stacks, `stripe-payment-bot` worker source beyond its
README, GraphQL SDL (no billing/onboarding surface found via grep), and the
`crates/macro_db_client/src` query bodies except `user_quota` location. No
Linear or planning docs were used as evidence — code only.
