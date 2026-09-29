# task-04

World Alerts proof of concept. Design and acceptance criteria are in [CLAUDE.md](CLAUDE.md).

## Status

| Piece | State |
|---|---|
| `/server` domain, ports, in-memory repositories, seed data | done |
| `ChannelRegistry`, mock Email/Slack channels, `RuleMatcher`, `AlertDispatcher`, `EventBus` | done, unit tested |
| `GET /api/channels`, `GET /api/health` | done |
| Mock news / market / disaster sources on a timer, `POST /api/dev/events` | done, unit tested |
| Remaining REST routes, admin guard, SSE | not started (plan step 6) |
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

## Versions (server)

Node 26.8, npm 11.19, TypeScript 7.0, Express 5.2, Vitest 5.0, tsx 4.23.

## Adding a channel

Implement `NotificationChannel` (`server/src/ports/index.ts`) and add one `registry.register(...)` line in `server/src/channels.ts`. It then appears in `GET /api/channels` and is dispatched to with no other changes.
