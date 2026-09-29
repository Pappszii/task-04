import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type StatusTone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

const TONES: Record<StatusTone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-accent-soft text-accent',
  neutral: 'bg-canvas text-muted ring-1 ring-line ring-inset',
};

/** A small pill. The projected text carries the meaning; the colour only reinforces it. */
@Component({
  selector: 'app-status-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
    '[class]': 'toneClasses()',
  },
  template: `<ng-content />`,
})
export class StatusTag {
  readonly tone = input.required<StatusTone>();
  protected readonly toneClasses = computed(() => TONES[this.tone()]);
}
