import { createContainer } from './container.js';
import { createApp } from './http/app.js';

const port = Number(process.env['PORT'] ?? 3000);
const app = createApp(createContainer());

app.listen(port, () => {
  console.info(`world-alerts server listening on http://localhost:${port}`);
});
