import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="status"
      aria-live="polite"
      class="pointer-events-none fixed inset-x-4 bottom-4 z-20 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:w-80"
    >
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg"
          [class]="
            toast.tone === 'success'
              ? 'border-success/30 bg-success-soft text-success'
              : 'border-danger/30 bg-danger-soft text-danger'
          "
        >
          <p class="flex-1">{{ toast.message }}</p>
          <button
            type="button"
            class="-m-1 rounded p-1 leading-none opacity-70 hover:opacity-100"
            aria-label="Dismiss"
            (click)="toasts.dismiss(toast.id)"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastOutlet {
  protected readonly toasts = inject(ToastService);
}
