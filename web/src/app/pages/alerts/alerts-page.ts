import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { apiErrorMessages } from '../../core/api/api-errors';
import { RulesApi } from '../../core/api/rules-api';
import { AvailableChannels } from '../../core/available-channels';
import { BusySet } from '../../core/busy-set';
import { type AlertRule, CATEGORY_LABELS } from '../../core/models';
import { toRuleInput } from '../../core/rules';
import { SessionService } from '../../core/session.service';
import { EmptyState, ErrorState, LoadingState } from '../../ui/page-states';
import { StatusTag } from '../../ui/status-tag';
import { ToastService } from '../../ui/toast.service';
import { AlertForm } from './alert-form';

@Component({
  selector: 'app-alerts-page',
  imports: [AlertForm, EmptyState, ErrorState, LoadingState, StatusTag],
  templateUrl: './alerts-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsPage {
  private readonly api = inject(RulesApi);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  protected readonly channels = inject(AvailableChannels);

  /** The current demo user's rules; reloads when the user changes. */
  protected readonly rules = rxResource({
    params: () => this.session.currentUserId() ?? undefined,
    stream: () => this.api.list(),
  });

  private readonly formDialog = viewChild.required<ElementRef<HTMLDialogElement>>('formDialog');
  private readonly deleteDialog = viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<AlertRule | null>(null);
  protected readonly deleting = signal<AlertRule | null>(null);
  protected readonly busy = new BusySet();

  protected readonly categoryLabels = CATEGORY_LABELS;

  private readonly channelNames = computed(
    () => new Map(this.channels.list().map((c) => [c.id, c.displayName] as const)),
  );

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
    this.formDialog().nativeElement.showModal();
  }

  protected openEdit(rule: AlertRule): void {
    this.editing.set(rule);
    this.formOpen.set(true);
    this.formDialog().nativeElement.showModal();
  }

  protected closeForm(): void {
    this.formDialog().nativeElement.close();
  }

  /** Runs on every close, including Escape. */
  protected onFormClosed(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected onSaved(saved: AlertRule): void {
    const isNew = this.editing() === null;
    this.upsert(saved);
    this.closeForm();
    this.toast.success(isNew ? `Alert "${saved.name}" created.` : `Alert "${saved.name}" saved.`);
  }

  protected toggleEnabled(rule: AlertRule, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const enabled = checkbox.checked;
    this.busy.add(rule.id);
    this.api.update(rule.id, { ...toRuleInput(rule), enabled }).subscribe({
      next: (saved) => {
        this.busy.delete(rule.id);
        this.upsert(saved);
        this.toast.success(`Alert "${saved.name}" ${saved.enabled ? 'turned on' : 'paused'}.`);
      },
      error: (error: unknown) => {
        this.busy.delete(rule.id);
        checkbox.checked = rule.enabled;
        this.toast.error(`Could not update "${rule.name}": ${apiErrorMessages(error).join(' ')}`);
      },
    });
  }

  protected askDelete(rule: AlertRule): void {
    this.deleting.set(rule);
    this.deleteDialog().nativeElement.showModal();
  }

  protected cancelDelete(): void {
    this.deleteDialog().nativeElement.close();
  }

  protected confirmDelete(): void {
    const rule = this.deleting();
    if (!rule) return;
    this.busy.add(rule.id);
    this.api.delete(rule.id).subscribe({
      next: () => {
        this.busy.delete(rule.id);
        this.rules.value.update((rules) => rules?.filter((r) => r.id !== rule.id));
        this.deleteDialog().nativeElement.close();
        this.toast.success(`Alert "${rule.name}" deleted.`);
      },
      error: (error: unknown) => {
        this.busy.delete(rule.id);
        this.deleteDialog().nativeElement.close();
        this.toast.error(`Could not delete "${rule.name}": ${apiErrorMessages(error).join(' ')}`);
      },
    });
  }

  protected channelLabel(channelId: string): string {
    return this.channelNames().get(channelId) ?? `${channelId} (unavailable)`;
  }

  protected isAvailable(channelId: string): boolean {
    return this.channelNames().has(channelId);
  }

  protected describe(rule: AlertRule): string {
    const parts = [`Severity ${rule.minSeverity}+`];
    if (rule.keywords.length > 0) parts.push(`keywords: ${rule.keywords.join(', ')}`);
    if (rule.symbol) parts.push(rule.symbol);
    if (rule.minPercentMove !== undefined) parts.push(`moves of ${rule.minPercentMove}% or more`);
    return parts.join(' · ');
  }

  protected errorMessages(): string[] {
    return apiErrorMessages(this.rules.error());
  }

  private upsert(saved: AlertRule): void {
    this.rules.value.update((rules = []) => {
      const index = rules.findIndex((r) => r.id === saved.id);
      return index === -1 ? [...rules, saved] : rules.map((r) => (r.id === saved.id ? saved : r));
    });
  }
}
