# SPEC: World-Event Alerts (MVP, mock data)

Source brief: users should be able to set up alerts so they get notified when something important happens in the world (breaking news, market movements, natural disasters). Must work for email and Slack, be flexible enough to add more channels later, and include an admin view.

This spec resolves the brief's ambiguities with explicit assumptions (see §2) so implementation can start without a real event feed, real email/Slack delivery, or real authentication. See the full requirements analysis and open PM questions in the project's plan history; the assumptions below are what this spec builds against until the PM answers them.

## 1. Goal and non-goals
**Goal:** users subscribe to categories of world events and receive notifications by email and Slack; admins can see and control the system. Adding a channel later must not require changes to matching or ingestion.

**Non-goals (MVP):** real event feeds or licensing, real email/Slack delivery, real authentication, Slack OAuth app, digests, SMS/push, multi-tenant orgs, free-form rule builder, billing.

## 2. Key assumptions (replace as PM answers arrive)
| # | Assumption | Open question it stands in for |
|---|-----------|-------------------|
| A1 | Events come **only from a mock source** (seeded fixtures plus an admin "emit event" simulator). Real feeds plug in later behind the same `EventSource` interface. | Where do events come from? Which category launches first? |
| A2 | All three categories (news, market, disaster) are in scope, because mock data removes the licensing/cost problem. Each has a small typed condition schema. | Same as above |
| A3 | Conditions are curated per category (severity/threshold/region/keyword fields), not a free-form rule builder. | Are alert conditions user-defined or curated? |
| A4 | Slack = incoming-webhook URL supplied by the user. No OAuth app. | Slack integration model |
| A5 | **Email and Slack are fully mocked.** Both `Channel` implementations write to a mock outbox (persisted, viewable in the UI as a fake inbox and fake Slack channel). No SMTP, no Slack webhooks, no network calls. Real adapters are a future task behind the same `Channel` interface. Failure injection (per channel, per user or global) simulates bounces and Slack errors. | Same as above |
| A6 | **Authentication is mocked.** A dev login picks a seeded identity (admin, user A, user B) with no passwords, tokens or identity provider; the API trusts a mock session header/cookie set by that picker. Two roles: `user`, `admin`. Single tenant. | Is there an existing user/auth system? Who is an admin? |
| A7 | Instant delivery only, with dedupe and a per-user rate cap. Latency target: under 5 s from event emit to delivery attempt in the mock setup. | Latency target; alert-storm handling |
| A8 | Admin view v1 is mostly read-only, plus enable/disable of users, channels and sources, and retry of a failed delivery. | What must the admin view do on day one? |
| A9 | Stack (to confirm): **Angular** frontend (repo `.gitignore` already assumes it) and a **Node/TypeScript** API with an embedded SQLite store and an in-process queue. Chosen for zero-infrastructure local setup. | Not asked of the PM; an implementation choice |
| A10 | Unsubscribe link in every email and one-click pause; no other compliance work in MVP. | Compliance constraints (GDPR, unsubscribe, etc.) |

## 3. Actors and stories
- **User:** add and verify channels; create, edit, pause and delete alert rules; see recent notifications; unsubscribe.
- **Admin:** see all users and rules; see delivery log with filters (status, channel, category); retry a failed delivery; enable/disable a user, channel type or event source; emit a mock event on demand; see source and channel health.

## 4. Domain model
- **Event**: `id`, `source`, `category` (`news|market|disaster`), `severity` (1-5), `title`, `body`, `occurredAt`, `dedupeKey`, `attrs` (typed per category: `region`+`magnitude`, `symbol`+`changePct`, `topics[]`+`keywords[]`).
- **AlertRule**: `id`, `userId`, `name`, `category`, `conditions` (typed per category), `channelIds[]`, `enabled`.
- **ChannelConfig**: `id`, `userId`, `type` (`email|slack`), `config` (typed per type), `verified`, `enabled`.
- **Delivery**: `id`, `eventId`, `ruleId`, `channelId`, `status` (`queued|sent|failed|suppressed`), `attempts`, `lastError`, timestamps. Unique on (`eventId`, `ruleId`, `channelId`) for idempotency.
- **User**: `id`, `email`, `role`, `enabled`.
- **AuditLog**: admin actions (who, what, when).

## 5. Pipeline
`EventSource` → normalize to `Event` → dedupe by `dedupeKey` → match `AlertRule`s (per-category matcher) → create `Delivery` rows (unique key prevents duplicates) → rate-cap check (mark `suppressed` with reason when exceeded) → queue → `Channel.send` → record outcome → retry with capped exponential backoff (3 attempts), then `failed`.

## 6. Extensibility contracts
```ts
interface EventSource { name: string; start(emit: (e: RawEvent) => void): void; stop(): void; }

interface Channel<C = unknown> {
  type: string;                       // 'email' | 'slack' | ...
  configSchema: JsonSchema;           // drives the UI form and validation
  verify(config: C): Promise<VerifyResult>;
  format(event: Event): ChannelMessage; // per-channel formatting/length limits
  send(config: C, msg: ChannelMessage): Promise<SendResult>;
}
// registry: registerChannel(channel). Matching and pipeline only know Channel.
```
Adding a third channel = one new class plus registration; the UI channel form renders from `configSchema`.

## 7. API (REST, JSON)
- Mock auth: `GET /mock-auth/identities`, `POST /mock-auth/session` (choose an identity, no credentials), `GET /me`.
- Mock outbox: `GET /mock-outbox?channel=email|slack` (what "was sent" to the current user; admin sees all).
- Failure injection (admin): `PUT /admin/mock/failures` (channel, scope, mode).
- User: CRUD `/channels`, `POST /channels/:id/verify`; CRUD `/rules`; `GET /notifications` (own deliveries).
- Admin (role `admin`): `GET /admin/users`, `PATCH /admin/users/:id`; `GET /admin/rules`; `GET /admin/deliveries?status&channel&category`; `POST /admin/deliveries/:id/retry`; `GET /admin/health` (sources and channels); `PATCH /admin/sources/:name` and `/admin/channel-types/:type` (enable/disable); `POST /admin/events` (emit mock event); `GET /admin/audit`.

## 8. UI screens
- **Mock login:** identity picker (no password).
- **User:** Channels (add/verify), Rules (list + editor with category-specific condition fields), Notification history, Mock inbox / mock Slack view of what was "delivered".
- **Admin:** Overview (health, counts, recent failures), Users, Rules, Delivery log (filters + retry), Sources and Channels (toggle), Event simulator, Audit log.

## 9. Mock data
- Seed fixtures: about 30 events across the three categories with a spread of severities, regions, symbols and topics.
- Mock source modes: `replay` (timed fixture playback), `burst` (alert-storm test: 200 events in 10 s, including duplicate `dedupeKey`s), and manual emit from the admin simulator.
- Seed users: one admin, two users, with a few rules and both channel types configured (mock adapters).

## 10. Non-functional requirements
- Because everything external is mocked, no secrets exist in MVP. The `Channel` config schema marks secret fields (for example a Slack webhook URL) so a real adapter later gets encryption and log redaction by construction.
- Admin endpoints enforce role; every admin mutation is audit-logged.
- Structured logs with event/delivery IDs; health endpoint.
- Idempotent delivery creation; a crash mid-pipeline must not double-send (DB unique key plus status transitions).

## 11. Acceptance criteria
0. Logging in via the mock identity picker yields the right role; no real credentials or network access are needed anywhere.
1. A user can add an email and a Slack channel and verify each (verification is simulated by the mock adapter).
2. A user creates a rule (for example disaster, magnitude >= 6, region "Japan") and receives exactly one email and one Slack message when a matching mock event is emitted.
3. A non-matching event produces no delivery.
4. Emitting the same `dedupeKey` twice produces one delivery per channel.
5. The `burst` mode respects the per-user rate cap: excess deliveries are `suppressed` with a visible reason.
6. A failure injected into the mock adapter appears as `failed` after retries in the admin delivery log; after clearing the failure, an admin retry re-queues it and it succeeds.
7. Disabling a channel type in admin stops sends without changing rules.
8. A non-admin cannot call any `/admin/*` route (403); admin actions appear in the audit log.
9. A stub third channel (for example `webhook`) can be added by registering one class, with no changes to matching or pipeline code (demonstrated by a test).
10. **Test coverage**: an automated test exists for each of criteria 1-9 above (unit or integration), plus: per-category rule matchers (positive and negative cases per category), the `Channel`/`EventSource` registry (adding/removing an implementation), delivery idempotency under concurrent/duplicate emits, and role enforcement on every `/admin/*` route. Tests run in CI without network access (mocks only) and must pass before merge.

## 12. Delivery plan
1. Spec committed as `docs/SPEC.md` (this document).
2. Backend skeleton: models, `EventSource`/`Channel` interfaces, mock source, pipeline, mock email/Slack adapters with failure injection, tests for criteria 1-9 (and the extra cases in criterion 10).
3. Mock auth and REST API, with role-enforcement tests.
4. Angular user screens, then admin screens; component/e2e tests for the flows in criteria 1-3 and 6-8.
5. (Out of scope for now) real SMTP/Slack adapters and real auth, behind the existing interfaces.

## 13. Open risks carried by the assumptions
Mock-only means real-feed latency, volume, licensing and event quality are untested, and real email/Slack behavior (bounces, rate limits, OAuth, unsubscribe) and real auth are unvalidated; "important" thresholds are guesses until the PM confirms which conditions should be user-defined vs. curated. The Node/Angular stack (A9) is a proposal, not a decision.

## Verification
- Every open question above is either answered by the PM or has an explicit, recorded assumption.
- Acceptance criteria exist for: creating a rule, receiving an email and a Slack message for a matching event, no duplicate notifications, a failed delivery visible in the admin view, adding a third channel without touching the matching pipeline, and automated test coverage for all of the above (criterion 10 in §11).
