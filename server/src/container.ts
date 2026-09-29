import {
  InMemoryAlertRuleRepository,
  InMemoryChannelSettingsRepository,
  InMemoryNotificationRepository,
  InMemoryUserRepository,
} from './adapters/in-memory-repositories.js';
import { seedRules, seedUsers } from './adapters/seed.js';
import { registerChannels } from './channels.js';
import type { Notification, WorldEvent } from './domain/index.js';
import { AlertDispatcher } from './services/alert-dispatcher.js';
import { ChannelRegistry } from './services/channel-registry.js';
import { EventBus } from './services/event-bus.js';

export interface Container {
  users: InMemoryUserRepository;
  rules: InMemoryAlertRuleRepository;
  notifications: InMemoryNotificationRepository;
  channelSettings: InMemoryChannelSettingsRepository;
  registry: ChannelRegistry;
  /** Publish a world event here to run it through matching and delivery. */
  worldEvents: EventBus<WorldEvent>;
  /** Every stored notification is published here (the SSE layer subscribes in a later step). */
  notificationBus: EventBus<Notification>;
  dispatcher: AlertDispatcher;
}

export function createContainer(): Container {
  const users = new InMemoryUserRepository(seedUsers());
  const rules = new InMemoryAlertRuleRepository(seedRules());
  const notifications = new InMemoryNotificationRepository();
  const channelSettings = new InMemoryChannelSettingsRepository();

  const registry = new ChannelRegistry();
  registerChannels(registry);

  const logError = (error: unknown) => console.error('[bus] handler failed', error);
  const worldEvents = new EventBus<WorldEvent>(logError);
  const notificationBus = new EventBus<Notification>(logError);

  const dispatcher = new AlertDispatcher({
    rules,
    users,
    notifications,
    channelSettings,
    registry,
    onNotification: (notification) => notificationBus.publish(notification),
  });
  worldEvents.subscribe(async (event) => {
    await dispatcher.dispatch(event);
  });

  return {
    users,
    rules,
    notifications,
    channelSettings,
    registry,
    worldEvents,
    notificationBus,
    dispatcher,
  };
}
