import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnInit,
  output,
  signal,
} from '@angular/core';
import { type AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { apiErrorMessages } from '../../core/api/api-errors';
import { RulesApi } from '../../core/api/rules-api';
import {
  type AlertRule,
  type AlertRuleInput,
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type Channel,
  type Severity,
} from '../../core/models';
import { parseKeywords } from '../../core/rules';

interface ChannelOption {
  id: string;
  label: string;
  hint: string;
  /** False for a channel the rule already uses but that is no longer offered (e.g. admin-disabled). */
  available: boolean;
}

/** Field ids, in the order a failed submit looks for the first invalid one to focus. */
const FIELD_IDS = {
  category: 'alert-category',
  channelIds: 'alert-channel-0',
  name: 'alert-name',
  minPercentMove: 'alert-min-move',
} as const;

/**
 * Create or edit an alert rule. Saves through `RulesApi` itself and emits the saved rule,
 * so validation and server errors stay inside the form.
 */
@Component({
  selector: 'app-alert-form',
  imports: [ReactiveFormsModule],
  templateUrl: './alert-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertForm implements OnInit {
  private readonly api = inject(RulesApi);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Offered channels, from `GET /api/channels`. */
  readonly channels = input.required<Channel[]>();
  /** The rule to edit, or null to create one. */
  readonly rule = input<AlertRule | null>(null);
  readonly saved = output<AlertRule>();
  readonly cancelled = output<void>();

  protected readonly categories = CATEGORIES;
  protected readonly categoryLabels = CATEGORY_LABELS;

  protected readonly form = this.fb.group({
    name: ['', Validators.maxLength(100)],
    category: this.fb.control<Category | ''>('', Validators.required),
    keywords: [''],
    minSeverity: this.fb.control<number>(3),
    symbol: [''],
    minPercentMove: this.fb.control<number | null>(null, Validators.min(0)),
    channelIds: this.fb.control<string[]>([], Validators.required),
    enabled: [true],
  });

  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverErrors = signal<string[]>([]);

  protected readonly isEdit = computed(() => this.rule() !== null);

  protected readonly channelOptions = computed<ChannelOption[]>(() => {
    const options: ChannelOption[] = this.channels().map((c) => ({
      id: c.id,
      label: c.displayName,
      hint: `Sends to your ${c.destinationKind}`,
      available: true,
    }));
    for (const id of this.rule()?.channelIds ?? []) {
      if (!options.some((o) => o.id === id)) {
        options.push({ id, label: id, hint: 'Not available right now. Uncheck to remove it.', available: false });
      }
    }
    return options;
  });

  ngOnInit(): void {
    const rule = this.rule();
    if (!rule) return;
    this.form.setValue({
      name: rule.name,
      category: rule.category,
      keywords: rule.keywords.join(', '),
      minSeverity: rule.minSeverity,
      symbol: rule.symbol ?? '',
      minPercentMove: rule.minPercentMove ?? null,
      channelIds: [...rule.channelIds],
      enabled: rule.enabled,
    });
  }

  protected get isMarkets(): boolean {
    return this.form.controls.category.value === 'markets';
  }

  protected showError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.submitted());
  }

  protected isChecked(channelId: string): boolean {
    return this.form.controls.channelIds.value.includes(channelId);
  }

  protected toggleChannel(channelId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const control = this.form.controls.channelIds;
    const others = control.value.filter((id) => id !== channelId);
    control.setValue(checked ? [...others, channelId] : others);
    control.markAsTouched();
  }

  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.focusFirstInvalid();
      return;
    }

    this.saving.set(true);
    this.serverErrors.set([]);
    const input = this.toInput();
    const rule = this.rule();
    const request = rule ? this.api.update(rule.id, input) : this.api.create(input);
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.saved.emit(saved);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.serverErrors.set(apiErrorMessages(error));
      },
    });
  }

  private toInput(): AlertRuleInput {
    const value = this.form.getRawValue();
    const category = value.category as Category;
    const markets = category === 'markets';
    return {
      name: value.name.trim(),
      category,
      keywords: parseKeywords(value.keywords),
      minSeverity: value.minSeverity as Severity,
      symbol: markets ? value.symbol.trim() || null : null,
      minPercentMove: markets ? value.minPercentMove : null,
      channelIds: value.channelIds,
      enabled: value.enabled,
    };
  }

  private focusFirstInvalid(): void {
    const controls = this.form.controls;
    const first = (Object.keys(FIELD_IDS) as (keyof typeof FIELD_IDS)[]).find((key) => controls[key].invalid);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  }
}
