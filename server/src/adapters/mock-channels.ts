import type {
  ChannelMessage,
  DeliveryResult,
  DestinationValidation,
  NotificationChannel,
} from '../ports/index.js';

export type Log = (message: string, payload: Record<string, unknown>) => void;

const consoleLog: Log = (message, payload) => console.info(message, JSON.stringify(payload));

/** Builds the payload a real email provider would receive. Logs it; makes no network call. */
export class MockEmailChannel implements NotificationChannel {
  readonly id = 'email';
  readonly displayName = 'Email';
  readonly destinationKind = 'email address';

  constructor(private readonly log: Log = consoleLog) {}

  validateDestination(destination: string): DestinationValidation {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)
      ? { valid: true }
      : { valid: false, reason: 'expected an email address' };
  }

  async send(message: ChannelMessage): Promise<DeliveryResult> {
    const payload = {
      to: message.destination,
      subject: message.subject,
      text: message.body,
      headers: { 'X-Event-Id': message.event.id },
    };
    this.log('[mock-email] would send', payload);
    return { ok: true, payload };
  }
}

/** Builds the payload a real Slack webhook would receive. Logs it; makes no network call. */
export class MockSlackChannel implements NotificationChannel {
  readonly id = 'slack';
  readonly displayName = 'Slack';
  readonly destinationKind = 'Slack handle';

  constructor(private readonly log: Log = consoleLog) {}

  validateDestination(destination: string): DestinationValidation {
    return /^[@#][\w.-]+$/.test(destination)
      ? { valid: true }
      : { valid: false, reason: 'expected a handle like @alice or #alerts' };
  }

  async send(message: ChannelMessage): Promise<DeliveryResult> {
    const payload = {
      channel: message.destination,
      text: `*${message.subject}*\n${message.body}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: message.subject } },
        { type: 'section', text: { type: 'mrkdwn', text: message.body } },
      ],
    };
    this.log('[mock-slack] would send', payload);
    return { ok: true, payload };
  }
}
