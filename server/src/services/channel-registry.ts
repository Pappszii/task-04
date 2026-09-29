import type { NotificationChannel } from '../ports/index.js';

export class ChannelRegistry {
  private readonly channels = new Map<string, NotificationChannel>();

  register(channel: NotificationChannel): void {
    if (this.channels.has(channel.id)) {
      throw new Error(`Channel "${channel.id}" is already registered`);
    }
    this.channels.set(channel.id, channel);
  }

  get(id: string): NotificationChannel | undefined {
    return this.channels.get(id);
  }

  list(): NotificationChannel[] {
    return [...this.channels.values()];
  }
}
