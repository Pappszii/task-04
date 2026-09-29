# task-04

World Alerts proof of concept. Design and acceptance criteria are in [CLAUDE.md](CLAUDE.md).

## Status

| Piece | State |
|---|---|
| `/server` domain, ports, in-memory repositories, seed data | done |
| `ChannelRegistry`, mock Email/Slack channels, `RuleMatcher`, `AlertDispatcher`, `EventBus` | done, unit tested |
| Mock news / market / disaster sources on a timer, `POST /api/dev/events` | done, unit tested |
| Full REST API, demo identity, admin guard, SSE stream | done, integration tested |
| `/web` Angular app | not started (plan steps 7-9) |

## Commands

```
npm install
npm run dev     # server on http://localhost:3000 (PORT to override)
npm test        # Vitest
npm run build
```

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

## Versions (server)

Node 26.8, npm 11.19, TypeScript 7.0, Express 5.2, Vitest 5.0, tsx 4.23.

## Adding a channel

Implement `NotificationChannel` (`server/src/ports/index.ts`) and add one `registry.register(...)` line in `server/src/channels.ts`. It then appears in `GET /api/channels` and is dispatched to with no other changes.
