# task-04

World Alerts proof of concept. Design and acceptance criteria are in [CLAUDE.md](CLAUDE.md).

## Status

| Piece | State |
|---|---|
| `/server` domain, ports, in-memory repositories, seed data | done |
| `ChannelRegistry`, mock Email/Slack channels, `RuleMatcher`, `AlertDispatcher`, `EventBus` | done, unit tested |
| `GET /api/channels`, `GET /api/health` | done |
| Mock event sources, `POST /api/dev/events` | not started (plan step 5) |
| Remaining REST routes, admin guard, SSE | not started (plan step 6) |
| `/web` Angular app | not started (plan steps 7-9) |

## Commands

```
npm install
npm run dev     # server on http://localhost:3000 (PORT to override)
npm test        # Vitest
npm run build
```

## Versions (server)

Node 26.8, npm 11.19, TypeScript 7.0, Express 5.2, Vitest 5.0, tsx 4.23.

## Adding a channel

Implement `NotificationChannel` (`server/src/ports/index.ts`) and add one `registry.register(...)` line in `server/src/channels.ts`. It then appears in `GET /api/channels` and is dispatched to with no other changes.
