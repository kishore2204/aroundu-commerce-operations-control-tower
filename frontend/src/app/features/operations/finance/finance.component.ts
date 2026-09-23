import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../shared/toast/toast.service';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { PaymentTransactionService, SettlementService } from '../../../core/services/settlement.service';
import { TaxConfigurationService } from '../../../core/services/tax-configuration.service';
import { StateService } from '../../../core/services/state.service';
import { CategoryService } from '../../../core/services/category.service';
import { ProductCategory } from '../../../core/models/category.model';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { PaymentTransaction, Settlement } from '../../../core/models/settlement.model';
import { TaxConfiguration } from '../../../core/models/tax-configuration.model';
import { State } from '../../../core/models/state.model';
import { LogisticsRateService } from '../../../core/services/logistics-rate.service';
import { LogisticsVehicleRate } from '../../../core/models/logistics-rate.model';

@Component({
  selector: 'app-operations-finance',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    FormsModule,
    EmptyStateComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './finance.component.html',
  styleUrl: './finance.component.css',
})
export class OperationsFinanceComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly activeTab = signal<'payments' | 'settlements' | 'tax' | 'rates'>('payments');

  readonly settlements = signal<Settlement[]>([]);
  readonly settlementsLoading = signal(true);
  readonly paymentTransactions = signal<PaymentTransaction[]>([]);
  readonly paymentsLoading = signal(true);
  readonly retryingPaymentId = signal<string | null>(null);
  readonly showSettlementForm = signal(false);
  readonly savingSettlement = signal(false);
  readonly settlementFormError = signal<string | null>(null);
  /** The settlement awaiting a "mark complete" confirmation - completing a settlement cannot be undone. */
  readonly pendingComplete = signal<Settlement | null>(null);
  readonly completing = signal(false);

  /** "Disputed" = FAILED payment transactions - the only status that genuinely needs an
   *  Operations Manager's attention (PENDING/SUCCESS need no action). */
  readonly disputedPayments = computed(() => this.paymentTransactions().filter((t) => t.paymentStatus === 'FAILED'));
  readonly totalPaymentsAmount = computed(() =>
    this.paymentTransactions().filter((t) => t.paymentStatus === 'SUCCESS').reduce((sum, t) => sum + t.amount, 0),
  );
  readonly totalPaymentsCount = computed(() => this.paymentTransactions().filter((t) => t.paymentStatus === 'SUCCESS').length);

  readonly taxConfigs = signal<TaxConfiguration[]>([]);
  /** Active product categories (from the catalogue) a tax rule can be created for. */
  readonly categories = signal<ProductCategory[]>([]);
  readonly taxLoading = signal(true);
  readonly states = signal<State[]>([]);
  readonly showTaxForm = signal(false);
  readonly savingTax = signal(false);
  readonly taxFormError = signal<string | null>(null);
  /** The tax rule awaiting a delete confirmation - deleting it cannot be undone. */
  readonly pendingTaxRemove = signal<TaxConfiguration | null>(null);
  readonly removingTax = signal(false);
  readonly logisticsRates = signal<LogisticsVehicleRate[]>([]);
  readonly ratesLoading = signal(true);
  readonly savingRate = signal<string | null>(null);

  readonly settlementForm = this.fb.nonNullable.group({
    paymentTransactionId: ['', [Validators.required]],
    grossAmount: [0, [Validators.required, Validators.min(0.01)]],
    feeAmount: [0, [Validators.required, Validators.min(0)]],
    settlementDate: ['', [Validators.required]],
    settlementReference: [''],
  });

  readonly taxForm = this.fb.nonNullable.group(
    {
      categoryName: ['', [Validators.required, Validators.maxLength(100), (c: AbstractControl) => (String(c.value ?? '').trim() ? null : { required: true })]],
      cgst: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      sgst: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      stateId: [''],
      effectiveFrom: [''],
      effectiveTo: [''],
      active: [true],
    },
    { validators: (group: AbstractControl) => {
        const from = group.get('effectiveFrom')?.value as string;
        const to = group.get('effectiveTo')?.value as string;
        return from && to && to < from ? { periodOrder: true } : null;
      } },
  );

  constructor(
    private readonly settlementService: SettlementService,
    private readonly paymentTransactionService: PaymentTransactionService,
    private readonly taxService: TaxConfigurationService,
    private readonly stateService: StateService,
    private readonly categoryService: CategoryService,
    private readonly snackBar: ToastService,
    private readonly logisticsRateService: LogisticsRateService,
  ) {}

  ngOnInit(): void {
    this.loadSettlements();
    this.loadTax();
    this.loadPayments();
    this.loadLogisticsRates();
    this.stateService.all().subscribe({ next: (list) => this.states.set(list), error: () => {} });
  }

  private loadLogisticsRates(): void {
    this.ratesLoading.set(true);
    this.logisticsRateService.list().subscribe({
      next: (rates) => { this.logisticsRates.set(rates.map((rate) => ({ ...rate }))); this.ratesLoading.set(false); },
      error: () => this.ratesLoading.set(false),
    });
  }

  updateRateField(category: string, field: 'ratePerKm' | 'minimumDistanceKm' | 'minimumRate', value: number): void {
    this.logisticsRates.update((rates) => rates.map((rate) => rate.vehicleCategory === category ? { ...rate, [field]: Number(value) } : rate));
  }

  saveLogisticsRate(rate: LogisticsVehicleRate): void {
    if (rate.ratePerKm <= 0 || rate.minimumDistanceKm <= 0 || rate.minimumRate <= 0) {
      this.snackBar.show('Rate, minimum distance and minimum rate must be greater than zero.', 'warning');
      return;
    }
    this.savingRate.set(rate.vehicleCategory);
    this.logisticsRateService.update(rate).subscribe({
      next: (saved) => {
        this.savingRate.set(null);
        this.logisticsRates.update((rates) => rates.map((item) => item.vehicleCategory === saved.vehicleCategory ? saved : item));
        this.snackBar.show(`${saved.vehicleCategory.replaceAll('_', ' ')} rate updated.`, 'success');
      },
      error: (err) => { this.savingRate.set(null); this.snackBar.show(extractErrorMessage(err, 'Could not update logistics rate.'), 'error'); },
    });
  }

  vehicleCategoryLabel(category: string): string { return category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

  private loadPayments(): void {
    this.paymentsLoading.set(true);
    this.paymentTransactionService.list().subscribe({
      next: (list) => {
        this.paymentTransactions.set(list);
        this.paymentsLoading.set(false);
      },
      error: () => this.paymentsLoading.set(false),
    });
  }

  retryPayment(t: PaymentTransaction): void {
    this.retryingPaymentId.set(t.paymentTransactionId);
    this.paymentTransactionService.retry(t.orderId, t.paymentMethod).subscribe({
      next: () => {
        this.retryingPaymentId.set(null);
        this.snackBar.show('New payment attempt created for this order.', 'success');
        this.loadPayments();
      },
      error: (err) => {
        this.retryingPaymentId.set(null);
        this.snackBar.show(extractErrorMessage(err, 'Could not retry this payment.'), 'error');
      },
    });
  }

  private loadSettlements(): void {
    this.settlementsLoading.set(true);
    this.settlementService.list().subscribe({
      next: (list) => {
        this.settlements.set(list);
        this.settlementsLoading.set(false);
      },
      error: () => this.settlementsLoading.set(false),
    });
  }

  private loadTax(): void {
    this.taxLoading.set(true);
    this.taxService.list().subscribe({
      next: (list) => {
        this.taxConfigs.set(list);
        this.taxLoading.set(false);
      },
      error: () => this.taxLoading.set(false),
    });
  }

  createSettlement(): void {
    if (this.settlementForm.invalid) return;
    this.savingSettlement.set(true);
    this.settlementFormError.set(null);
    const { paymentTransactionId, grossAmount, feeAmount, settlementDate, settlementReference } =
      this.settlementForm.getRawValue();
    this.settlementService
      .create({ paymentTransactionId, grossAmount, feeAmount, settlementDate, settlementReference: settlementReference || null })
      .subscribe({
        next: () => {
          this.savingSettlement.set(false);
          this.showSettlementForm.set(false);
          this.loadSettlements();
        },
        error: (err) => {
          this.savingSettlement.set(false);
          this.settlementFormError.set(extractErrorMessage(err, 'Could not create this settlement.'));
        },
      });
  }

  /** Opens the confirmation dialog instead of completing immediately - a completed settlement cannot be reopened. */
  complete(settlement: Settlement): void {
    this.pendingComplete.set(settlement);
  }

  confirmComplete(): void {
    const settlement = this.pendingComplete();
    if (!settlement || this.completing()) return;
    this.completing.set(true);
    this.settlementService.complete(settlement.settlementId).subscribe({
      next: () => {
        this.completing.set(false);
        this.pendingComplete.set(null);
        this.snackBar.show('Settlement marked as completed.', 'success');
        this.loadSettlements();
      },
      error: (err) => {
        this.completing.set(false);
        this.pendingComplete.set(null);
        this.snackBar.show(extractErrorMessage(err, 'Could not complete this settlement.'), 'error');
      },
    });
  }

  cancelComplete(): void {
    if (this.completing()) return;
    this.pendingComplete.set(null);
  }

  /** Opening the form re-reads the active categories, so a category added or switched off a moment ago is reflected. */
  toggleTaxForm(): void {
    const open = !this.showTaxForm();
    this.showTaxForm.set(open);
    if (!open) return;
    this.taxFormError.set(null);
    this.categoryService.activeFresh().subscribe({
      next: (list) => this.categories.set(list),
      error: (err) => this.taxFormError.set(extractErrorMessage(err, 'Could not load the product categories.')),
    });
  }

  /** The rule's category name - the live catalogue name when known, otherwise the name saved with the rule. */
  taxCategoryLabel(tax: TaxConfiguration): string {
    const live = tax.productCategoryId == null ? undefined : this.categories().find((c) => c.id === tax.productCategoryId);
    return live?.name ?? tax.taxCategoryName;
  }

  createTax(): void {
    if (this.taxForm.invalid) return;
    this.savingTax.set(true);
    this.taxFormError.set(null);
    const { categoryName, cgst, sgst, stateId, effectiveFrom, effectiveTo, active } = this.taxForm.getRawValue();
    this.taxService
      .saveByCategoryName({
        categoryName: categoryName.trim(),
        cgst,
        sgst,
        stateId: stateId || null,
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,
        active,
      })
      .subscribe({
      next: (result) => {
        this.savingTax.set(false);
        this.showTaxForm.set(false);
        this.taxForm.reset({ categoryName: '', cgst: 0, sgst: 0, stateId: '', effectiveFrom: '', effectiveTo: '', active: true });
        // a category may have just been created: every screen that lists categories must read them again
        this.categoryService.invalidate();
        this.snackBar.show(result.message, 'success');
        this.loadTax();
      },
      error: (err) => {
        this.savingTax.set(false);
        this.taxFormError.set(extractErrorMessage(err, 'Could not create this tax configuration.'));
      },
    });
  }

  /** Opens the confirmation dialog instead of deleting immediately. */
  removeTax(tax: TaxConfiguration): void {
    this.pendingTaxRemove.set(tax);
  }

  confirmRemoveTax(): void {
    const tax = this.pendingTaxRemove();
    if (!tax || this.removingTax()) return;
    this.removingTax.set(true);
    this.taxService.remove(tax.taxConfigurationId).subscribe({
      next: () => {
        this.removingTax.set(false);
        this.pendingTaxRemove.set(null);
        this.snackBar.show('Tax configuration deleted.', 'success');
        this.loadTax();
      },
      error: (err) => {
        this.removingTax.set(false);
        this.pendingTaxRemove.set(null);
        this.snackBar.show(extractErrorMessage(err, 'Could not delete this tax configuration.'), 'error');
      },
    });
  }

  cancelRemoveTax(): void {
    if (this.removingTax()) return;
    this.pendingTaxRemove.set(null);
  }
}
