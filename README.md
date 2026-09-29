# task-04

World Alerts proof of concept. Design and acceptance criteria are in [CLAUDE.md](CLAUDE.md).

## Status

| Piece | State |
|---|---|
| `/server` domain, ports, in-memory repositories, seed data | done |
| `ChannelRegistry`, mock Email/Slack channels, `RuleMatcher`, `AlertDispatcher`, `EventBus` | done, unit tested |
| Mock news / market / disaster sources on a timer, `POST /api/dev/events` | done, unit tested |
| Full REST API, demo identity, admin guard, SSE stream | done, integration tested |
| `/web` shell: header nav, demo-user switcher, live status, lazy routes, `adminGuard`, API layer, SSE `RealtimeService` | done, unit tested |
| `/web` Alerts, My notifications, Settings pages | placeholders (plan step 8) |
| `/web` Admin channels page | placeholder (plan step 9) |

## Commands

```
npm install
npm run dev     # API on http://localhost:3000 (API_PORT to change), web on http://localhost:4200
npm test        # Vitest, both workspaces
npm run build
```

In dev, the Angular server proxies `/api` (REST and SSE) to the API (`web/proxy.conf.mjs`), so there is no CORS setup. The header's "Acting as" menu picks the demo user; the choice is kept in localStorage.

The three mock feeds start with the server and each emit a fixture every 15 s, staggered (`EVENT_INTERVAL_MS` to change). Deliveries are logged to the console as `[mock-email]` / `[mock-slack] would send ...`.

Trigger an event by hand (not mounted when `NODE_ENV=production`):

```
curl -X POST localhost:3000/api/dev/events -H 'content-type: application/json' \
  -d '{"category":"disasters","title":"Big quake","severity":5,"tags":["earthquake"]}'
```

Required: `category` (`news` | `markets` | `disasters`), `title`, `severity` (1-5). Optional: `summary`, `tags`, `symbol`, `percentChange`, `id`, `occurredAt`, `source`.

## API

There is no real auth. Name a seeded user in the `X-Demo-User` header (`u-alice`, `u-bob`, `u-carol`, `u-admin`). The SSE stream also accepts `?userId=`, because `EventSource` cannot set headers. A missing or unknown user gets 401. Errors are `{ "errors": [...] }` for 400 validation failures and `{ "error": "..." }` otherwise.

| Route | Who | Notes |
|---|---|---|
| `GET /api/health` | public | |
| `GET /api/demo-users` | public | `id`, `name`, `role` for the user switcher |
| `GET /api/channels` | public | Enabled channels only: `id`, `displayName`, `destinationKind` |
| `POST /api/dev/events` | public, dev only | See above |
| `GET /api/stream` | user | SSE. `notification` (own only), `channel-changed` (`{ channelId, enabled }`, to everyone) |
| `GET /api/me` | user | The user, with `contacts` |
| `GET /api/me/contacts` | user | `{ [channelId]: destination }` |
| `PUT /api/me/contacts` | user | Merges: channels not in the body are kept; `""` or `null` clears one. Each destination is validated by its channel |
| `GET /api/rules`, `GET /api/rules/:id` | user | Own rules only |
| `POST /api/rules` | user | Requires `category` and a non-empty `channelIds`. Optional: `name`, `keywords`, `minSeverity` (default 1), `enabled` (default true). Markets only: `symbol`, `minPercentMove` (dropped for other categories) |
| `PUT /api/rules/:id` | user | Full replacement, same body as POST; `id` and `userId` are never taken from the body |
| `DELETE /api/rules/:id` | user | 204 |
| `GET /api/notifications` | user | Own history, newest first. Each has `ruleName` and an `event` summary copied at delivery time |
| `GET /api/admin/channels` | admin | Every registered channel with `enabled` |
| `PATCH /api/admin/channels/:id` | admin | `{ "enabled": boolean }`; also pushes `channel-changed` over SSE |

Another user's rule answers 404, the same as a missing one, so ids don't leak. Non-admins get 403 on every `/api/admin/*` route.

## Versions

Checked together at scaffold time (2026-09-29):

- Shared: Node 26.8, npm 11.19, Vitest 5.0.
- Server: TypeScript 7.0, Express 5.2, tsx 4.23.
- Web: Angular 22.2 (zoneless, Vitest via `@angular/build:unit-test` with jsdom 30.1), TypeScript 6.0 (Angular 22 requires `>=6.0 <6.1`, so `web` has its own copy), Tailwind CSS 4.3 via `@tailwindcss/postcss`.
- No component library. PrimeNG 22 was dropped: from v22 it needs a licence key under a commercial/community licence (21.x was MIT).

## Web structure (`web/src/app`)

- `core/api/`: one abstract class per resource (`UsersApi`, `ChannelsApi`, `RulesApi`, `NotificationsApi`) plus its `Http*` implementation, bound in `provideHttpApi()`. Components inject the abstract class; tests provide fakes.
- `core/session.service.ts`: the current demo user (signals). `core/demo-user.interceptor.ts` sends it as `X-Demo-User`.
- `core/realtime.service.ts`: one SSE connection per demo user, exposed as signals (`status`, `notifications`, `lastChannelChange`). `EVENT_SOURCE_FACTORY` lets tests pass a fake `EventSource`.
- `core/admin.guard.ts`: `canMatch` guard for `/admin/*`.
- `pages/`: one lazy-loaded component per route.
- `testing/fakes.ts`: fake APIs and a fake `EventSource`.
- Design tokens are in `src/styles.css` (`@theme`).

## Adding a channel

Implement `NotificationChannel` (`server/src/ports/index.ts`) and add one `registry.register(...)` line in `server/src/channels.ts`. It then appears in `GET /api/channels` and is dispatched to with no other changes.
