import { describe, expect, it } from 'vitest';
import { MockEmailChannel, MockSlackChannel } from '../adapters/mock-channels.js';
import { ChannelRegistry } from '../services/channel-registry.js';
import { applyContactUpdates, parseContactsInput } from './contacts-input.js';

const registry = new ChannelRegistry();
registry.register(new MockEmailChannel(() => {}));
registry.register(new MockSlackChannel(() => {}));

describe('parseContactsInput', () => {
  it('accepts valid destinations, trimmed', () => {
    expect(parseContactsInput({ email: ' a@b.co ', slack: '@alice' }, registry)).toEqual({
      ok: true,
      updates: { email: 'a@b.co', slack: '@alice' },
    });
  });

  it('turns blank strings and null into clears', () => {
    expect(parseContactsInput({ email: '  ', slack: null }, registry)).toEqual({
      ok: true,
      updates: { email: null, slack: null },
    });
  });

  it('accepts an empty object as no change', () => {
    expect(parseContactsInput({}, registry)).toEqual({ ok: true, updates: {} });
  });

  it("validates each destination with its own channel's rules", () => {
    const result = parseContactsInput({ email: 'not-an-email', slack: 'alice' }, registry);

    expect(result).toEqual({
      ok: false,
      errors: ['Email: expected an email address', 'Slack: expected a handle like @alice or #alerts'],
    });
  });

  it.each([
    ['a non-object body', ['x'], /JSON object/],
    ['an unknown channel', { fax: '123' }, /unknown channel: fax/],
    ['a non-string destination', { email: 5 }, /Email: destination must be a string/],
  ])('rejects %s', (_label, body, message) => {
    const result = parseContactsInput(body, registry);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(message);
  });
});

describe('applyContactUpdates', () => {
  it('sets, clears, and leaves unmentioned channels alone', () => {
    const current = { email: 'old@x.co', slack: '@old', webhook: 'https://keep' };

    expect(applyContactUpdates(current, { email: 'new@x.co', slack: null })).toEqual({
      email: 'new@x.co',
      webhook: 'https://keep',
    });
    expect(current).toEqual({ email: 'old@x.co', slack: '@old', webhook: 'https://keep' });
  });
});
