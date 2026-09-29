import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastOutlet } from './toast-outlet';
import { ToastService } from './toast.service';

// Fake timers also freeze Angular's own scheduling, so these tests render with detectChanges().
describe('ToastService and ToastOutlet', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const render = () => {
    const fixture = TestBed.createComponent(ToastOutlet);
    const region = () => (fixture.nativeElement as HTMLElement).querySelector('[aria-live="polite"]');
    return { fixture, region, toasts: TestBed.inject(ToastService) };
  };

  it('shows toasts in a polite live region and dismisses them after a few seconds', () => {
    const { fixture, region, toasts } = render();

    toasts.success('Saved.');
    toasts.error('Failed.');
    fixture.detectChanges();

    expect(region()?.textContent).toContain('Saved.');
    expect(region()?.textContent).toContain('Failed.');

    vi.advanceTimersByTime(3999);
    expect(toasts.toasts()).toHaveLength(2);
    vi.advanceTimersByTime(1);
    fixture.detectChanges();

    expect(toasts.toasts()).toEqual([]);
    expect(region()?.textContent?.trim()).toBe('');
  });

  it('dismisses a toast from its button', () => {
    const { fixture, region, toasts } = render();
    toasts.success('Saved.');
    fixture.detectChanges();

    region()?.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')?.click();

    expect(toasts.toasts()).toEqual([]);
  });
});
