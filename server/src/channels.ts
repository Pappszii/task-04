import { MockEmailChannel, MockSlackChannel } from './adapters/mock-channels.js';
import type { ChannelRegistry } from './services/channel-registry.js';

/** The single place channels are wired in. Adding a channel means one more `register()` line. */
export function registerChannels(registry: ChannelRegistry): void {
  registry.register(new MockEmailChannel());
  registry.register(new MockSlackChannel());
}
