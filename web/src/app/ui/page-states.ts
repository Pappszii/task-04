import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p role="status" class="flex items-center gap-2 py-8 text-sm text-muted">
      <span
        class="size-4 animate-spin rounded-full border-2 border-line border-t-accent"
        aria-hidden="true"
      ></span>
      {{ label() }}
    </p>
  `,
})
export class LoadingState {
  readonly label = input('Loading…');
}

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-lg border border-dashed border-line bg-surface px-6 py-10 text-center">
      <p class="font-medium">{{ title() }}</p>
      <div class="mt-1 text-sm text-muted"><ng-content /></div>
    </div>
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
}

@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="alert" class="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm">
      <p class="font-medium text-danger">{{ title() }}</p>
      @for (message of messages(); track $index) {
        <p class="mt-1 text-danger">{{ message }}</p>
      }
      <button type="button" class="btn btn-secondary mt-3" (click)="retry.emit()">Try again</button>
    </div>
  `,
})
export class ErrorState {
  readonly title = input('Something went wrong.');
  readonly messages = input<string[]>([]);
  readonly retry = output<void>();
}
