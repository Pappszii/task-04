import type { RequestHandler } from 'express';
import type { Container } from '../../container.js';
import { currentUser } from '../identity.js';

const HEARTBEAT_MS = 25_000;

/**
 * `GET /api/stream`: Server-Sent Events. Mount behind `identify({ allowQuery: true })`.
 * - `notification`: a new notification, only ever the connected user's own.
 * - `channel-changed`: `{ channelId, enabled }` after an admin toggles a channel, sent to everyone.
 */
export function streamHandler(container: Container): RequestHandler {
  return (_req, res) => {
    const user = currentUser(res);
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Subscribe before the first write, so nothing published after the client sees headers is missed.
    const unsubscribers = [
      container.notificationBus.subscribe((notification) => {
        if (notification.userId === user.id) send('notification', notification);
      }),
      container.channelEvents.subscribe((state) => send('channel-changed', state)),
    ];
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), HEARTBEAT_MS);
    heartbeat.unref();

    res.on('close', () => {
      clearInterval(heartbeat);
      for (const unsubscribe of unsubscribers) unsubscribe();
    });

    res.write('retry: 3000\n\n');
  };
}
