import { describe, expect, it } from 'vitest';
import { StubChannel } from '../testing/fixtures.js';
import { ChannelRegistry } from './channel-registry.js';

describe('ChannelRegistry', () => {
  it('returns registered channels by id and lists them in order', () => {
    const registry = new ChannelRegistry();
    const a = new StubChannel('a');
    const b = new StubChannel('b');
    registry.register(a);
    registry.register(b);

    expect(registry.get('a')).toBe(a);
    expect(registry.get('missing')).toBeUndefined();
    expect(registry.list()).toEqual([a, b]);
  });

  it('rejects a duplicate id', () => {
    const registry = new ChannelRegistry();
    registry.register(new StubChannel('a'));
    expect(() => registry.register(new StubChannel('a'))).toThrow(/already registered/);
  });
});
