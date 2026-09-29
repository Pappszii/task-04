import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../container.js';
import { StubChannel } from '../testing/fixtures.js';
import { createApp } from './app.js';

let server: Server | undefined;

async function start(container = createContainer()): Promise<string> {
  const app = createApp(container);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

describe('GET /api/channels', () => {
  it('lists registered channels with what each needs', async () => {
    const base = await start();

    const body = await (await fetch(`${base}/api/channels`)).json();

    expect(body).toEqual([
      { id: 'email', displayName: 'Email', destinationKind: 'email address' },
      { id: 'slack', displayName: 'Slack', destinationKind: 'Slack handle' },
    ]);
  });

  it('includes a newly registered channel and hides a disabled one', async () => {
    const container = createContainer();
    container.registry.register(new StubChannel('webhook'));
    await container.channelSettings.setEnabled('slack', false);
    const base = await start(container);

    const body = (await (await fetch(`${base}/api/channels`)).json()) as { id: string }[];

    expect(body.map((c) => c.id)).toEqual(['email', 'webhook']);
  });
});

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const base = await start();
    expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ status: 'ok' });
  });
});
