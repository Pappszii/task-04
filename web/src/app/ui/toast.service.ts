import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const DURATION_MS = 4000;

/** Short feedback messages, shown by `<app-toast-outlet>` in the app shell. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  dismiss(id: number): void {
    this.toasts.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  private show(message: string, tone: ToastTone): void {
    const id = this.nextId++;
    this.toasts.update((toasts) => [...toasts, { id, message, tone }]);
    setTimeout(() => this.dismiss(id), DURATION_MS);
  }
}
