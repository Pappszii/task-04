import { createMockEventSources } from './adapters/mock-event-sources.js';
import { createContainer } from './container.js';
import { createApp } from './http/app.js';

// Not PORT: `ng serve` also reads PORT, and in dev both run side by side (the web proxy reads API_PORT too).
const port = Number(process.env['API_PORT'] ?? 3000);
const intervalMs = Number(process.env['EVENT_INTERVAL_MS'] ?? 15_000);

const container = createContainer({ eventSources: createMockEventSources({ intervalMs }) });
const app = createApp(container);

for (const source of container.eventSources) source.start();

app.listen(port, () => {
  console.info(`world-alerts server listening on http://localhost:${port}`);
});
