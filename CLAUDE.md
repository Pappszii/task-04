# World Alerts (PoC)

Proof of concept built from this product brief:

> We want users to be able to set up alerts so they get notified when something important happens in the world — like breaking news, market movements, natural disasters, that kind of thing. Should work for both email and Slack. Make it flexible enough that we can add more channels later. We need an admin view too.

Users create alerts and are notified via email and Slack when matching world events happen. An admin can manage delivery channels.

## Hard constraints
- **No real external calls.** No real news/market/disaster APIs, no real SMTP, no real Slack. Everything external is mocked.
- Mocks live behind the **same interfaces a real implementation would use** (`EventSource`, `NotificationChannel`, repositories). Swapping in a real adapter must not require changes to services or UI.
- Core code (dispatcher, matcher, UI) must never reference a concrete channel by name. Channels are discovered via `ChannelRegistry` / `GET /api/channels`.

## Stack
- `/server`: Node.js + TypeScript + Express. In-memory repositories, seeded on boot (resets on restart).
- `/web`: Angular 22 (standalone components, signals) + **Tailwind CSS** and plain CSS. **No component library.** API access via abstract classes + injection tokens so the API layer is swappable.
- Testing: **Vitest** in both workspaces (no Jest, no Karma/Jasmine).
- Realtime: Server-Sent Events.
- No auth. Demo user is chosen with a header role switcher (`X-Demo-User` header; SSE uses `?userId=` because `EventSource` cannot set headers). Admin routes are guarded on both client and server.

## UI technical requirements (`/web`)
**Framework**
- Angular with standalone components only (no NgModules), signals for state, new control flow (`@if` / `@for`), `inject()` over constructor injection, `OnPush` change detection on every component.
- Lazy-loaded routes per page. Functional guards (`adminGuard`) and functional HTTP interceptors (attach `X-Demo-User`).
- Reactive forms (typed) for the alert form and Settings.
- Strict TypeScript (`strict`, `noImplicitAny`, strict templates). No `any`.

**No component library** (decided at scaffold time: PrimeNG 22 moved to a commercial licence with a licence key)
- Build on native, accessible HTML elements: `button`, `select`, `input`, `textarea`, checkbox `input` styled as a switch, `table`, `<dialog>` for the alert form and delete confirmation. Native elements give keyboard and screen-reader behaviour for free; do not re-implement them with `div`s.
- Small shared presentational pieces live in `web/src/app/ui/` (e.g. status tag, toast outlet, confirm dialog, page states for loading/empty/error). Add one only when a second page needs it.
- Do not add a component library (Angular Material, PrimeNG, etc.) without asking.

**Tailwind and CSS**
- Tailwind CSS 4 (via `@tailwindcss/postcss`) for layout, spacing, typography, colour and responsive utilities.
- Design tokens (colours, radius) are CSS custom properties declared in `@theme` in the global stylesheet `web/src/styles.css`, and used through the utilities they generate (`bg-surface`, `text-muted`, ...). No hardcoded hex values in templates.
- Plain CSS is allowed in the global stylesheet for the few things utilities cannot express cleanly (e.g. the switch control, `<dialog>` backdrop). No component-level CSS unless a utility class genuinely cannot express it.
- Light theme only. Add a dark mode only if it is actually implemented end to end.

**Look and behaviour**
- Responsive down to ~375px wide. Keyboard accessible, visible focus, form fields have labels, status is never conveyed by colour alone (status tags always carry text).
- Every page has loading, empty and error states.
- The channel picker, Settings fields and admin channel list are rendered from `GET /api/channels`. No channel is hardcoded in templates.

**Testing (Vitest)**
- Vitest is the test runner for both `/server` and `/web`. In Angular use the Vitest builder/runner (`ng test`, Angular 21+ default) with jsdom, and Angular `TestBed` for component tests.
- Required UI tests: alert form validation (AC1), `adminGuard` (AC12), channel picker renders from API data and reflects a disabled channel (AC10, AC13), notifications page appends SSE messages (AC11, with a fake `EventSource`).
- Test through the abstract API classes using fakes, never the real HTTP backend.
- Verify the exact Angular / Tailwind / Vitest version combination at scaffold time and record the versions in the README.

## Repo layout
```
/server   Node + TS + Express     (npm workspace)
/web      Angular app             (npm workspace)
/CLAUDE.md
package.json   root scripts: dev (server + web), test, build
```

## Commands
- `npm run dev`: start server and web
- `npm test`: server + web tests
- `npm run build`: build both

## Architecture
Layering: ports (interfaces) -> adapters (mocks / in-memory) -> services (matcher, dispatcher) -> http.

Server (`/server/src`):
- `domain/`: `WorldEvent {id, category: 'news'|'markets'|'disasters', title, summary, severity 1-5, tags[], symbol?, percentChange?, occurredAt, source}`, `AlertRule`, `User`, `Notification`, `ChannelState`.
- `ports/`: `EventSource { start(); stop(); onEvent(cb) }`, `NotificationChannel { id; displayName; destinationKind; validateDestination(d); send(msg): Promise<DeliveryResult> }`, and repositories (`UserRepository`, `AlertRuleRepository`, `NotificationRepository`, `ChannelSettingsRepository`).
- `adapters/`: `MockEmailChannel`, `MockSlackChannel` (build a realistic payload, log it, no network), `MockNewsSource` / `MockMarketSource` / `MockDisasterSource` (fixture-driven, timer-based), `InMemory*Repository`, `seed.ts`.
- `services/`: `RuleMatcher` (pure), `AlertDispatcher`, `ChannelRegistry`, `EventBus`.
- `http/`: REST routes, SSE endpoint, `adminOnly` middleware.

REST surface:
- `GET /api/demo-users` (public; feeds the header user switcher)
- `GET /api/me`, `GET/PUT /api/me/contacts`
- `GET /api/channels` (enabled channels + destination requirements; drives the UI)
- `GET/POST/PUT/DELETE /api/rules`
- `GET /api/notifications` (own)
- `GET /api/stream` (SSE: `notification`, `channel-changed`)
- `GET /api/admin/channels`, `PATCH /api/admin/channels/:id { enabled }`
- `POST /api/dev/events` (dev only, for demo triggering)

Web (`/web/src/app`): lazy routes `/alerts`, `/notifications`, `/settings`, `/admin/channels` (behind `adminGuard`); header user/role switcher; channel picker rendered from `GET /api/channels`; `RealtimeService` wraps SSE and exposes signals.

## Rules
- `RuleMatcher` is a pure function (event + rule -> boolean). Keep it side-effect free and unit-tested.
- A failing channel must never block other channels; record `failed` / `skipped` with a reason.
- **To add a channel:** implement `NotificationChannel`, add one `register()` call. Nothing else.
- Notification statuses: `sent | failed | skipped`.

## Scope
**In:** alert CRUD, mock event feeds, matching, mock Email/Slack delivery, My notifications (live), Settings (contact destinations), Admin channel management (enable/disable).

**Out:** real integrations, login/auth, persistence beyond process memory, admin delivery log / cross-user rule overview / event-simulator UI, failure simulation.

## Implementation plan
1. Write this file.
2. Scaffold workspace: root `package.json`, `/server` (TS, Express, vitest), `/web` (Angular CLI, standalone, Tailwind, Vitest runner).
3. Server domain + ports + in-memory repos + seed data (3 users, 1 admin, a few rules).
4. `ChannelRegistry`, mock Email/Slack channels, `RuleMatcher`, `AlertDispatcher`, `EventBus` (+ unit tests).
5. Mock event sources + timer + `POST /api/dev/events`.
6. REST routes, admin guard, SSE endpoint.
7. Angular shell, session switcher, API abstraction + HTTP implementations.
8. Alerts page (list + form), Settings page, My notifications page (SSE).
9. Admin channels page + guard.
10. Prove extensibility: add a throwaway third mock channel (e.g. `webhook`) and confirm it appears in the UI and delivers with zero changes outside its own file + one `register()` line.
11. README: run instructions, architecture diagram, "how to add a channel".

## Acceptance Criteria

**Alerts (user)**
- **AC1.** A user can create an alert with a category, an optional keyword filter, a minimum severity, and at least one channel. Validation blocks saving with no channel or no category.
- **AC2.** A user can edit, enable/disable, and delete their own alerts. They cannot see or modify other users' alerts (API returns 403/404).
- **AC3.** A markets alert can optionally specify a symbol and a minimum % move. Events below the threshold do not trigger it.

**Matching and delivery**
- **AC4.** When a mock world event is emitted that matches an enabled rule (category, severity >= threshold, keyword match when set), a notification is created for each selected channel. Non-matching events create none.
- **AC5.** Disabled rules never fire. If a rule selects multiple channels, one notification per channel is created.
- **AC6.** Email and Slack deliveries go through the `NotificationChannel` interface via the `ChannelRegistry`. Nothing in dispatcher or UI code references "email" or "slack" by name.
- **AC7.** Mock channels make **no network calls**. They log and store the payload they would have sent. Verifiable by running the whole flow offline.
- **AC8.** If one channel's `send` throws, the other channels for the same event still deliver, and the failed one is recorded as `failed`.
- **AC9.** A user with no destination configured for a selected channel gets a `skipped` notification with a reason, not a crash.

**Extensibility**
- **AC10.** Adding a new channel requires only a new class implementing `NotificationChannel` and one `register()` call. It appears in the channel picker, Settings, and admin list automatically.

**Realtime**
- **AC11.** A newly created notification appears on the user's My notifications page within ~2s without a manual refresh (SSE). Only the user's own notifications are pushed to them.

**Admin**
- **AC12.** Switching to the Admin role shows an Admin nav item. Non-admin users cannot reach `/admin/*` in the UI (redirect) or `/api/admin/*` (403).
- **AC13.** The admin can list all registered channels and enable/disable each. A disabled channel is hidden from the users' channel picker, and any delivery attempted through it is recorded as `skipped` (reason: channel disabled). Re-enabling restores delivery.

**Quality**
- **AC14.** Vitest unit tests pass for `RuleMatcher`, `AlertDispatcher` (including AC8, AC9, AC13), and `ChannelRegistry` on the server, and for the required UI tests listed under UI technical requirements. `npm test` is green.
- **AC17.** The UI is built from native HTML elements styled with Tailwind utilities and the global stylesheet's tokens, with no component library and no component-level CSS. All pages are usable at 375px width and show loading, empty and error states.
- **AC15.** `npm run dev` starts both apps from a clean checkout with no external services. `npm run build` succeeds with no TypeScript errors in either workspace.
- **AC16.** Seed data lets a reviewer see a full flow within one minute of starting (an existing alert, an event auto-emitting, a notification arriving).

## Verification
- `npm test` (Vitest: server unit tests, plus Angular component tests for alert form validation, the admin guard, the channel picker and the notifications page).
- `npm run dev`, then in the browser: switch to a seeded user, create an alert, fire `POST /api/dev/events` with a matching event, and watch the notification appear live (AC1, AC4, AC11). Switch to Admin, disable a channel, fire again, and confirm the notification shows `skipped` (AC13).
- Disconnect the network and repeat the flow (AC7).
- Walk the AC list top to bottom before declaring done.

## Open questions / assumptions (confirm with product)
1. Users see their own delivery history on a "My notifications" page. It was not explicitly requested.
2. Contact destinations (email address, Slack handle) are edited by the user on a Settings page. In production these might come from SSO or Slack OAuth.
3. Admin scope is channel enable/disable only. Delivery log, cross-user rule view and event-simulator UI were deliberately excluded. Should any be added?
4. Should an admin-disabled channel drop deliveries (`skipped`, current choice) or queue them until re-enabled?
5. Dedupe/rate limiting: not implemented (one notification per event x rule x channel). Is a digest or throttle expected later?
6. Severity scale is 1-5 and is mapped by each mock source. Real providers would need their own mapping.
7. Keyword matching is case-insensitive substring on title, summary and tags. Is that enough?
8. Time zone / quiet hours and per-user notification preferences: not in the PoC.
9. The brief says "only UI implementation", but the answers chose a Node backend with mocked APIs. Treated as: the backend is part of the PoC, and everything external to it is mocked.
