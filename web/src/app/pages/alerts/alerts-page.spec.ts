import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionService } from '../../core/session.service';
import { FakeEventSource, httpError, makeRule, WEBHOOK } from '../../testing/fakes';
import { actAs, type Fakes, query, setupFakes, setValue, textOf } from '../../testing/setup';
import { ToastService } from '../../ui/toast.service';
import { AlertsPage } from './alerts-page';

describe('AlertsPage', () => {
  let fakes: Fakes;

  beforeEach(() => {
    fakes = setupFakes();
    fakes.rules.rules = [
      makeRule({ id: 'r-1', name: 'Serious disasters', channelIds: ['email', 'slack'] }),
      makeRule({
        id: 'r-2',
        name: 'Big ACME moves',
        category: 'markets',
        minSeverity: 2,
        symbol: 'ACME',
        minPercentMove: 3,
        channelIds: ['slack'],
      }),
    ];
  });

  const render = async () => {
    await actAs('u-alice');
    const fixture = TestBed.createComponent(AlertsPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const stable = () => fixture.whenStable();
    const click = async (selector: string) => {
      query<HTMLElement>(el, selector).click();
      await stable();
    };
    const pickerLabels = () =>
      [...el.querySelectorAll<HTMLInputElement>('dialog[open] fieldset input[type="checkbox"]')].map((input) =>
        input.labels?.[0]?.textContent?.trim(),
      );
    return { fixture, el, stable, click, pickerLabels };
  };

  const toasts = () => TestBed.inject(ToastService).toasts().map((t) => `${t.tone}: ${t.message}`);

  it("lists the user's alerts with their conditions and channels", async () => {
    const { el } = await render();

    expect(textOf(el, 'li h2')).toEqual(['Serious disasters', 'Big ACME moves']);
    expect(el.textContent).toContain('Severity 2+ · ACME · moves of 3% or more');
    expect(textOf(el, 'li p.text-sm:last-child')).toEqual(['Sends to:Email, Slack', 'Sends to:Slack']);
  });

  it('marks a channel that is no longer offered', async () => {
    fakes.channels.channels[1]!.enabled = false;
    const { el } = await render();

    expect(textOf(el, 'li p.text-sm:last-child')).toEqual([
      'Sends to:Email, slack (unavailable)',
      'Sends to:slack (unavailable)',
    ]);
  });

  it('shows an empty state with a way to create the first alert', async () => {
    fakes.rules.rules = [];
    const { el, click } = await render();

    expect(el.textContent).toContain('No alerts yet');
    await click('app-empty-state button');

    expect(el.querySelector('dialog[open] h2')?.textContent).toContain('New alert');
  });

  it('shows the error and retries', async () => {
    fakes.rules.listError = httpError(500, { error: 'internal error' });
    const { el, click } = await render();

    expect(query(el, '[role="alert"]').textContent).toContain('Could not load your alerts.');
    expect(query(el, '[role="alert"]').textContent).toContain('internal error');

    fakes.rules.listError = null;
    await click('[role="alert"] button');

    expect(textOf(el, 'li h2')).toEqual(['Serious disasters', 'Big ACME moves']);
  });

  describe('channel picker (AC10, AC13)', () => {
    it('renders the channels the API returns, including a newly added one', async () => {
      fakes.channels.channels.push({ ...WEBHOOK, enabled: true });
      const { click, pickerLabels } = await render();

      await click('button.btn-primary');

      expect(pickerLabels()).toEqual(['Email', 'Slack', 'Webhook']);
    });

    it('drops a channel as soon as an admin disables it, without a refresh', async () => {
      const { click, stable, pickerLabels } = await render();
      await click('button.btn-primary');
      expect(pickerLabels()).toEqual(['Email', 'Slack']);

      fakes.channels.channels[1]!.enabled = false;
      FakeEventSource.latest().emit('channel-changed', { channelId: 'slack', enabled: false });
      await stable();

      expect(pickerLabels()).toEqual(['Email']);
    });
  });

  it('creates an alert from the dialog and adds it to the list', async () => {
    const { el, click, stable } = await render();
    await click('button.btn-primary');

    setValue(el, '#alert-category', 'news');
    setValue(el, '#alert-name', 'Election news');
    await stable();
    await click('dialog[open] fieldset input[type="checkbox"]');
    await click('dialog[open] button[type="submit"]');

    expect(el.querySelector('dialog[open]')).toBeNull();
    expect(textOf(el, 'li h2')).toEqual(['Serious disasters', 'Big ACME moves', 'Election news']);
    expect(toasts()).toContain('success: Alert "Election news" created.');
  });

  it('edits an alert in place', async () => {
    const { el, click, stable } = await render();
    await click('button[aria-label="Edit Serious disasters"]');

    setValue(el, '#alert-name', 'Big disasters');
    await stable();
    await click('dialog[open] button[type="submit"]');

    expect(textOf(el, 'li h2')).toEqual(['Big disasters', 'Big ACME moves']);
    expect(fakes.rules.updated[0]?.id).toBe('r-1');
  });

  it('closing the dialog discards the form', async () => {
    const { el, click } = await render();
    await click('button.btn-primary');
    expect(el.querySelector('app-alert-form')).not.toBeNull();

    await click('dialog[open] button.btn-secondary');

    expect(el.querySelector('dialog[open]')).toBeNull();
    expect(el.querySelector('app-alert-form')).toBeNull();
  });

  describe('active switch (AC2)', () => {
    it('pauses an alert', async () => {
      const { el, click } = await render();

      await click('input[aria-label="Active: Serious disasters"]');

      expect(fakes.rules.updated).toEqual([
        { id: 'r-1', input: expect.objectContaining({ enabled: false, name: 'Serious disasters' }) },
      ]);
      expect(query(el, 'ul li:first-child').textContent).toContain('Paused');
      expect(toasts()).toContain('success: Alert "Serious disasters" paused.');
    });

    it('reverts the switch when the update fails', async () => {
      fakes.rules.saveError = httpError(500, { error: 'internal error' });
      const { el, click } = await render();

      await click('input[aria-label="Active: Serious disasters"]');

      expect(query<HTMLInputElement>(el, 'input[aria-label="Active: Serious disasters"]').checked).toBe(true);
      expect(toasts()).toContain('error: Could not update "Serious disasters": internal error');
    });
  });

  describe('delete (AC2)', () => {
    it('asks first, then deletes', async () => {
      const { el, click } = await render();
      await click('button[aria-label="Delete Serious disasters"]');

      expect(query(el, 'dialog[open]').textContent).toContain('"Serious disasters" will stop notifying you.');
      await click('dialog[open] button.btn-danger');

      expect(fakes.rules.deleted).toEqual(['r-1']);
      expect(textOf(el, 'li h2')).toEqual(['Big ACME moves']);
      expect(el.querySelector('dialog[open]')).toBeNull();
    });

    it('does nothing when cancelled', async () => {
      const { el, click } = await render();
      await click('button[aria-label="Delete Serious disasters"]');

      await click('dialog[open] button.btn-secondary');

      expect(fakes.rules.deleted).toEqual([]);
      expect(textOf(el, 'li h2')).toEqual(['Serious disasters', 'Big ACME moves']);
    });
  });

  it('reloads when the demo user changes', async () => {
    const { el, stable } = await render();
    expect(fakes.rules.listCalls).toBe(1);

    fakes.rules.rules = [makeRule({ id: 'r-9', userId: 'u-bob', name: "Bob's alert" })];
    TestBed.inject(SessionService).select('u-bob');
    await stable();

    expect(fakes.rules.listCalls).toBe(2);
    expect(textOf(el, 'li h2')).toEqual(["Bob's alert"]);
  });
});
