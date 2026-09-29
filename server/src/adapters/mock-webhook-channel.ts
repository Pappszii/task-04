import type {
  ChannelMessage,
  DeliveryResult,
  DestinationValidation,
  NotificationChannel,
} from '../ports/index.js';
import type { Log } from './mock-channels.js';

/** Builds the request a real outgoing webhook would POST. Logs it; makes no network call. */
export class MockWebhookChannel implements NotificationChannel {
  readonly id = 'webhook';
  readonly displayName = 'Webhook';
  readonly destinationKind = 'HTTPS webhook URL';

  constructor(
    private readonly log: Log = (message, payload) => console.info(message, JSON.stringify(payload)),
  ) {}

  validateDestination(destination: string): DestinationValidation {
    let url: URL;
    try {
      url = new URL(destination);
    } catch {
      return { valid: false, reason: 'expected a URL like https://example.com/hooks/alerts' };
    }
    return url.protocol === 'https:' ? { valid: true } : { valid: false, reason: 'the URL must start with https://' };
  }

  async send(message: ChannelMessage): Promise<DeliveryResult> {
    const { event } = message;
    const payload = {
      method: 'POST',
      url: message.destination,
      headers: { 'content-type': 'application/json' },
      body: {
        type: 'world-alert',
        subject: message.subject,
        text: message.body,
        event: {
          id: event.id,
          category: event.category,
          title: event.title,
          severity: event.severity,
          occurredAt: event.occurredAt,
          source: event.source,
          ...(event.symbol !== undefined && { symbol: event.symbol }),
          ...(event.percentChange !== undefined && { percentChange: event.percentChange }),
        },
      },
    };
    this.log('[mock-webhook] would POST', payload);
    return { ok: true, payload };
  }
}
