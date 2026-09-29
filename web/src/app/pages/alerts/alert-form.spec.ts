import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlertRule, Channel } from '../../core/models';
import { EMAIL, httpError, makeRule, SLACK, WEBHOOK } from '../../testing/fakes';
import { type Fakes, query, setupFakes, setValue, textOf } from '../../testing/setup';
import { AlertForm } from './alert-form';

describe('AlertForm', () => {
  let fakes: Fakes;

  beforeEach(() => {
    fakes = setupFakes();
  });

  const render = async (options: { channels?: Channel[]; rule?: AlertRule } = {}) => {
    const fixture = TestBed.createComponent(AlertForm);
    fixture.componentRef.setInput('channels', options.channels ?? [EMAIL, SLACK]);
    if (options.rule) fixture.componentRef.setInput('rule', options.rule);
    const saved = vi.fn<(rule: AlertRule) => void>();
    const cancelled = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    fixture.componentInstance.cancelled.subscribe(cancelled);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const submit = async () => {
      query<HTMLButtonElement>(el, 'button[type="submit"]').click();
      await fixture.whenStable();
    };
    const checkChannel = async (label: string) => {
      const box = [...el.querySelectorAll<HTMLInputElement>('fieldset input[type="checkbox"]')].find(
        (input) => input.labels?.[0]?.textContent?.trim() === label,
      );
      if (!box) throw new Error(`no channel checkbox labelled ${label}`);
      box.click();
      await fixture.whenStable();
    };
    const change = async (selector: string, value: string) => {
      setValue(el, selector, value);
      await fixture.whenStable();
    };
    const channelLabels = () =>
      [...el.querySelectorAll<HTMLInputElement>('fieldset input[type="checkbox"]')].map(
        (input) => input.labels?.[0]?.textContent?.trim(),
      );
    const errors = () => textOf(el, 'p.text-danger');

    return { fixture, el, saved, cancelled, submit, checkChannel, change, channelLabels, errors };
  };

  describe('validation (AC1)', () => {
    it('blocks saving with no category and no channel, and says why', async () => {
      const form = await render();

      await form.submit();

      expect(form.errors()).toEqual(['Choose a category.', 'Select at least one channel.']);
      expect(fakes.rules.created).toEqual([]);
      expect(form.saved).not.toHaveBeenCalled();
      expect(query(form.el, '#alert-category').getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement?.id).toBe('alert-category');
    });

    it('blocks saving with a category but no channel', async () => {
      const form = await render();
      await form.change('#alert-category', 'news');

      await form.submit();

      expect(form.errors()).toEqual(['Select at least one channel.']);
      expect(fakes.rules.created).toEqual([]);
    });

    it('blocks saving with a channel but no category', async () => {
      const form = await render();
      await form.checkChannel('Email');

      await form.submit();

      expect(form.errors()).toEqual(['Choose a category.']);
      expect(fakes.rules.created).toEqual([]);
    });

    it('does not show errors before the user has tried anything', async () => {
      const form = await render();

      expect(form.errors()).toEqual([]);
    });

    it('clears the channel error once one is checked', async () => {
      const form = await render();
      await form.submit();

      await form.checkChannel('Slack');

      expect(form.errors()).toEqual(['Choose a category.']);
    });

    it('rejects a negative minimum move for markets', async () => {
      const form = await render();
      await form.change('#alert-category', 'markets');
      await form.checkChannel('Email');
      await form.change('#alert-min-move', '-2');

      await form.submit();

      expect(form.errors()).toEqual(['Enter 0 or more.']);
      expect(fakes.rules.created).toEqual([]);
    });
  });

  it('renders one checkbox per channel it is given, so a new channel needs no form change (AC10)', async () => {
    const form = await render({ channels: [EMAIL, SLACK, WEBHOOK] });

    expect(form.channelLabels()).toEqual(['Email', 'Slack', 'Webhook']);
    expect(textOf(form.el, 'fieldset li p')).toContain('Sends to your webhook URL');
  });

  it('says so when no channel is available', async () => {
    const form = await render({ channels: [] });

    expect(form.el.textContent).toContain('No channels are available right now.');
  });

  it('creates an alert with the entered values', async () => {
    const form = await render();
    await form.change('#alert-category', 'disasters');
    await form.change('#alert-name', '  Quakes ');
    await form.change('#alert-keywords', ' quake, Tsunami ,, QUAKE');
    await form.change('#alert-severity', '4');
    await form.checkChannel('Slack');
    await form.checkChannel('Email');

    await form.submit();

    expect(fakes.rules.created).toEqual([
      {
        name: 'Quakes',
        category: 'disasters',
        keywords: ['quake', 'Tsunami'],
        minSeverity: 4,
        symbol: null,
        minPercentMove: null,
        channelIds: ['slack', 'email'],
        enabled: true,
      },
    ]);
    expect(form.saved).toHaveBeenCalledWith(expect.objectContaining({ id: 'r-new-1', name: 'Quakes' }));
  });

  it('only shows and sends market fields for the markets category (AC3)', async () => {
    const form = await render();
    await form.change('#alert-category', 'news');
    expect(form.el.querySelector('#alert-symbol')).toBeNull();

    await form.change('#alert-category', 'markets');
    await form.change('#alert-symbol', ' acme ');
    await form.change('#alert-min-move', '3.5');
    await form.checkChannel('Email');
    await form.submit();

    expect(fakes.rules.created[0]).toMatchObject({ category: 'markets', symbol: 'acme', minPercentMove: 3.5 });
  });

  it('drops market fields when the category is switched away from markets', async () => {
    const form = await render();
    await form.change('#alert-category', 'markets');
    await form.change('#alert-symbol', 'ACME');
    await form.change('#alert-min-move', '3');
    await form.change('#alert-category', 'news');
    await form.checkChannel('Email');

    await form.submit();

    expect(fakes.rules.created[0]).toMatchObject({ category: 'news', symbol: null, minPercentMove: null });
  });

  describe('editing', () => {
    const rule = makeRule({
      id: 'r-7',
      name: 'ACME moves',
      category: 'markets',
      keywords: ['earnings', 'merger'],
      minSeverity: 2,
      symbol: 'ACME',
      minPercentMove: 3,
      channelIds: ['slack'],
      enabled: false,
    });

    it('starts from the rule and saves with update()', async () => {
      fakes.rules.rules = [rule];
      const form = await render({ rule });

      expect(query<HTMLInputElement>(form.el, '#alert-name').value).toBe('ACME moves');
      expect(query<HTMLInputElement>(form.el, '#alert-keywords').value).toBe('earnings, merger');
      expect(query<HTMLInputElement>(form.el, '#alert-symbol').value).toBe('ACME');
      expect(query(form.el, 'h2').textContent).toContain('Edit alert');

      await form.change('#alert-severity', '5');
      await form.submit();

      expect(fakes.rules.created).toEqual([]);
      expect(fakes.rules.updated).toEqual([
        {
          id: 'r-7',
          input: {
            name: 'ACME moves',
            category: 'markets',
            keywords: ['earnings', 'merger'],
            minSeverity: 5,
            symbol: 'ACME',
            minPercentMove: 3,
            channelIds: ['slack'],
            enabled: false,
          },
        },
      ]);
      expect(form.saved).toHaveBeenCalledWith(expect.objectContaining({ id: 'r-7', minSeverity: 5 }));
    });

    it('keeps showing a selected channel that is no longer offered, so it can be removed (AC13)', async () => {
      const form = await render({ rule, channels: [EMAIL] });

      expect(form.channelLabels()).toEqual(['Email', 'slack']);
      expect(textOf(form.el, 'fieldset li p')).toContain('Not available right now. Uncheck to remove it.');
    });
  });

  it('shows server errors and stays open', async () => {
    fakes.rules.saveError = httpError(400, { errors: ['unknown channel: fax'] });
    const form = await render();
    await form.change('#alert-category', 'news');
    await form.checkChannel('Email');

    await form.submit();

    expect(query(form.el, '[role="alert"]').textContent).toContain('unknown channel: fax');
    expect(form.saved).not.toHaveBeenCalled();
    expect(query<HTMLButtonElement>(form.el, 'button[type="submit"]').disabled).toBe(false);
  });

  it('emits cancelled from the Cancel button', async () => {
    const form = await render();

    query<HTMLButtonElement>(form.el, 'button[type="button"]').click();

    expect(form.cancelled).toHaveBeenCalledTimes(1);
    expect(fakes.rules.created).toEqual([]);
  });
});
