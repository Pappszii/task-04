import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AvailableChannels } from '../../core/available-channels';
import { FakeEventSource, httpError, WEBHOOK } from '../../testing/fakes';
import { actAs, type Fakes, query, setupFakes, textOf } from '../../testing/setup';
import { ToastService } from '../../ui/toast.service';
import { AdminChannelsPage } from './admin-channels-page';

describe('AdminChannelsPage (AC13)', () => {
  let fakes: Fakes;

  beforeEach(() => {
    fakes = setupFakes();
  });

  const render = async () => {
    await actAs('u-admin');
    const fixture = TestBed.createComponent(AdminChannelsPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const stable = () => fixture.whenStable();
    /** Each row as its non-empty cells, e.g. "Email email | email address | Enabled". */
    const rows = () =>
      [...el.querySelectorAll('tbody tr')].map((row) =>
        textOf(row, 'th, td')
          .filter((cell) => cell !== '')
          .join(' | '),
      );
    const switchFor = (name: string) => query<HTMLInputElement>(el, `input[aria-label="Enabled: ${name}"]`);
    const flip = async (name: string) => {
      switchFor(name).click();
      await stable();
    };
    return { fixture, el, stable, rows, switchFor, flip };
  };

  const toasts = () => TestBed.inject(ToastService).toasts().map((t) => `${t.tone}: ${t.message}`);

  it('lists every registered channel, including disabled ones, with its status as text', async () => {
    fakes.channels.channels[1]!.enabled = false;
    const page = await render();

    expect(page.rows()).toEqual([
      'Email email | email address | Enabled',
      'Slack slack | Slack handle | Disabled',
    ]);
    expect(page.switchFor('Email').checked).toBe(true);
    expect(page.switchFor('Slack').checked).toBe(false);
  });

  it('lists a newly registered channel with no page change (AC10)', async () => {
    fakes.channels.channels.push({ ...WEBHOOK, enabled: true });
    const page = await render();

    expect(page.rows().map((r) => r.split(' ')[0])).toEqual(['Email', 'Slack', 'Webhook']);
  });

  it('disables a channel', async () => {
    const page = await render();

    await page.flip('Slack');

    expect(fakes.channels.channels[1]!.enabled).toBe(false);
    expect(page.rows()[1]).toContain('Disabled');
    expect(page.switchFor('Slack').checked).toBe(false);
    expect(toasts()).toContain('success: Slack disabled.');
  });

  it('enables a disabled channel', async () => {
    fakes.channels.channels[0]!.enabled = false;
    const page = await render();

    await page.flip('Email');

    expect(fakes.channels.channels[0]!.enabled).toBe(true);
    expect(page.rows()[0]).toContain('Enabled');
    expect(toasts()).toContain('success: Email enabled.');
  });

  it('puts the switch back and explains when the change fails', async () => {
    fakes.channels.setEnabledError = httpError(403, { error: 'admin only' });
    const page = await render();

    await page.flip('Slack');

    expect(page.switchFor('Slack').checked).toBe(true);
    expect(page.rows()[1]).toContain('Enabled');
    expect(toasts()).toContain('error: Could not update Slack: admin only');
  });

  it('applies a change made elsewhere (SSE channel-changed) without refetching', async () => {
    const page = await render();

    FakeEventSource.latest().emit('channel-changed', { channelId: 'email', enabled: false });
    await page.stable();

    expect(page.rows()[0]).toContain('Disabled');
    expect(page.switchFor('Email').checked).toBe(false);
    expect(fakes.channels.listAllCalls).toBe(1);
  });

  it("disabling here removes the channel from users' picker once the server confirms over SSE", async () => {
    const page = await render();
    const available = TestBed.inject(AvailableChannels);
    await page.stable();
    expect(available.list().map((c) => c.id)).toEqual(['email', 'slack']);

    await page.flip('Slack');
    FakeEventSource.latest().emit('channel-changed', { channelId: 'slack', enabled: false });
    await page.stable();

    expect(available.list().map((c) => c.id)).toEqual(['email']);
  });

  it('shows the error and retries', async () => {
    fakes.channels.listAllError = httpError(500, { error: 'internal error' });
    const page = await render();

    expect(query(page.el, '[role="alert"]').textContent).toContain('Could not load the channels.');

    fakes.channels.listAllError = null;
    query<HTMLButtonElement>(page.el, '[role="alert"] button').click();
    await page.stable();

    expect(page.rows()).toHaveLength(2);
  });

  it('explains an empty registry', async () => {
    fakes.channels.channels = [];
    const page = await render();

    expect(page.el.textContent).toContain('No channels registered');
  });
});
