import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './event-bus.js';

describe('EventBus', () => {
  it('delivers to every subscriber and awaits async handlers', async () => {
    const bus = new EventBus<number>();
    const seen: string[] = [];
    bus.subscribe(async (n) => {
      await Promise.resolve();
      seen.push(`a${n}`);
    });
    bus.subscribe((n) => {
      seen.push(`b${n}`);
    });

    await bus.publish(1);
    expect(seen.sort()).toEqual(['a1', 'b1']);
  });

  it('keeps delivering when a handler throws and reports the error', async () => {
    const onError = vi.fn();
    const bus = new EventBus<number>(onError);
    const good = vi.fn();
    bus.subscribe(() => {
      throw new Error('bad handler');
    });
    bus.subscribe(good);

    await bus.publish(1);
    expect(good).toHaveBeenCalledWith(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('stops delivering after unsubscribe', async () => {
    const bus = new EventBus<number>();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe(handler);
    unsubscribe();

    await bus.publish(1);
    expect(handler).not.toHaveBeenCalled();
  });
});
