# Neuwave Backend API Endpoint Inventory

- **Source**: Neuwave monorepo, `main` @ `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf`
- **Generated**: 2026-08-19
- All file paths are **relative to the Neuwave clone root**. Pointers are `path:line` of the axum route registration (or spec entry where noted).
- OpenAPI specs (source of truth for public surface, generated into the SDK): `packages/sdk/specs/*.json` (mirrored per-service at `apps/web/src/lib/service-clients/service-*/openapi.json`).
- Convention: every Rust service also mounts its whole router under a version prefix (`.nest("/{version}", ...)`), so `/foo` is also reachable as `/v1/foo`, `/v2/foo`, etc. DSS additionally mounts everything under `/dss` (`services/document_storage_service/src/api/mod.rs:283-291`). Spec paths with `/v1/` or `/v2/` prefixes are the same routes through that nest.
- Known spec-vs-router drift is flagged inline (utoipa `path=` attributes occasionally differ from the actual mount).

---

## 1. authentication_service

Router entrypoint: `services/authentication_service/src/api/mod.rs:85-118`. Spec: `packages/sdk/specs/auth.json` (64 ops; router has ~79 incl. internal/webhooks/native-app not in spec).

### Core auth & session

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /health | Health check | services/authentication_service/src/api/health.rs:17 |
| POST | /login/passwordless | Initiate passwordless login | services/authentication_service/src/api/login/mod.rs:20 |
| POST | /login/password | Password login | services/authentication_service/src/api/login/mod.rs:29 |
| POST | /login/apple | Apple login | services/authentication_service/src/api/login/mod.rs:33 |
| GET | /login/sso | Initiate SSO login | services/authentication_service/src/api/login/mod.rs:37 |
| POST | /logout | Log out (also registered as GET) | services/authentication_service/src/api/logout.rs:19-20 |
| GET | /oauth/passwordless/{code} | Passwordless OAuth callback | services/authentication_service/src/api/oauth/mod.rs:15 |
| GET | /oauth/redirect | OAuth redirect handler | services/authentication_service/src/api/oauth/mod.rs:26 |
| GET | /oauth2/{provider}/callback | Custom OAuth2 callback | services/authentication_service/src/api/oauth2/mod.rs:10 |
| POST | /jwt/refresh | Refresh a JWT | services/authentication_service/src/api/jwt/mod.rs:18 |
| GET | /jwt/macro_api_token | Mint macro-api-token from access token | services/authentication_service/src/api/jwt/mod.rs:28 |
| POST | /session | Create session | services/authentication_service/src/api/session/mod.rs:24 |
| GET | /session/login/{session_code} | Login via session code | services/authentication_service/src/api/session/mod.rs:19 |
| GET | /permissions | List all permissions | services/authentication_service/src/api/permissions/mod.rs:10 |
| GET | /permissions/me | Calling user's permissions | services/authentication_service/src/api/permissions/mod.rs:11 |
| POST | /merge | Create account-merge request | services/authentication_service/src/api/merge/mod.rs:14 |
| GET | /merge/verify/{code} | Verify merge request | services/authentication_service/src/api/merge/mod.rs:15 |
| POST | /mobile-welcome-email | Enroll mobile lead in Loops nurture | services/authentication_service/src/api/mobile_welcome_email/mod.rs:58 |

### Email verification (nested at /email)

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /email/verify/fusionauth/{verification_id} | Verify FusionAuth primary email (spec drift: spec says `/email/fusionauth/verify/{id}`) | services/authentication_service/src/api/email/mod.rs:15 |
| POST | /email/resend/fusionauth | Resend FusionAuth verification (spec drift: `/email/fusionauth_resend`) | services/authentication_service/src/api/email/mod.rs:19 |
| GET | /email/verify/{verification_id} | Verify profile email link | services/authentication_service/src/api/email/mod.rs:23 |
| POST | /email/generate/link | Generate email verification link | services/authentication_service/src/api/email/mod.rs:28 |

### Links (IdP/GitHub/Gmail)

| Method | Path | Purpose | Source |
|---|---|---|---|
| POST | /link | Initiate in-progress link | services/authentication_service/src/api/link/mod.rs:13 |
| POST | /link/github | Init GitHub link | services/authentication_service/src/api/link/mod.rs:14 |
| DELETE | /link/github | Delete GitHub link | services/authentication_service/src/api/link/mod.rs:15 |
| GET | /link/github/status | Check GitHub link validity | services/authentication_service/src/api/link/mod.rs:16 |
| POST | /link/gmail | Init Gmail link | services/authentication_service/src/api/link/mod.rs:20 |
| GET | /link/gmail/status | Check Gmail link validity | services/authentication_service/src/api/link/mod.rs:21 |
| POST | /github_pull_requests/enrich | Enrich GitHub PR refs with live data | services/authentication_service/src/api/github_pull_requests.rs:50 |

### User

| Method | Path | Purpose | Source |
|---|---|---|---|
| POST | /user | Create user | services/authentication_service/src/api/user/mod.rs:31 |
| GET | /user/me | Get calling user's info | services/authentication_service/src/api/user/mod.rs:37 |
| DELETE | /user/me | Delete calling user | services/authentication_service/src/api/user/mod.rs:38 |
| POST | /user/profile_pictures | Bulk profile picture URLs | services/authentication_service/src/api/user/mod.rs:39 |
| PUT | /user/profile_picture | Set profile picture URL | services/authentication_service/src/api/user/mod.rs:40 |
| PUT | /user/name | Set a user's name | services/authentication_service/src/api/user/mod.rs:41 |
| GET | /user/name | Get a user's name | services/authentication_service/src/api/user/mod.rs:42 |
| POST | /user/get_names | Bulk user names | services/authentication_service/src/api/user/mod.rs:43 |
| POST | /user/get_names_with_email | Names w/ email-contact fallback | services/authentication_service/src/api/user/mod.rs:44 |
| GET | /user/link_exists | Whether an IdP link exists | services/authentication_service/src/api/user/mod.rs:48 |
| PATCH | /user/tutorial | Update tutorialComplete flag | services/authentication_service/src/api/user/mod.rs:49 |
| PATCH | /user/ai_consent | Update AI consent (not in spec) | services/authentication_service/src/api/user/mod.rs:50 |
| GET | /user/quota | Get user quota | services/authentication_service/src/api/user/mod.rs:51 |
| POST | /user/stripe/checkoutv2 | Create Stripe checkout session | services/authentication_service/src/api/user/mod.rs:52 |
| POST | /user/stripe/portal | Create Stripe billing portal session | services/authentication_service/src/api/user/mod.rs:60 |
| GET | /user/legacy_user_permissions | Legacy user-permissions shape | services/authentication_service/src/api/user/mod.rs:64 |
| GET | /user/organization | User's organization | services/authentication_service/src/api/user/mod.rs:68 |
| PATCH | /user/group | Update user's group | services/authentication_service/src/api/user/mod.rs:69 |
| PATCH | /user/onboarding | Update user's onboarding | services/authentication_service/src/api/user/mod.rs:70 |

### Teams (crate `teams`, nested at /team — `services/authentication_service/src/api/mod.rs:94`)

| Method | Path | Purpose | Source |
|---|---|---|---|
| POST | /team | Create team | crates/teams/src/inbound/axum_router/mod.rs:102 |
| GET | /team/join/{team_invite_id} | Join team via invite | crates/teams/src/inbound/axum_router/mod.rs:103 |
| GET | /team/user | Teams for calling user | crates/teams/src/inbound/axum_router/mod.rs:107 |
| GET | /team/user/invites | Calling user's invitations | crates/teams/src/inbound/axum_router/mod.rs:108 |
| GET | /team | Get team | crates/teams/src/inbound/axum_router/mod.rs:112 |
| PATCH | /team | Update team | crates/teams/src/inbound/axum_router/mod.rs:113 |
| DELETE | /team | Delete team | crates/teams/src/inbound/axum_router/mod.rs:114 |
| PATCH | /team/crm | Enable/disable team CRM (optional backfill) | crates/teams/src/inbound/axum_router/mod.rs:115 |
| POST | /team/auto-join-domain/toggle | Toggle auto domain joining | crates/teams/src/inbound/axum_router/mod.rs:119 |
| POST | /team/non-admin-invites/toggle | Toggle non-admin invites | crates/teams/src/inbound/axum_router/mod.rs:123 |
| GET | /team/invites | All team invites | crates/teams/src/inbound/axum_router/mod.rs:127 |
| POST | /team/invite | Invite user to team | crates/teams/src/inbound/axum_router/mod.rs:128 |
| DELETE | /team/join/{team_invite_id} | Reject invitation | crates/teams/src/inbound/axum_router/mod.rs:129 |
| DELETE | /team/remove/{remove_user_id} | Remove user from team | crates/teams/src/inbound/axum_router/mod.rs:133 |
| DELETE | /team/invite/{team_invite_id} | Delete team invite | crates/teams/src/inbound/axum_router/mod.rs:137 |

### Referral (crate `referral`, nested at /referral — `services/authentication_service/src/api/mod.rs:104`)

| Method | Path | Purpose | Source |
|---|---|---|---|
| POST | /referral/send | Send referral code | crates/referral/src/inbound/axum_router.rs:135 |
| GET | /referral/code | Get referral code | crates/referral/src/inbound/axum_router.rs:154 |

### Native app updates (crate `native_app_service`, merged at root)

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /update/desktop/{desktop_target}/{arch}/{current_version} | Desktop auto-update feed | crates/native_app_service/src/inbound.rs:34 |
| GET | /update/bundle/{all_target}/{arch} | App bundle update | crates/native_app_service/src/inbound.rs:38 |
| GET | /.well-known/apple-app-site-association | iOS app association | crates/native_app_service/src/inbound.rs:42 |

### Internal (service-key auth, nested at /internal)

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /internal/google_access_token | Fetch Google access token for a user | services/authentication_service/src/api/internal/mod.rs:19 |
| POST | /internal/get_names | Bulk names (internal) | services/authentication_service/src/api/internal/mod.rs:20 |
| GET | /internal/get_existing_users | Filter to existing users | services/authentication_service/src/api/internal/mod.rs:21 |
| DELETE | /internal/remove_link | Remove an IdP link | services/authentication_service/src/api/internal/mod.rs:22 |
| POST | /internal/relocate_inbox_grant | Move inbox grant between users | services/authentication_service/src/api/internal/mod.rs:23 |
| DELETE | /internal/delete_inbox_grant_user | Delete inbox grant user | services/authentication_service/src/api/internal/mod.rs:24 |

### Webhooks (FusionAuth/Stripe, nested at /webhooks/user)

| Method | Path | Purpose | Source |
|---|---|---|---|
| POST | /webhooks/user | User-created webhook | services/authentication_service/src/api/webhooks/user/mod.rs:12 |
| POST | /webhooks/user/delete | User-deleted webhook | services/authentication_service/src/api/webhooks/user/mod.rs:13 |
| POST | /webhooks/user/jwt | JWT populate webhook | services/authentication_service/src/api/webhooks/user/mod.rs:14 |
| POST | /webhooks/user/name | Name-update webhook | services/authentication_service/src/api/webhooks/user/mod.rs:15 |
| POST | /webhooks/user/stripe | Stripe webhook | services/authentication_service/src/api/webhooks/user/mod.rs:16 |

---

## 2. document_storage_service (DSS)

Router entrypoint: `services/document_storage_service/src/api/mod.rs:96-291` (also mounted under `/{version}` and `/dss`). Spec: `packages/sdk/specs/storage.json` (167 public ops; router has ~200 incl. internal). Organized below by mounted domain crate / module.

### documents — service module + `documents` hex crate (nested at /documents, `api/mod.rs:123`)

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /documents | User's recent documents | services/document_storage_service/src/api/documents/mod.rs:49 |
| GET | /documents/starter_docs | Resolve starter documents | services/document_storage_service/src/api/documents/mod.rs:50 |
| POST | /documents/initialize_user_documents | Initialize user's documents | services/document_storage_service/src/api/documents/mod.rs:53 |
| GET | /documents/list | List all user documents (for search) | services/document_storage_service/src/api/documents/mod.rs:62 |
| GET | /documents/{document_id}/permissions | Document permissions (v1; spec also lists /v2 variant via version nest) | services/document_storage_service/src/api/documents/mod.rs:63 |
| GET | /documents/{document_id}/location | Presigned URL(s) for document | services/document_storage_service/src/api/documents/mod.rs:68 |
| GET | /documents/{document_id}/text | Extracted document text (not in spec) | services/document_storage_service/src/api/documents/mod.rs:73 |
| GET | /documents/{document_id}/{document_version_id}/key | Document version key (not in spec) | services/document_storage_service/src/api/documents/mod.rs:77 |
| GET | /documents/{document_id}/views | Users who viewed the document | services/document_storage_service/src/api/documents/mod.rs:84 |
| GET | /documents/{document_id}/export | Presigned raw-content download | services/document_storage_service/src/api/documents/mod.rs:89 |
| GET | /documents/{document_id}/{document_version_id} | Get specific version | services/document_storage_service/src/api/documents/mod.rs:93 |
| PUT | /documents/{document_id} | Save new document version | services/document_storage_service/src/api/documents/mod.rs:98 |
| PUT | /documents/presave/{document_id} | Presigned upload URLs for DOCX BOM parts | services/document_storage_service/src/api/documents/mod.rs:103 |
| PUT | /documents/{document_id}/simple_save | Save non-PDF/DOCX file | services/document_storage_service/src/api/documents/mod.rs:109 |
| DELETE | /documents/{document_id}/permanent | Permanently delete document | services/document_storage_service/src/api/documents/mod.rs:114 |
| PUT | /documents/{document_id}/revert_delete | Restore soft-deleted document | services/document_storage_service/src/api/documents/mod.rs:119 |
| GET | /documents/{document_id}/processing | PDF processing result | services/document_storage_service/src/api/documents/mod.rs:123 |
| GET | /documents/{document_id}/processing/{job_id} | Processing result by job | services/document_storage_service/src/api/documents/mod.rs:129 |
| POST | /documents/preview | Batch document previews | services/document_storage_service/src/api/documents/mod.rs:133 |
| POST | /documents/permissions_token/validate | Validate permissions token | services/document_storage_service/src/api/documents/permissions_token/mod.rs:10 |
| POST | /documents/permissions_token/{document_id} | Mint permissions token | services/document_storage_service/src/api/documents/permissions_token/mod.rs:11 |
| GET/PATCH/DELETE | /documents/{document_id} | Get / edit / soft-delete document | crates/documents/src/inbound/axum_router.rs:226 |
| GET | /documents/{document_id}/location_v3 | Location v3 | crates/documents/src/inbound/axum_router.rs:232 |
| GET | /documents/{document_id}/branch_name | GitHub-sync branch name | crates/documents/src/inbound/axum_router.rs:236 |
| GET | /documents/{document_id}/github_prs | Linked GitHub PRs | crates/documents/src/inbound/axum_router.rs:240 |
| GET | /documents/{document_id}/short_id | Short id | crates/documents/src/inbound/axum_router.rs:244 |
| POST | /documents/{document_id}/copy | Copy document | crates/documents/src/inbound/axum_router.rs:248 |
| GET | /documents/{document_id}/duplicates | Task duplicate matches (not in spec) | crates/documents/src/inbound/axum_router.rs:252 |
| POST | /documents/{document_id}/duplicates/dismiss | Dismiss duplicate matches (not in spec) | crates/documents/src/inbound/axum_router.rs:256 |
| POST | /documents/{document_id}/duplicates/{match_id}/delete_this | Delete duplicate task (not in spec) | crates/documents/src/inbound/axum_router.rs:260 |
| GET | /documents/{document_id}/cached_snapshot_url | Cached snapshot URL (not in spec) | crates/documents/src/inbound/axum_router.rs:264 |
| PUT | /documents/{document_id}/snapshot | Put snapshot (not in spec) | crates/documents/src/inbound/axum_router.rs:268 |
| GET/PUT | /documents/{document_id}/team_share | Get / set team-share state | crates/documents/src/inbound/axum_router.rs:272 |
| GET | /documents/slug/{slug} | Get document by team slug | crates/documents/src/inbound/axum_router.rs:285 |
| POST | /documents | Create document | crates/documents/src/inbound/axum_router.rs:289 |
| POST | /documents/create_task | Create task doc (props + markdown) | crates/documents/src/inbound/axum_router.rs:293 |
| POST | /documents/similarity_search | Task similarity search (not in spec) | crates/documents/src/inbound/axum_router.rs:297 |
| GET | /documents/system_skills | List built-in system skills | crates/documents/src/inbound/axum_router.rs:301 |
| POST | /documents/create_markdown | Create markdown doc | crates/documents/src/inbound/axum_router.rs:308 |
| POST | /documents/create_snippet | Create snippet doc | crates/documents/src/inbound/axum_router.rs:312 |
| POST | /documents/create_skill | Create skill doc | crates/documents/src/inbound/axum_router.rs:316 |

### projects — `projects` hex crate (nested at /projects, `api/mod.rs:161`)

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET/POST | /projects | List visible / create project | crates/projects/src/inbound/axum_router.rs:153 |
| GET | /projects/pending | Pending root projects | crates/projects/src/inbound/axum_router.rs:158 |
| POST | /projects/preview | Batch project previews | crates/projects/src/inbound/axum_router.rs:162 |
| POST | /projects/upload | Upload folder tree | crates/projects/src/inbound/axum_router.rs:166 |
| POST | /projects/upload_extract | Extract uploaded folder archive | crates/projects/src/inbound/axum_router.rs:170 |
| GET/PATCH/DELETE | /projects/{id} | Get / edit (spec lists as PATCH /v2/projects/{id}) / soft-delete | crates/projects/src/inbound/axum_router.rs:120 |
| GET | /projects/{id}/content | Immediate children | crates/projects/src/inbound/axum_router.rs:126 |
| GET | /projects/{id}/permissions | Share permissions | crates/projects/src/inbound/axum_router.rs:130 |
| GET | /projects/{id}/access_level | Caller's access level | crates/projects/src/inbound/axum_router.rs:134 |
| PUT | /projects/{id}/revert_delete | Restore project tree | crates/projects/src/inbound/axum_router.rs:138 |
| DELETE | /projects/{id}/permanent | Permanently delete tree | crates/projects/src/inbound/axum_router.rs:142 |

### channels — `channels` crate (nested at /channels, `api/mod.rs:214`; list router at /comms, `api/mod.rs:206`)

| Method | Path | Purpose | Source |
|---|---|---|---|
| POST | /channels | Create channel | crates/channels/src/inbound/axum_router.rs:269 |
| POST | /channels/get_or_create_dm | Get-or-create DM | crates/channels/src/inbound/axum_router.rs:270 |
| POST | /channels/get_or_create_private | Get-or-create private channel | crates/channels/src/inbound/axum_router.rs:274 |
| POST | /channels/mentions | Create entity mention | crates/channels/src/inbound/axum_router.rs:278 |
| DELETE | /channels/mentions/{mention_id} | Delete entity mention | crates/channels/src/inbound/axum_router.rs:279 |
| PATCH | /channels/{channel_id} | Patch channel | crates/channels/src/inbound/axum_router.rs:283 |
| DELETE | /channels/{channel_id} | Delete channel | crates/channels/src/inbound/axum_router.rs:287 |
| POST | /channels/{channel_id}/message | Post message | crates/channels/src/inbound/axum_router.rs:291 |
| POST | /channels/{channel_id}/typing | Typing indicator | crates/channels/src/inbound/axum_router.rs:295 |
| POST | /channels/{channel_id}/reaction | Post reaction | crates/channels/src/inbound/axum_router.rs:299 |
| PATCH | /channels/{channel_id}/message/{message_id} | Patch message | crates/channels/src/inbound/axum_router.rs:303 |
| DELETE | /channels/{channel_id}/message/{message_id} | Delete message | crates/channels/src/inbound/axum_router.rs:307 |
| POST | /channels/{channel_id}/join | Join channel | crates/channels/src/inbound/axum_router.rs:311 |
| POST | /channels/join/{join_code} | Join by code | crates/channels/src/inbound/axum_router.rs:315 |
| POST | /channels/{channel_id}/leave | Leave channel | crates/channels/src/inbound/axum_router.rs:319 |
| POST | /channels/{channel_id}/participants | Add participants | crates/channels/src/inbound/axum_router.rs:323 |
| DELETE | /channels/{channel_id}/participants | Remove participants | crates/channels/src/inbound/axum_router.rs:327 |
| GET | /channels/{channel_id} | Get channel | crates/channels/src/inbound/axum_router.rs:342 |
| GET | /channels/{channel_id}/join-link | Join link | crates/channels/src/inbound/axum_router.rs:343 |
| GET/POST | /channels/{channel_id}/messages | Page messages / batch post | crates/channels/src/inbound/axum_router.rs:347 |
| GET | /channels/{channel_id}/messages/{message_id}/replies | Thread replies | crates/channels/src/inbound/axum_router.rs:352 |
| GET | /channels/{channel_id}/messages/{message_id}/context | Message with context | crates/channels/src/inbound/axum_router.rs:356 |
| GET | /channels/{channel_id}/messages/{message_id}/resolve | Resolve message ref | crates/channels/src/inbound/axum_router.rs:360 |
| GET | /channels/{channel_id}/attachments | Channel attachments | crates/channels/src/inbound/axum_router.rs:364 |
| GET | /channels/{channel_id}/participants | List participants | crates/channels/src/inbound/axum_router.rs:368 |
| POST | /channels/preview | Batch channel previews | crates/channels/src/inbound/axum_router.rs:372 |
| GET | /channels/attachments/{entity_type}/{entity_id}/references | Attachment references | crates/channels/src/inbound/axum_router.rs:376 |
| GET/POST | /channels/activity | Get / post channel activity | crates/channels/src/inbound/axum_router.rs:380 |
| GET | /comms/channels | Channel list | crates/channels/src/inbound/list_router.rs:79 |
| GET | /comms/activity | Channel list activity (not in spec) | crates/channels/src/inbound/list_router.rs:80 |

### bots — `bots` crate (merged at root, `api/mod.rs:214-226`; webhook routers `api/mod.rs:248`)

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /bots | List bots (not in spec) | crates/bots/src/inbound/axum_router.rs:130 |
| POST | /bots | Create bot (not in spec) | crates/bots/src/inbound/axum_router.rs:131 |
| GET | /bots/me | Get self bot (bot-token auth) | crates/bots/src/inbound/axum_router.rs:132 |
| GET | /bots/{bot_id} | Get bot | crates/bots/src/inbound/axum_router.rs:133 |
| PATCH | /bots/{bot_id} | Patch bot | crates/bots/src/inbound/axum_router.rs:134 |
| DELETE | /bots/{bot_id} | Delete bot | crates/bots/src/inbound/axum_router.rs:135 |
| GET | /bots/{bot_id}/channels | Bot's channels | crates/bots/src/inbound/axum_router.rs:136 |
| DELETE | /bots/{bot_id}/channels/{channel_id} | Remove bot from channel | crates/bots/src/inbound/axum_router.rs:140 |
| GET/POST | /bots/{bot_id}/tokens | List / create bot tokens | crates/bots/src/inbound/axum_router.rs:144-148 |
| DELETE | /bots/{bot_id}/tokens/{token_id} | Revoke token | crates/bots/src/inbound/axum_router.rs:152 |
| GET/POST | /channels/{channel_id}/bots | List / add channel bots | crates/bots/src/inbound/axum_router.rs:156-160 |
| DELETE | /channels/{channel_id}/bots/{bot_id} | Remove channel bot | crates/bots/src/inbound/axum_router.rs:164 |
| POST | /channels/{channel_id}/bots/scoped | Create channel-scoped bot | crates/bots/src/inbound/channel_webhook_router.rs:188 |
| POST | /channels/{channel_id}/webhook | Channel bot webhook (unauthenticated poster) | crates/bots/src/inbound/channel_webhook_router.rs:207 |

### call — `call` crate (nested at /call, `api/mod.rs:240`; webhook/internal routers `api/mod.rs:101,111`)

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET/DELETE | /call/{channel_id} | Get-or-create / leave-or-end call | crates/call/src/inbound/axum_router.rs:111 |
| GET | /call/{channel_id}/active | Check active call | crates/call/src/inbound/axum_router.rs:116 |
| POST | /call/record/preview | Batch call record previews | crates/call/src/inbound/axum_router.rs:120 |
| GET/PATCH/DELETE | /call/record/{call_id} | Get / edit / delete call record | crates/call/src/inbound/axum_router.rs:124 |
| PATCH | /call/record/{call_id}/transcript | Edit transcript | crates/call/src/inbound/axum_router.rs:130 |
| POST | /call/record/{call_id}/share-with-team/toggle | Toggle team share | crates/call/src/inbound/axum_router.rs:134 |
| POST | /call/webhook | LiveKit webhook (own JWT auth) | crates/call/src/inbound/axum_router.rs:178 |
| GET | /call/ring-status/{call_id} | Ring status | crates/call/src/inbound/axum_router.rs:179 |
| POST | /call/{channel_id}/transcript | Ingest transcript (internal x-macro-internal-call auth) | crates/call/src/inbound/axum_router.rs:223 |
| POST | /cal/webhook | cal.com webhook (HMAC) | crates/cal/src/inbound/cal_webhook_router/mod.rs:55 |

### soup / items / GraphQL (nested at /items, `api/mod.rs:141` via `items_router` `api/mod.rs:88-91`)

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /items/soup | Items user can access | crates/soup/src/inbound/axum_router.rs:663 |
| POST | /items/soup | Items (body filters) | crates/soup/src/inbound/axum_router.rs:664 |
| POST | /items/soup/ast | Items via AST filters | crates/soup/src/inbound/axum_router.rs:665 |
| POST | /items/soup/ast/grouped | Grouped items via AST | crates/soup/src/inbound/axum_router.rs:666 |
| GET/POST | /items/soup/graphql | GraphiQL / GraphQL queries+mutations | services/document_storage_service/src/api/graphql_soup.rs:27 |
| GET (WS) | /items/soup/graphql/ws | GraphQL subscriptions over WebSocket | services/document_storage_service/src/api/graphql_soup.rs:28 |

### properties — `properties` crate (nested at /properties, `api/mod.rs:188`; spec `packages/sdk/specs/properties.json`, title "properties_service" — served by DSS via composition shim `crates/properties_service`)

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET/POST | /properties/definitions | List / create property definitions | crates/properties/src/inbound/axum_router.rs:115 |
| GET/DELETE | /properties/definitions/{definition_id} | Get / delete definition | crates/properties/src/inbound/axum_router.rs:120 |
| GET/POST | /properties/definitions/{definition_id}/options | Get / add dropdown options | crates/properties/src/inbound/axum_router.rs:126 |
| DELETE/PATCH | /properties/definitions/{definition_id}/options/{option_id} | Delete / update option | crates/properties/src/inbound/axum_router.rs:131 |
| GET/POST | /properties/tags | List tag sets / ensure tag set | crates/properties/src/inbound/axum_router.rs:136 |
| POST | /properties/tags/promote | Share personal label with team | crates/properties/src/inbound/axum_router.rs:142 |
| POST | /properties/tags/merge | Replace personal label with team label | crates/properties/src/inbound/axum_router.rs:143 |
| GET | /properties/entities/{entity_type}/{entity_id} | All properties for entity (anon OK for public) | crates/properties/src/inbound/axum_router.rs:146 |
| POST | /properties/entities/bulk | Bulk entity properties | crates/properties/src/inbound/axum_router.rs:151 |
| PUT | /properties/entities/{entity_type}/{entity_id}/{property_id} | Set/attach property value | crates/properties/src/inbound/axum_router.rs:156 |
| POST/DELETE | /properties/entities/{entity_type}/{entity_id}/{property_id}/options/{option_id} | Add / remove one multi-select option | crates/properties/src/inbound/axum_router.rs:161 |
| POST | /properties/entities/{entity_type}/{entity_id}/options/bulk | Full tag-picker selection for one entity | crates/properties/src/inbound/axum_router.rs:167 |
| POST | /properties/options/bulk | One option delta across many entities | crates/properties/src/inbound/axum_router.rs:173 |
| DELETE | /properties/entity_properties/{entity_property_id} | Remove entity property by id | crates/properties/src/inbound/axum_router.rs:177 |

### crm — `crm` crate (nested at /crm, `api/mod.rs:248`)

| Method | Path | Purpose | Source |
|---|---|---|---|
| POST | /crm/companies | Create CRM company | crates/crm/src/inbound/axum_router/mod.rs:122 |
| PUT | /crm/companies/{company_id}/email-sync | Toggle email_sync flag | crates/crm/src/inbound/axum_router/mod.rs:123 |
| PUT | /crm/companies/{company_id}/hidden | Toggle hidden | crates/crm/src/inbound/axum_router/mod.rs:127 |
| PUT | /crm/companies/{company_id}/name | Rename company | crates/crm/src/inbound/axum_router/mod.rs:131 |
| GET | /crm/companies/{company_id} | Get hydrated company | crates/crm/src/inbound/axum_router/mod.rs:135 |
| GET/POST | /crm/companies/{company_id}/contacts | List / create contacts | crates/crm/src/inbound/axum_router/mod.rs:139 |
| GET | /crm/contacts/{contact_id} | Get contact | crates/crm/src/inbound/axum_router/mod.rs:144 |
| PUT | /crm/contacts/{contact_id}/hidden | Toggle contact hidden | crates/crm/src/inbound/axum_router/mod.rs:148 |
| PUT | /crm/contacts/{contact_id}/name | Rename contact | crates/crm/src/inbound/axum_router/mod.rs:152 |
| GET/POST | /crm/comments/{entity_type}/{entity_id} | List / create comment threads | crates/crm/src/inbound/axum_router/mod.rs:156 |
| PATCH/DELETE | /crm/comment/{comment_id} | Edit / soft-delete comment | crates/crm/src/inbound/axum_router/mod.rs:161 |
| GET/PUT | /crm/settings | Read / update team CRM settings | crates/crm/src/inbound/axum_router/mod.rs:166 |

### Other domain crates mounted in DSS

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /calendar-events | Calendar occurrences in viewport (merged at root; also with trailing slash) | crates/calendar_events/src/inbound/axum_router.rs:70-71 |
| GET/POST | /favorites | List / add favorites | crates/favorites/src/inbound/axum_router.rs:95-96 |
| DELETE | /favorites/{entity_type}/{entity_id} | Remove favorite by entity | crates/favorites/src/inbound/axum_router.rs:97 |
| PATCH | /favorites/reorder | Persist manual order | crates/favorites/src/inbound/axum_router.rs:101 |
| GET/POST | /reminders | List / create reminders | crates/reminders/src/inbound/axum_router.rs:101-102 |
| GET/PATCH/DELETE | /reminders/{id} | Get / update / delete reminder | crates/reminders/src/inbound/axum_router.rs:103-105 |
| GET | /foreign_entity/{id} | Get visible foreign entity | crates/foreign_entity/src/inbound/axum_router.rs:91 |
| GET/POST | /webhook/webhooks | List / create webhooks | crates/webhook/src/inbound/axum_router.rs:203 |
| GET/PATCH/DELETE | /webhook/webhooks/{webhook_id} | Get / patch / delete webhook | crates/webhook/src/inbound/axum_router.rs:207 |
| POST | /webhook/webhooks/{webhook_id}/validate | Validate webhook endpoint (rate-limited) | crates/webhook/src/inbound/axum_router.rs:189 |
| POST | /search | Unified search (spec `search.json`) | crates/search_service/src/api/search/mod.rs:19 |
| POST | /search/simple | Simple unified search | crates/search_service/src/api/search/simple/mod.rs:21 |
| POST | /search/channel | Channel search (not in spec) | crates/search_service/src/api/search/channel.rs:297 |
| POST | /search/channel/name | Viewer-aware channel name search (AI NameSearch) | crates/search_service/src/api/search/channel.rs:298 |
| POST | /sync_service/wakeup | Bulk wake sync-service documents | crates/sync_service/src/inbound/axum_router.rs:47 |
| GET | /github/install-sync | Redirect to GitHub sync app install | crates/github/src/inbound/github_sync_router/mod.rs:77 |
| GET | /github/sync-redirect | GitHub sync redirect (not in spec) | crates/github/src/inbound/github_sync_router/mod.rs:81 |
| POST | /github/webhook | GitHub webhook events (not in spec) | crates/github/src/inbound/github_sync_router/mod.rs:85 |

### DSS service modules (misc)

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /health | Health check | services/document_storage_service/src/api/health/mod.rs:16 |
| GET | /activity | User's recent activity | services/document_storage_service/src/api/activity/mod.rs:7 |
| GET | /history | User's history | services/document_storage_service/src/api/history/mod.rs:13 |
| POST/DELETE | /history/{item_type}/{item_id} | Upsert / delete history item | services/document_storage_service/src/api/history/mod.rs:14-18 |
| POST/GET | /instructions | Create / get instructions doc | services/document_storage_service/src/api/instructions/mod.rs:13-14 |
| GET/POST | /annotations/comments/document/{document_id} | Get / create comment threads | services/document_storage_service/src/api/annotations/mod.rs:31-40 |
| DELETE/PATCH | /annotations/comments/comment/{comment_id} | Delete / edit comment | services/document_storage_service/src/api/annotations/mod.rs:49-55 |
| DELETE/PATCH | /annotations/anchors | Delete / edit anchor | services/document_storage_service/src/api/annotations/mod.rs:53-54 |
| GET/POST | /annotations/anchors/document/{document_id} | Get / create anchors | services/document_storage_service/src/api/annotations/mod.rs:59-68 |
| GET | /pins | User's pins | services/document_storage_service/src/api/pins/mod.rs:15 |
| POST/DELETE | /pins/{pinned_item_id} | Add / remove pin | services/document_storage_service/src/api/pins/mod.rs:16-17 |
| PATCH | /pins | Reorder pins | services/document_storage_service/src/api/pins/mod.rs:18 |
| GET | /recents/deleted | Recently deleted items | services/document_storage_service/src/api/recents/mod.rs:6 |
| GET/POST | /saved_views | Get / create saved views | services/document_storage_service/src/api/saved_views.rs:26-27 |
| DELETE/PATCH | /saved_views/{saved_view_id} | Delete / patch saved view | services/document_storage_service/src/api/saved_views.rs:28-29 |
| POST | /saved_views/exclude_default | Exclude a default view | services/document_storage_service/src/api/saved_views.rs:30 |
| PATCH | /threads/{thread_id} | Edit thread share permissions | services/document_storage_service/src/api/threads/mod.rs:9 |
| GET/POST/DELETE | /user_document_view_location/{document_id} | Get / upsert / delete per-user view location | services/document_storage_service/src/api/user_document_view_location/mod.rs:13-21 |
| GET | /entity/{entity_type}/{entity_id}/permissions | Caller's permission for an entity | services/document_storage_service/src/api/entity/mod.rs:7 |

### DSS internal (service-key auth, nested at /internal — `api/mod.rs:257`)

| Method | Path | Purpose | Source |
|---|---|---|---|
| DELETE | /internal/users/{user_id} | Delete all of a user's items | services/document_storage_service/src/api/internal/mod.rs:39 |
| GET | /internal/documents/{document_id} | Get document (internal) | services/document_storage_service/src/api/internal/mod.rs:44 |
| GET | /internal/documents/{document_id}/basic | Basic document record | services/document_storage_service/src/api/internal/mod.rs:54 |
| POST | /internal/documents/{document_id}/content-uploaded | Mark content uploaded | services/document_storage_service/src/api/internal/mod.rs:59 |
| GET | /internal/documents/{document_id}/export | Export (internal) | services/document_storage_service/src/api/internal/mod.rs:69 |
| GET | /internal/documents/{document_id}/text | Document text | services/document_storage_service/src/api/internal/mod.rs:73 |
| GET | /internal/documents/{document_id}/full_pdf_modification_data | Full PDF modification data | services/document_storage_service/src/api/internal/mod.rs:77 |
| GET | /internal/documents/{document_id}/location | Location (internal) | services/document_storage_service/src/api/internal/mod.rs:81 |
| GET | /internal/documents/{document_id}/location_v3 | Location v3 (internal) | services/document_storage_service/src/api/internal/mod.rs:85 |
| GET | /internal/documents/{document_id}/permissions | Permissions (internal) | services/document_storage_service/src/api/internal/mod.rs:95 |
| GET | /internal/documents/{document_id}/access_level | Access level | services/document_storage_service/src/api/internal/mod.rs:99 |
| POST | /internal/documents | Create document (internal) | services/document_storage_service/src/api/internal/mod.rs:103 |
| POST | /internal/documents/initialize_starter_docs | Initialize starter docs | services/document_storage_service/src/api/internal/mod.rs:113 |
| GET | /internal/documents/list_with_access | List documents with access | services/document_storage_service/src/api/internal/mod.rs:117 |
| PUT | /internal/documents/{document_id} | Save (internal) | services/document_storage_service/src/api/internal/mod.rs:121 |
| GET | /internal/documents/{document_id}/{document_version_id} | Get version (internal) | services/document_storage_service/src/api/internal/mod.rs:125 |
| GET | /internal/documents/{document_id}/{document_version_id}/key | Version key | services/document_storage_service/src/api/internal/mod.rs:129 |
| PUT | /internal/documents/{document_id}/snapshot | Put snapshot | services/document_storage_service/src/api/internal/mod.rs:133 |
| PUT | /internal/documents/{document_id}/interaction | Record interaction | services/document_storage_service/src/api/internal/mod.rs:143 |
| POST | /internal/documents/metadata | Bulk document metadata | services/document_storage_service/src/api/internal/mod.rs:153 |
| POST/DELETE | /internal/history/{item_type}/{item_id} | Upsert / delete history (internal) | services/document_storage_service/src/api/internal/mod.rs:155-159 |
| GET | /internal/threads/{thread_id}/access_level | Thread access level | services/document_storage_service/src/api/internal/mod.rs:163 |
| POST | /internal/users/populate_items | Populate user's items | services/document_storage_service/src/api/internal/mod.rs:170 |
| POST | /internal/projects/upload | Upload folder (internal) | services/document_storage_service/src/api/internal/mod.rs:175 |
| POST | /internal/projects/mark_uploaded | Mark folder uploaded | services/document_storage_service/src/api/internal/mod.rs:185 |
| GET | /internal/item_ids | Get item ids | services/document_storage_service/src/api/internal/mod.rs:195 |
| POST | /internal/validate_item_ids | Validate item ids | services/document_storage_service/src/api/internal/mod.rs:196 |
| GET | /internal/health | Internal health | services/document_storage_service/src/api/internal/mod.rs:197 |
| GET | /internal/notifications/document/{document_id} | Users to notify for a document | services/document_storage_service/src/api/notification/mod.rs:12 |
| GET | /internal/notifications/project/{project_id} | Users to notify for a project | services/document_storage_service/src/api/notification/mod.rs:16 |
| POST | /internal/search[, /simple, /channel, /channel/name] | Search routers re-mounted for internal callers | services/document_storage_service/src/api/mod.rs:261 |
| POST | /internal/sync_service/wakeup | Sync-service wakeup (internal) | services/document_storage_service/src/api/mod.rs:266 |
| POST | /internal/call/{channel_id}/transcript | Internal call router mount | services/document_storage_service/src/api/mod.rs:111 |

---

## 3. document_cognition_service (DCS)

Router entrypoint: `services/document_cognition_service/src/api/mod.rs:73-135` (whole router mounted at `/` and `/{version}`). Spec: `packages/sdk/specs/cognition.json` (38 ops; router has ~44).

### chat — `chat` crate + DCS chats module (nested at /chats, `api/mod.rs:84`; assembled in `services/document_cognition_service/src/api/chats/mod.rs:40-96`)

| Method | Path | Purpose | Source |
|---|---|---|---|
| POST | /chats | Create chat | crates/chat/src/inbound/http/router.rs:106 |
| GET | /chats/{chat_id} | Get chat w/ messages + citations (anon OK w/ public link share) | crates/chat/src/inbound/http/router.rs:128 |
| DELETE/PATCH | /chats/{chat_id} | Soft-delete / patch chat (spec drift: spec says `/chat/{chat_id}`) | crates/chat/src/inbound/http/router.rs:146 |
| DELETE | /chats/{chat_id}/permanent | Permanently delete chat (spec drift: `/chat/...`) | crates/chat/src/inbound/http/router.rs:151 |
| POST | /chats/{chat_id}/copy | Copy chat | crates/chat/src/inbound/http/router.rs:155 |
| PUT | /chats/{chat_id}/revert_delete | Revert soft delete | crates/chat/src/inbound/http/router.rs:159 |
| GET | /chats/{chat_id}/permissions | Chat share permissions | crates/chat/src/inbound/http/router.rs:163 |
| POST | /chats/{chat_id}/tool/update | Update pending tool-call args | crates/chat/src/inbound/http/router.rs:167 |
| POST | /chats/{chat_id}/tool/response/update | Update tool response | crates/chat/src/inbound/http/router.rs:171 |
| POST | /chats/{chat_id}/tool/call | Execute pending tool call | crates/chat/src/inbound/http/router.rs:175 |
| POST | /chats/{chat_id}/tool/reject | Reject pending tool call | crates/chat/src/inbound/http/router.rs:179 |
| GET | /chats/history/{chat_id} | Chat history | services/document_cognition_service/src/api/chats/mod.rs:88 |
| POST | /chats/history_batch_messages | History for multiple message ids | services/document_cognition_service/src/api/chats/mod.rs:96 |

### agent / AI streaming & completion

| Method | Path | Purpose | Source |
|---|---|---|---|
| POST | /stream/chat/message | Send chat message, stream AI response (SSE) | services/document_cognition_service/src/api/stream/mod.rs:17 |
| POST | /stream/chat/message/stop | Stop in-flight AI stream | services/document_cognition_service/src/api/stream/mod.rs:18 |
| POST | /structured-completion | Structured completion | services/document_cognition_service/src/api/mod.rs:86 |
| POST | /chat/completions | OpenAI-style completions passthrough (not in spec) | services/document_cognition_service/src/api/mod.rs:90 |

### ai_tools support modules

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /attachments/{attachment_id}/chats | Chats referencing an attachment | services/document_cognition_service/src/api/attachments/mod.rs:8 |
| GET | /citations/{id} | Get citation | services/document_cognition_service/src/api/citations/mod.rs:17 |
| POST | /preview | Batch chat previews | services/document_cognition_service/src/api/preview/mod.rs:6 |
| POST/GET | /id_mapping/{source_id} | Create / get id mapping (not in spec) | services/document_cognition_service/src/api/id_mapping/mod.rs:18-19 |

### memory crate (merged at root)

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /memory | User's latest memory | crates/memory/src/inbound/axum_router.rs:67 |

### import crate (merged at root)

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /import/state | Import state (gather runs + staged rows) | crates/import/src/inbound/axum_router.rs:73 |
| POST | /import/run | Accept/discard staged imports | crates/import/src/inbound/axum_router.rs:74 |
| POST | /import/runs/{source}/retry | Retry failed gather run | crates/import/src/inbound/axum_router.rs:75 |
| POST | /import/runs/{source}/dismiss | Dismiss source's import section | crates/import/src/inbound/axum_router.rs:79 |

### onboarding crate (merged at root)

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /onboarding | Onboarding state | crates/onboarding/src/inbound/axum_router.rs:68 |
| POST | /onboarding/complete | Complete/skip onboarding | crates/onboarding/src/inbound/axum_router.rs:69 |

### ai_usage / ai_projections crates (merged at root)

| Method | Path | Purpose | Source |
|---|---|---|---|
| POST | /ai-cost/usage | Query recorded AI usage (admin) | crates/ai_usage/src/inbound/axum_router.rs:98 |
| POST | /ai-cost/pricing | Set model pricing, recompute rows (admin) | crates/ai_usage/src/inbound/axum_router.rs:99 |
| POST | /ai-projections | Get-or-create AI projection + user instance | crates/ai_projections/src/inbound/axum_router/mod.rs:59 |

### mcp_client crate (merged at root; OAuth callback router outside version nest, `api/mod.rs:129-134`)

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET/POST/PUT/DELETE | /mcp/servers | List / add / update / delete user MCP servers | crates/mcp_client/src/inbound/axum_router.rs:103-106 |
| POST | /mcp/servers/auth/start | Start MCP OAuth flow | crates/mcp_client/src/inbound/axum_router.rs:107 |
| GET | /mcp/servers/auth/callback | MCP OAuth callback (unauthenticated) | crates/mcp_client/src/inbound/axum_router.rs:123 |
| GET | /mcp/servers/auth/client-metadata | OAuth Client ID Metadata Document | crates/mcp_client/src/inbound/axum_router.rs:127 |

### health

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /health | Health check | services/document_cognition_service/src/api/health/mod.rs:16 |

---

## 4. email_service

Router entrypoint: `services/email_service/src/api/mod.rs:52-71` (nests /email, /gmail, /internal, /calendar). Spec: `packages/sdk/specs/email.json` (49 ops; router has ~62 incl. internal + webhooks).

### /email (user email API)

| Method | Path | Purpose | Source |
|---|---|---|---|
| POST | /email/init | Initialize email for user (threads + sync) | services/email_service/src/api/email/mod.rs:36 |
| GET | /email/attachments/{id} | Get attachment | services/email_service/src/api/email/attachments/mod.rs:14 |
| GET | /email/attachments/{id}/document_id | Macro document id for attachment (upload if missing) | services/email_service/src/api/email/attachments/mod.rs:17 |
| DELETE | /email/backfill/gmail | Cancel backfill job | services/email_service/src/api/email/backfill/mod.rs:12 |
| GET | /email/backfill/gmail/{id} | Get backfill job | services/email_service/src/api/email/backfill/mod.rs:13 |
| GET | /email/backfill/gmail/active | Active backfill job | services/email_service/src/api/email/backfill/mod.rs:14 |
| GET | /email/backfill/gmail | List backfill jobs across links | services/email_service/src/api/email/backfill/mod.rs:24 |
| GET | /email/contacts | List contacts grouped by link | services/email_service/src/api/email/contacts/mod.rs:13 |
| POST | /email/contacts/block | Block sender (Gmail filter to trash) | services/email_service/src/api/email/contacts/mod.rs:14 |
| POST | /email/contacts/unblock | Unblock sender | services/email_service/src/api/email/contacts/mod.rs:21 |
| GET | /email/contacts/blocked | List blocked senders | services/email_service/src/api/email/contacts/mod.rs:28 |
| POST | /email/drafts | Create draft | crates/email/src/inbound/axum/draft_router.rs:24 |
| GET | /email/drafts/scheduled | List scheduled drafts | services/email_service/src/api/email/drafts/scheduled/mod.rs:10 |
| DELETE/PUT | /email/drafts/scheduled/{message_id} | Remove / upsert scheduled send | services/email_service/src/api/email/drafts/scheduled/mod.rs:10 |
| DELETE | /email/drafts/{id} | Delete draft | services/email_service/src/api/email/drafts/mod.rs:21 |
| POST | /email/drafts/{id}/attachments | Add attachment | services/email_service/src/api/email/drafts/mod.rs:22 |
| DELETE | /email/drafts/{id}/attachments/{attachment_id} | Remove attachment | services/email_service/src/api/email/drafts/mod.rs:23 |
| POST | /email/drafts/{id}/forwarded-attachments | Add forwarded attachment | services/email_service/src/api/email/drafts/mod.rs:27 |
| DELETE | /email/drafts/{id}/forwarded-attachments/{attachment_id} | Remove forwarded attachment | services/email_service/src/api/email/drafts/mod.rs:31 |
| PUT/GET | /email/filters | Upsert / list email filters | crates/email/src/inbound/axum/email_filter_router.rs:129-130 |
| DELETE | /email/filters/{id} | Delete email filter | crates/email/src/inbound/axum/email_filter_router.rs:131 |
| GET | /email/labels | List labels | crates/email/src/inbound/axum/list_labels_router.rs:56 |
| POST | /email/labels | Create label | services/email_service/src/api/email/labels/mod.rs:17 |
| DELETE | /email/labels/{id} | Delete label | services/email_service/src/api/email/labels/mod.rs:24 |
| GET | /email/links | List links | services/email_service/src/api/email/links/mod.rs:13 |
| POST | /email/links/health-check | Probe live auth state of inboxes | services/email_service/src/api/email/links/mod.rs:14 |
| DELETE | /email/links/{link_id} | Remove linked inbox | services/email_service/src/api/email/links/mod.rs:15 |
| POST | /email/links/{link_id}/resync | Re-sync inbox (fresh backfill) | services/email_service/src/api/email/links/mod.rs:16 |
| POST | /email/messages | Send message | crates/email/src/inbound/axum/send_router.rs:24 |
| PATCH | /email/messages/labels | Add/remove label on message batch | services/email_service/src/api/email/messages/mod.rs:22 |
| POST | /email/messages/batch | Batch get messages | services/email_service/src/api/email/messages/mod.rs:23 |
| GET | /email/messages/{id} | Get message | services/email_service/src/api/email/messages/mod.rs:24 |
| PATCH | /email/settings | Patch user settings | services/email_service/src/api/email/settings/mod.rs:10 |
| DELETE | /email/sync | Disable inbox syncing | services/email_service/src/api/email/sync/mod.rs:10 |
| GET | /email/threads/previews/cursor/{view} | Cursor-paginated thread previews | crates/email/src/inbound/axum/previews_router.rs:64 |
| GET | /email/threads/{id}/messages | Thread messages | services/email_service/src/api/email/threads/mod.rs:23 |
| POST | /email/threads/{id}/seen | Mark thread seen | services/email_service/src/api/email/threads/mod.rs:24 |
| PATCH | /email/threads/{id}/archived | Archive/unarchive thread | services/email_service/src/api/email/threads/mod.rs:25 |
| PATCH | /email/threads/{id}/labels | Add/remove label on whole thread | crates/email/src/inbound/axum/thread_labels_router.rs:91 |
| GET | /email/threads/{thread_id} | Thread with paginated messages | crates/email/src/inbound/axum/get_thread_router.rs:62 |
| PATCH | /email/threads/{thread_id}/project | Update thread's project assignment | crates/email/src/inbound/axum/thread_project_router.rs:91 |

### /calendar (calendar mutations gated by calendar_sync kill switch — `api/mod.rs:53-66`)

| Method | Path | Purpose | Source |
|---|---|---|---|
| POST | /calendar/notifications | Google Calendar push notification webhook | services/email_service/src/api/calendar_watch.rs:19 |
| GET | /calendar/calendars | List requester's visible calendars | crates/calendar_events/src/inbound/mutation_router.rs:77 |
| POST | /calendar/events | Create calendar event | crates/calendar_events/src/inbound/mutation_router.rs:78 |
| PATCH/DELETE | /calendar/events/{event_id} | Update / delete event | crates/calendar_events/src/inbound/mutation_router.rs:79 |
| PUT | /calendar/events/{event_id}/rsvp | Set RSVP | crates/calendar_events/src/inbound/mutation_router.rs:83 |

### /gmail + /internal + health

| Method | Path | Purpose | Source |
|---|---|---|---|
| POST | /gmail/webhook | Gmail push webhook | services/email_service/src/api/gmail/mod.rs:8 |
| GET | /health | Health check | services/email_service/src/api/health.rs:18 |
| GET | /internal/messages/{id} | Get message by id (internal) | services/email_service/src/api/internal/mod.rs:16 |
| POST | /internal/messages/batch | Batch get messages | services/email_service/src/api/internal/mod.rs:17 |
| POST | /internal/messages/senders | Message senders | services/email_service/src/api/internal/mod.rs:21 |
| POST | /internal/threads/histories | Thread histories | services/email_service/src/api/internal/mod.rs:22 |
| GET | /internal/threads/{id}/messages | Messages by thread id | services/email_service/src/api/internal/mod.rs:23 |
| POST/DELETE | /internal/backfill/provider/gmail | Create / cancel backfill (internal) | services/email_service/src/api/internal/mod.rs:27-28 |
| GET | /internal/backfill/provider/gmail/{id} | Get backfill (internal) | services/email_service/src/api/internal/mod.rs:29 |
| DELETE | /internal/delete_user/{id} | Delete all user email data | services/email_service/src/api/internal/mod.rs:30 |
| GET | /internal/threads/{id}/owner | Thread owner | services/email_service/src/api/internal/mod.rs:31 |

---

## 5. connection_gateway

Router entrypoint: `services/connection_gateway/src/api/mod.rs:19-27`. Spec: `packages/sdk/specs/connection.json` (3 ops; router has 6).

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | / | WebSocket upgrade (authenticated user connection) | services/connection_gateway/src/api/connection/mod.rs:34 |
| POST | /message/send/{entity_type}/{entity_id} | Send realtime message to entity's connections | services/connection_gateway/src/api/message/mod.rs:24 |
| POST | /message/batch_send | Batch send one message to many entities | services/connection_gateway/src/api/message/mod.rs:28 |
| POST | /message/batch_send_unique | Batch send unique messages (not in spec) | services/connection_gateway/src/api/message/mod.rs:29 |
| GET | /track/{entity_type}/{entity_id} | Get tracked entity connection state | services/connection_gateway/src/api/entities/mod.rs:22 |
| GET | /health | Health check | services/connection_gateway/src/api/health/mod.rs:19 |

### WebSocket protocol (see section "WebSocket protocols" below)

---

## 6. notification_service

Router entrypoint: `services/notification_service/src/api/mod.rs:71-80` (also mounted under `/{version}` — spec shows `/v1` and `/v2` variants). Spec: `packages/sdk/specs/notification.json` (19 ops; router has ~22).

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /health | Health check | services/notification_service/src/api/health.rs:17 |
| POST | /device/register | Register device for push (not in spec) | crates/notification/src/inbound/http/device.rs:23 |
| DELETE | /device/unregister | Unregister device (not in spec) | crates/notification/src/inbound/http/device.rs:24 |
| GET | /user_notifications | List typed notifications (spec: /v1/...) | services/notification_service/src/api/user_notification.rs:145 |
| POST | /user_notifications/item/bulk | Bulk get by event item ids | services/notification_service/src/api/user_notification.rs:146 |
| GET | /user_notifications/item/{event_item_id} | Notifications for one event item | services/notification_service/src/api/user_notification.rs:150 |
| GET/DELETE | /user_notifications/{notification_id} | Get / soft-delete one notification (spec: DELETE at /v2/...) | services/notification_service/src/api/user_notification.rs:154 |
| DELETE | /user_notifications/bulk | Bulk soft-delete (spec: /v2/...) | crates/notification/src/inbound/http/mod.rs:111 |
| PATCH | /user_notifications/bulk/seen | Bulk mark seen | crates/notification/src/inbound/http/mod.rs:112 |
| PATCH | /user_notifications/bulk/done | Bulk mark done | crates/notification/src/inbound/http/mod.rs:113 |
| PATCH | /user_notifications/bulk/undone | Bulk mark not-done | crates/notification/src/inbound/http/mod.rs:114 |
| GET | /user_notifications/preferences | Disabled notification types | crates/notification/src/inbound/http/mod.rs:116 |
| PUT/GET | /user_notifications/preferences/{notification_event_type}/disable | Disable type (GET = presigned email variant) | crates/notification/src/inbound/http/mod.rs:120 |
| PUT | /user_notifications/preferences/{notification_event_type}/enable | Re-enable type | crates/notification/src/inbound/http/mod.rs:125 |
| GET | /unsubscribe | User's unsubscribe items | services/notification_service/src/api/unsubscribe/mod.rs:19 |
| POST | /unsubscribe/email | Unsubscribe from emails | services/notification_service/src/api/unsubscribe/mod.rs:18 |
| POST/DELETE | /unsubscribe/item/{item_type}/{item_id} | Unsubscribe / re-subscribe item | services/notification_service/src/api/unsubscribe/mod.rs:20-24 |
| POST/DELETE | /unsubscribe/mute | Mute / unmute all notifications | services/notification_service/src/api/unsubscribe/mod.rs:28-32 |

---

## 7. contacts_service

Router entrypoint: `services/contacts_service/src/main.rs:134-141` (routes from crate `contacts`). Spec: `packages/sdk/specs/contacts.json` (2 ops; +health).

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /contacts | List user's contacts | crates/contacts/src/inbound/http.rs:243 |
| POST | /contacts | Add contact (rate-limited) | crates/contacts/src/inbound/http.rs:229 |
| GET | /health | Health check | services/contacts_service/src/health.rs:16 |

---

## 8. static_file_service (SFS)

Router entrypoint: `services/static_file_service/src/api/mod.rs:75-92` — the same file router is mounted at `/api` (JWT user auth; `/api` prefix needed for CDN routing) and `/internal` (service-key auth). Spec: `packages/sdk/specs/static-files.json` (5 ops).

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /api/file/metadata/{file_id} | Get file metadata | services/static_file_service/src/api/file/mod.rs:13 |
| GET | /api/file/{file_id}/presigned-url | Presigned GET URL (not in spec) | services/static_file_service/src/api/file/mod.rs:17 |
| PUT | /api/file | Presigned upload URL | services/static_file_service/src/api/file/mod.rs:21 |
| DELETE | /api/file/{file_id} | Delete file | services/static_file_service/src/api/file/mod.rs:22 |
| POST | /api/file/bulk-delete | Bulk delete files | services/static_file_service/src/api/file/mod.rs:23 |
| GET | /api/health | Health check | services/static_file_service/src/api/health.rs:11 |
| * | /internal/file/... | Same five file routes for internal callers | services/static_file_service/src/api/mod.rs:80 |
| GET | /file/{file_id} | CDN-served file (documented in spec as `get_file_documentation`; actual serving is CloudFront/S3, not axum) | packages/sdk/specs/static-files.json |

---

## 9. unfurl_service

Router entrypoint: `services/unfurl_service/src/api/mod.rs:56-57`. Spec: `packages/sdk/specs/unfurl.json` (3 ops; +health).

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /unfurl | Unfurl URL from `url` query param | crates/unfurl/src/inbound/axum_router.rs:50 (merged via services/unfurl_service/src/api/unfurl/mod.rs:19) |
| POST | /unfurl/bulk | Bulk unfurl | services/unfurl_service/src/api/unfurl/mod.rs:19 |
| GET | /proxy | Proxy remote resource | services/unfurl_service/src/api/proxy/mod.rs:102 |
| GET | /health | Health check | services/unfurl_service/src/api/health/mod.rs:16 |

---

## 10. image_proxy_service

Router entrypoint: `services/image_proxy_service/src/api/mod.rs:48`. No spec file.

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /proxy | Proxy and serve remote image | services/image_proxy_service/src/api/proxy/mod.rs:432 |
| GET | /health | Health check | services/image_proxy_service/src/api/health/mod.rs:17 |

---

## 11. search_processing_service

Router entrypoint: `services/search_processing_service/src/api/mod.rs:96-103`. All routes internal (ingest/backfill). Note: the **public** search API (`packages/sdk/specs/search.json`: POST /search, POST /search/simple) is served by **DSS** via the `search_service` crate mount, not by this service.

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /health | Health check | services/search_processing_service/src/api/health.rs:17 |
| DELETE | /internal/delete/{document_id} | Delete document from index | services/search_processing_service/src/api/internal/mod.rs:13 |
| POST | /internal/extract_sync | Synchronous text extraction | services/search_processing_service/src/api/internal/mod.rs:14 |
| POST | /internal/backfill/calls | Backfill calls index | services/search_processing_service/src/api/internal/backfill.rs:38 |
| POST | /internal/backfill/chats | Backfill chats | services/search_processing_service/src/api/internal/backfill.rs:39 |
| POST | /internal/backfill/channels | Backfill channels | services/search_processing_service/src/api/internal/backfill.rs:40 |
| POST | /internal/backfill/documents | Backfill documents | services/search_processing_service/src/api/internal/backfill.rs:41 |
| POST | /internal/backfill/emails | Backfill emails | services/search_processing_service/src/api/internal/backfill.rs:42 |
| POST | /internal/backfill/properties | Backfill properties | services/search_processing_service/src/api/internal/backfill.rs:43 |
| POST | /internal/backfill/projects | Backfill projects | services/search_processing_service/src/api/internal/backfill.rs:44 |
| GET | /internal/backfill/{job_id} | Backfill job status | services/search_processing_service/src/api/internal/backfill.rs:45 |

---

## 12. scheduled_action

Router entrypoint: `services/scheduled_action/src/bins/service.rs:134` merging `services/scheduled_action/src/inbound/axum_router.rs:50-62`. Spec: `packages/sdk/specs/scheduled-action.json` (7 ops).

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /health | Health check | services/scheduled_action/src/bins/service.rs:134 |
| GET/POST | /scheduled-actions | List / create scheduled actions | services/scheduled_action/src/inbound/axum_router.rs:50 |
| PUT/DELETE | /scheduled-actions/{id} | Update / delete action | services/scheduled_action/src/inbound/axum_router.rs:54 |
| POST | /scheduled-actions/{id}/execute | Execute now | services/scheduled_action/src/inbound/axum_router.rs:58 |
| GET | /scheduled-actions/{id}/history | Execution history | services/scheduled_action/src/inbound/axum_router.rs:62 |

---

## 13. convert_service

Router entrypoint: `services/convert_service/src/api/mod.rs:46-50` (all under /internal, service-key auth). No spec file.

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /health | Health check | services/convert_service/src/api/health.rs:17 |
| POST | /internal/convert | Convert document (e.g. DOCX→markdown) | services/convert_service/src/api/convert.rs:276 |
| POST | /internal/backfill/docx | Backfill DOCX conversions | services/convert_service/src/api/backfill/mod.rs:7 |

---

## 14. mcp_service (incl. mcp_auth_proxy library)

Binary: `services/mcp_service/src/main.rs` — Streamable-HTTP MCP server exposing the DCS AI toolset. `services/mcp_auth_proxy` is a **library** crate (no bin) providing the OAuth front-door router consumed by mcp_service (`main.rs:76`). No OpenAPI spec.

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | /health | Health check | services/mcp_auth_proxy/src/inbound/axum_router.rs:211 |
| GET | /.well-known/oauth-protected-resource | RFC 9728 protected-resource metadata | services/mcp_auth_proxy/src/inbound/axum_router.rs:212 |
| GET | /.well-known/oauth-protected-resource/mcp | Same, path-scoped variant | services/mcp_auth_proxy/src/inbound/axum_router.rs:216 |
| GET | /mcp/.well-known/oauth-protected-resource | Same, alternative placement | services/mcp_auth_proxy/src/inbound/axum_router.rs:220 |
| GET | /.well-known/oauth-authorization-server | RFC 8414 auth-server metadata | services/mcp_auth_proxy/src/inbound/axum_router.rs:224 |
| GET | /.well-known/oauth-authorization-server/mcp | Variant | services/mcp_auth_proxy/src/inbound/axum_router.rs:228 |
| GET | /mcp/.well-known/oauth-authorization-server | Variant | services/mcp_auth_proxy/src/inbound/axum_router.rs:232 |
| GET | /authorize | OAuth authorize | services/mcp_auth_proxy/src/inbound/axum_router.rs:236 |
| POST | /register | Dynamic client registration | services/mcp_auth_proxy/src/inbound/axum_router.rs:237 |
| GET | /oauth/callback | OAuth callback | services/mcp_auth_proxy/src/inbound/axum_router.rs:238 |
| POST | /token | Token endpoint | services/mcp_auth_proxy/src/inbound/axum_router.rs:239 |
| ANY | /mcp | Streamable-HTTP MCP session endpoint (bearer-validated, `nest_service`) | services/mcp_auth_proxy/src/inbound/axum_router.rs:244; services/mcp_service/src/main.rs:42-84 |

---

## 15. sync-service (Cloudflare Worker + Durable Object, Rust/WASM)

Not in the original expected list but a real HTTP+WS deployable: collaborative document sync (Lexical/Loro) on Cloudflare. Worker router `services/sync-service/src/cf_worker.rs:118-134`; per-document Durable Object router `services/sync-service/src/durable_object.rs:849-903`. Paths are method-agnostic matchit routes.

| Path | Purpose | Source |
|---|---|---|
| / | Root marker | services/sync-service/src/cf_worker.rs:121 |
| /health | Health | services/sync-service/src/cf_worker.rs:124 |
| /schema | Bebop schema | services/sync-service/src/cf_worker.rs:127 |
| /document/{document_id}/copy | Copy document sync state | services/sync-service/src/cf_worker.rs:130 |
| /document/{document_id}/{*rest} | Forwarded to Durable Object | services/sync-service/src/cf_worker.rs:133 |
| /document/{id}/connect | WebSocket connect (client sync session) | services/sync-service/src/durable_object.rs:852 |
| /document/{id}/exists | Existence check | services/sync-service/src/durable_object.rs:855 |
| /document/{id}/initialize | Initialize document state | services/sync-service/src/durable_object.rs:858 |
| /document/{id}/raw | Raw document state | services/sync-service/src/durable_object.rs:861 |
| /document/{id}/active_peers | Active peers | services/sync-service/src/durable_object.rs:864 |
| /document/{id}/snapshot | Snapshot | services/sync-service/src/durable_object.rs:870 |
| /document/{id}/peer/{peer_id} | Peer state | services/sync-service/src/durable_object.rs:873 |
| /document/{id}/metadata | Metadata | services/sync-service/src/durable_object.rs:876 |
| /document/{id}/blame/{node_id} | Node blame | services/sync-service/src/durable_object.rs:879 |
| /document/{id}/debug_dump_operations | Debug ops dump | services/sync-service/src/durable_object.rs:882 |
| /document/{id}/debug_do_kv_get/{key} | Debug KV get | services/sync-service/src/durable_object.rs:888 |
| /document/{id}/debug_do_kv_list/{prefix} | Debug KV list | services/sync-service/src/durable_object.rs:894 |
| /document/{id}/wakeup | Wake document session | services/sync-service/src/durable_object.rs:900 |

---

## GraphQL

Schema SDL: `static_assets/schema.graphql` (4158 lines). Served by DSS at `/items/soup/graphql` (HTTP) and `/items/soup/graphql/ws` (subscriptions) — `services/document_storage_service/src/api/graphql_soup.rs:22-29`. Root types (`schema.graphql:4153-4157`):

**Query — `SoupQueryRoot`** (`schema.graphql:4068`): single field `user: GraphqlUser!`. All queries hang off `GraphqlUser` (`schema.graphql:3788`):

| Field | Purpose |
|---|---|
| user.id | Authenticated user id |
| user.emailLabels | Labels across all accessible inboxes |
| user.emailLinks | Enriched owned/delegated email links |
| user.emailThread(input) | One accessible email thread by id |
| user.soup(input) | Page of Soup items (Soup filter AST) → `SoupPage` |
| user.groupSoup(input) | Soup items nested into grouping bins → `GroupedSoup` |

**Mutation — `CompleteMutationRoot`** (`schema.graphql:36`):

| Field | Purpose |
|---|---|
| setEntityProperty(input) | Set or attach one property on an entity |
| renameEntities(inputs) | Rename heterogeneous entities in one request |
| moveEntities(inputs) | Move entities to a project or root |
| updateEntitySharePolicies(inputs) | Update public/channel share policies |
| trashEntities(entities) | Soft-delete (reversible trash) |
| restoreEntities(entities) | Restore reversibly deleted entities |

**Subscription — `SoupSubscriptionRoot`** (`schema.graphql:4078`):

| Field | Purpose |
|---|---|
| soupUpdates | Realtime Soup patches for the authenticated user; each patch is `SoupUpdated` (hydratable entity) or `GraphqlCacheDeletion` |

Soup entity implementors (`GraphqlSoupEntity`): CalendarEvent, Call, Channel, ChannelMessage, Chat, CrmCompany, Document, EmailThread, ForeignEntity, Project, Reminder (plus Notification, EmailMessage, etc. as auxiliary types).

---

## WebSocket protocols

### connection_gateway (client realtime fan-out)

- Upgrade: `GET /` — `services/connection_gateway/src/api/connection/mod.rs:34-54`; connection registered per user in the connection manager, last-online tracking on close.
- **Incoming** (client→server), JSON-tagged enum `ToWebsocketMessage` — `services/connection_gateway/src/model/websocket.rs`:
  - `"ping"` (bare text) → refreshes last-online, replies `pong` — `services/connection_gateway/src/api/connection/messages.rs:66-95`
  - `track_entity` (`TrackEntityMessage`: entity_type, entity_id, action) → subscribe/unsubscribe this connection to an entity's updates — `messages.rs:100-118`
  - `stream_events` (`StreamEvents`) → subscribe to AI stream events (crate `stream`) — `messages.rs:120-122`
- **Outgoing** (server→client), `OutgoingMessage` — `services/connection_gateway/src/model/message.rs:26-29`:
  - `Pong` (text `pong`)
  - `Message { type, data }` — generic envelope; `type: "stream_event"` carries serialized `StreamEvent` (`message.rs:12-23`); other types are the payloads pushed by services through `POST /message/send|batch_send|batch_send_unique` (bodies defined in `crates/connection_gateway_models/src/lib.rs:10-59` — `SendMessageBody`, `BatchSendMessageBody`, `BatchSendUniqueMessagesBody`, `MessageReceipt`).

### DSS GraphQL subscriptions

- `GET /items/soup/graphql/ws` — async-graphql WebSocket (all standard GraphQL-WS protocols), serving `soupUpdates` — `services/document_storage_service/src/api/graphql_soup.rs:28`.

### sync-service

- `/document/{id}/connect` — WebSocket into the document's Durable Object; binary bebop-encoded sync protocol (schema at `services/sync-service/bebop-schema/`, served at `/schema`).

---

## Summary

| Service | HTTP endpoints (router; method+path pairs) | OpenAPI spec | Router entrypoint |
|---|---|---|---|
| authentication_service | ~79 (64 in spec) | packages/sdk/specs/auth.json | services/authentication_service/src/api/mod.rs |
| document_storage_service (DSS) | ~205 (167 in spec; + ~33 internal + GraphQL) | packages/sdk/specs/storage.json | services/document_storage_service/src/api/mod.rs |
| document_cognition_service (DCS) | ~44 (38 in spec) | packages/sdk/specs/cognition.json | services/document_cognition_service/src/api/mod.rs |
| email_service | ~62 (49 in spec) | packages/sdk/specs/email.json | services/email_service/src/api/mod.rs |
| connection_gateway | 6 (3 in spec) + WS protocol | packages/sdk/specs/connection.json | services/connection_gateway/src/api/mod.rs |
| notification_service | ~22 (19 in spec) | packages/sdk/specs/notification.json | services/notification_service/src/api/mod.rs |
| contacts_service | 3 (2 in spec) | packages/sdk/specs/contacts.json | services/contacts_service/src/main.rs |
| static_file_service | 6 per mount (/api + /internal) | packages/sdk/specs/static-files.json | services/static_file_service/src/api/mod.rs |
| unfurl_service | 4 (3 in spec) | packages/sdk/specs/unfurl.json | services/unfurl_service/src/api/mod.rs |
| image_proxy_service | 2 | — | services/image_proxy_service/src/api/mod.rs |
| search_processing_service | 11 (internal-only; public /search served by DSS) | packages/sdk/specs/search.json (documents DSS-mounted crate) | services/search_processing_service/src/api/mod.rs |
| scheduled_action | 7 | packages/sdk/specs/scheduled-action.json | services/scheduled_action/src/inbound/axum_router.rs |
| convert_service | 3 | — | services/convert_service/src/api/mod.rs |
| mcp_service (+ mcp_auth_proxy lib) | 12 (11 OAuth/metadata + /mcp MCP transport) | — | services/mcp_auth_proxy/src/inbound/axum_router.rs |
| sync-service (CF Worker) | 18 matchit paths (incl. WS /connect) | — | services/sync-service/src/cf_worker.rs |
| properties (spec) | 20 ops — served by DSS at /properties | packages/sdk/specs/properties.json | crates/properties/src/inbound/axum_router.rs |

### Non-HTTP / out-of-scope deployables in `services/`

Event/queue/lambda workers (no axum router): ai_projections_refresh_handler, call_recording_preview_handler, dataloss_prevention_handler, delete_chat_handler, deleted_item_poller, document_text_extractor, document_upload_finalizer_handler, docx_unzip_handler, email_refresh_handler, email_scheduled_handler, email_sfs_delete_handler, email_suppression_handler, organization_retention_handler / organization_retention_trigger, search_upload_handler, sha_cleanup_worker, upload_extractor_lambda_handler / _trigger, user_link_cleanup_handler, worker_trigger, image_optimizer.

Non-Rust services: websocket-service (TS), analytics-proxy (TS Cloudflare Worker), ai-editing-worker (TS worker, has 3 TS-side routes in `src/endpoints/index.ts` / `src/index.ts`), coding-agent-worker (TS), lexical-service (TS), bots/anthropic-status-bot + bots/stripe-payment-bot (TS), transcription (Python/LiveKit).

### Known spec-vs-router drift (flagged for the merge)

1. auth email verification: spec `/email/fusionauth/verify/{id}` + `/email/fusionauth_resend` vs router `/email/verify/fusionauth/{id}` + `/email/resend/fusionauth` (`services/authentication_service/src/api/email/mod.rs:15-19`).
2. DCS chat mutations: spec `/chat/{chat_id}` (delete/patch/permanent) vs actual mount `/chats/{chat_id}` (utoipa `path=` in `crates/chat/src/inbound/http/router.rs:273,301,345` says `/chat/...` while the router nests under `/chats`).
3. Spec `/v1`/`/v2` prefixes (notification, DSS `/v2/documents/.../permissions`, `/v2/projects/{id}`) are the generic `/{version}` nest, not separate handlers.
