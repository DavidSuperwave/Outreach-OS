# ADR-011 — SSRF controls on Workers (safe-fetch)

- Status: Proposed (Draft — owner decides; this is the OD-6 design proposal)
- Date: 2026-08-20
- Owners: David (decision); WP-030 drafting agent (proposal)

## Context

Neuwave @ `9f7a26b` defends against SSRF with **DNS-resolution-based checks in
three independent implementations** (verified, WP-010 F2):

1. unfurl: `services/unfurl_service/src/http_safety/mod.rs:91-115` —
   `lookup_host` + `is_private_ip` (check-then-use);
2. outbound webhooks: `crates/webhook/src/outbound/http_validator.rs` —
   `validate_resolved_endpoint_url` + `is_blocked_ip`;
3. image proxy: `services/image_proxy_service/src/api/proxy/resolver.rs` —
   a custom reqwest DNS resolver filtering private IPs at **connect time**
   (the strongest of the three: no TOCTOU window).

Workers cannot resolve a hostname and then decide whether to fetch it with
plain `fetch()` — the check-then-use pattern is unportable as-is. Consumers in
the rewrite: unfurl, image/safe byte fetch (ADR-010), outbound webhook
delivery (5-attempt ladder), and **connector/gatekeeper endpoints accepting
user-entered URLs** (the P1 connectivity centerpiece), plus any agent-driven
fetch.

## Source and ruling constraints

- OD-6 (existing): one safe-fetch/SSRF ruling covering all consumers; parity
  bar = **resolver-level filtering or better** (WP-010 recommendation 4).
- 01-AUTHORITY exception discipline: whatever ships documents boundary/owner,
  threat model, observability, deployment/rollback.
- Kernel-change budget: no kernel modification for egress policy.

## Decision

**Proposed: one wrapper capability `safe-fetch`, the only allowed path for
requests to non-allowlisted external origins.**

1. **Mechanism (resolver-level parity on Workers):** resolve the target host
   via DNS-over-HTTPS (1.1.1.1/Cloudflare DoH) inside the capability,
   validate **every** resolved address against the blocklist (RFC1918,
   loopback, link-local, unspecified, ULA/IPv6-mapped, cloud metadata
   169.254.169.254), then connect **to the validated IP** with the original
   host carried for SNI/Host — via `connect()` TCP sockets where raw control
   is needed, or `fetch` with `resolveOverride` pinning where supported. Each
   redirect hop (manual following, bounded) re-runs the full
   resolve-validate-pin cycle, matching image-proxy's re-validation behavior.
   This is connect-time pinning: no TOCTOU window, meeting the "resolver-level
   or better" bar. DNS answers are not cached across requests beyond their
   validation (a re-resolve happens per attempt), so rebinding between
   attempts cannot bypass the check.
2. **Policy profile per consumer** (single policy engine, per-consumer
   budgets): timeouts, max redirects, max body size (streaming-enforced,
   distrusting Content-Length), allowed schemes (http/https only), allowed
   ports (80/443 + explicit per-consumer exceptions), UA policy (spoofed UA
   only for the image-laundering profile), and **no platform credentials
   ever attached** to safe-fetch requests.
3. **Fail closed.** Resolution failure, validation failure, or policy engine
   unavailability refuses the fetch. Blocked attempts are logged with
   consumer, host, and resolved IPs (the observability requirement).
4. **Escape hatch is structural, not conditional:** if connect-time pinning
   proves infeasible for a consumer (e.g. a protocol quirk), that consumer
   routes through a dedicated **egress proxy container** running the same
   policy (Cloudflare Container/tunnel) rather than degrading to
   check-then-use. No consumer gets a policy bypass flag.
5. **Enforcement:** CI/lint forbids direct `fetch` to request-derived URLs
   outside the safe-fetch package; the router audit (ADR-002) covers byte
   paths.

## Alternatives considered

1. **Check-then-use port (resolve via DoH, then plain `fetch(hostname)`).**
   Rejected: reintroduces the TOCTOU/rebinding window that image-proxy's
   resolver design already closed at the pin; below the parity bar.
2. **Egress proxy container for everything.** Viable but heavier: adds a
   always-on container on every unfurl/preview fetch. Kept as the structural
   escape hatch (Decision 4) and as OD-6 option (a) if the owner prefers one
   chokepoint process.
3. **Hostname allowlists only.** Rejected (OD-6 option (c), "not
   recommended"): breaks unfurl/connector generality; allowlists complement,
   not replace, IP validation.
4. **Rely on Cloudflare platform egress filtering alone.** Rejected: no
   platform primitive expresses per-consumer policy + private-range
   guarantees at the needed granularity today; if one emerges, this ADR is
   revisited (cheap swap behind the capability).

## Compatibility impact

- Behavior parity for unfurl/image/webhook fetch hardening (timeouts,
  redirect caps, size caps) is preserved or strengthened; strengthening
  (connect-time pinning everywhere) is recorded as an intentional
  difference.
- Webhook delivery keeps its exact retry ladder (5 × 30/60/120/300s) on top
  of safe-fetch; validation failures count as delivery failures with the
  source's pause/invalid semantics.

## State and authorization impact

- safe-fetch is stateless (policy + counters only); it holds **no**
  credentials and mints no receipts. Consumers pass already-authorized
  intents; the capability enforces network policy only.
- Connector/gatekeeper credentialed calls to *known* provider origins are a
  different class (allowlisted origins, credentials allowed) — they bypass
  the user-URL profile but still run the IP validation layer.

## Migration and rollback

- No data. Rollback: consumers pin safe-fetch package versions; a policy
  regression rolls back as a wrapper deploy. Blocklist updates are config
  (KV snapshot per ADR-005 rule 4) with audited history.

## Operational consequences

- One chokepoint for egress telemetry: blocked-attempt rate, per-consumer
  egress volume, DoH latency budget (adds one DoH roundtrip per fetch;
  cacheable within a request's redirect chain).
- DoH dependency: 1.1.1.1 outage degrades unfurl/proxy features (fail
  closed) — accepted and stated; webhook delivery retries absorb transient
  failures.

## Tests and acceptance

- Adversarial suite (CI): private/loopback/link-local/metadata IPs (v4+v6),
  DNS rebinding across attempts, redirect-to-internal at hop N, lying
  Content-Length, oversized streaming body, disallowed ports/schemes — all
  refused, all logged.
- Parity: the three source guards' test cases (extracted from the pinned
  services) pass against safe-fetch.
- Lint: zero direct external `fetch` on request-derived URLs outside the
  package.

## Follow-up decisions

- **OD-6 (existing)**: owner ratifies this mechanism (or elects the
  all-container option); this ADR is the design proposal that decision needs.
- Owner call on the image-laundering profile's survival (ADR-010).
- Per-consumer policy budgets (timeouts/sizes) belong to
  `reports/04-target-architecture-decisions.md`.
