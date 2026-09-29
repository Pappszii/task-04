import type { AlertRule, User, WorldEvent } from '../domain/index.js';
import type {
  ChannelMessage,
  DeliveryResult,
  DestinationValidation,
  NotificationChannel,
} from '../ports/index.js';

export function makeEvent(overrides: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id: 'e-1',
    category: 'disasters',
    title: 'Earthquake near coast',
    summary: 'Magnitude 6.8 earthquake reported offshore.',
    severity: 4,
    tags: ['earthquake', 'pacific'],
    occurredAt: '2026-01-01T00:00:00.000Z',
    source: 'test',
    ...overrides,
  };
}

export function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: 'r-1',
    userId: 'u-1',
    name: 'Test rule',
    category: 'disasters',
    keywords: [],
    minSeverity: 1,
    channelIds: ['stub'],
    enabled: true,
    ...overrides,
  };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    name: 'Test User',
    role: 'user',
    contacts: { stub: 'dest-1' },
    ...overrides,
  };
}

/** A channel that records what it was asked to send. `behavior` controls the outcome. */
export class StubChannel implements NotificationChannel {
  readonly displayName: string;
  readonly destinationKind = 'test destination';
  readonly sent: ChannelMessage[] = [];

  constructor(
    readonly id = 'stub',
    private readonly behavior: 'ok' | 'throw' | 'fail' = 'ok',
  ) {
    this.displayName = `Stub ${id}`;
  }

  validateDestination(destination: string): DestinationValidation {
    return destination.startsWith('bad')
      ? { valid: false, reason: 'starts with bad' }
      : { valid: true };
  }

  async send(message: ChannelMessage): Promise<DeliveryResult> {
    this.sent.push(message);
    if (this.behavior === 'throw') throw new Error('boom');
    if (this.behavior === 'fail') return { ok: false, error: 'rejected by provider' };
    return { ok: true, payload: { to: message.destination } };
  }
}
