import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionService } from '../../core/session.service';
import { FakeEventSource, httpError, WEBHOOK } from '../../testing/fakes';
import { actAs, type Fakes, query, setupFakes, setValue, textOf } from '../../testing/setup';
import { ToastService } from '../../ui/toast.service';
import { SettingsPage } from './settings-page';

describe('SettingsPage', () => {
  let fakes: Fakes;

  beforeEach(() => {
    fakes = setupFakes();
  });

  const render = async (userId = 'u-bob') => {
    await actAs(userId);
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const stable = () => fixture.whenStable();
    const labels = () => textOf(el, 'form label');
    const value = (channelId: string) => query<HTMLInputElement>(el, `#contact-${channelId}`).value;
    const type = async (channelId: string, text: string) => {
      setValue(el, `#contact-${channelId}`, text);
      await stable();
    };
    const save = async () => {
      query<HTMLButtonElement>(el, 'button[type="submit"]').click();
      await stable();
    };
    return { fixture, el, stable, labels, value, type, save };
  };

  it('has one field per channel from the API, filled from the saved contacts', async () => {
    const page = await render();

    expect(page.labels()).toEqual(['Email', 'Slack']);
    expect(page.value('email')).toBe('bob@example.com');
    expect(page.value('slack')).toBe('');
    expect(query(page.el, '#contact-slack').getAttribute('placeholder')).toBe('Your Slack handle');
    expect(page.el.textContent).toContain('Not set: alerts sent to Slack are skipped.');
  });

  it('adds a field for a newly added channel (AC10)', async () => {
    fakes.channels.channels.push({ ...WEBHOOK, enabled: true });
    const page = await render();

    expect(page.labels()).toEqual(['Email', 'Slack', 'Webhook']);
  });

  it('saves every field, sending blanks as clears', async () => {
    const page = await render();
    await page.type('email', '  ');
    await page.type('slack', ' @bob ');

    await page.save();

    expect(fakes.users.contactUpdates).toEqual([{ email: null, slack: '@bob' }]);
    expect(fakes.users.contactsByUser['u-bob']).toEqual({ slack: '@bob' });
    expect(TestBed.inject(ToastService).toasts().map((t) => t.message)).toContain('Settings saved.');
  });

  it("puts the server's validation error on the matching field", async () => {
    fakes.users.contactsError = httpError(400, { errors: ['Email: expected an email address'] });
    const page = await render();
    await page.type('email', 'nope');

    await page.save();

    expect(query(page.el, '[role="alert"]').textContent).toContain('Email: expected an email address');
    expect(query(page.el, '#contact-email').getAttribute('aria-invalid')).toBe('true');
    expect(query(page.el, '#contact-email-hint').textContent?.trim()).toBe('Expected an email address.');
    expect(fakes.users.contactsByUser['u-bob']).toEqual({ email: 'bob@example.com' });
  });

  it('removes the field of a channel an admin disables, keeping unsaved edits elsewhere (AC13)', async () => {
    const page = await render();
    await page.type('email', 'bob2@example.com');

    fakes.channels.channels[1]!.enabled = false;
    FakeEventSource.latest().emit('channel-changed', { channelId: 'slack', enabled: false });
    await page.stable();

    expect(page.labels()).toEqual(['Email']);
    expect(page.value('email')).toBe('bob2@example.com');

    await page.save();
    expect(fakes.users.contactUpdates).toEqual([{ email: 'bob2@example.com' }]);
  });

  it('refills the form for a new demo user', async () => {
    const page = await render();
    await page.type('email', 'unsaved@example.com');

    TestBed.inject(SessionService).select('u-alice');
    await page.stable();

    expect(page.value('email')).toBe('alice@example.com');
    expect(page.value('slack')).toBe('@alice');
  });

  it('shows the error and retries', async () => {
    fakes.users.meError = httpError(500, { error: 'internal error' });
    const page = await render();

    expect(query(page.el, '[role="alert"]').textContent).toContain('Could not load your settings.');

    fakes.users.meError = null;
    query<HTMLButtonElement>(page.el, '[role="alert"] button').click();
    await page.stable();

    expect(page.labels()).toEqual(['Email', 'Slack']);
  });

  it('explains when there is no channel to configure', async () => {
    fakes.channels.channels.forEach((c) => (c.enabled = false));
    const page = await render();

    expect(page.el.textContent).toContain('No channels available');
  });
});
