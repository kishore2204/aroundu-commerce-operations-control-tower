import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { ExpenseService } from '../../../core/services/expense.service';
import { DriverService } from '../../../core/services/driver.service';
import { FleetExpense } from '../../../core/models/fleet-expense.model';
import { Driver } from '../../../core/models/driver.model';
import { ToastService } from '../../../shared/toast/toast.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';

interface PendingConfirmation {
  kind: 'reimburse' | 'reject' | 'reverse-to-rejected';
  expense: FleetExpense;
}

@Component({
  selector: 'app-fleet-expenses',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, EmptyStateComponent, ConfirmDialogComponent],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.css',
})
export class FleetExpensesComponent implements OnInit, OnDestroy {
  readonly loading = signal(true);
  readonly expenses = signal<FleetExpense[]>([]);
  readonly drivers = signal<Driver[]>([]);
  readonly actingOnId = signal<string | null>(null);
  readonly selectedProofUrl = signal<string | null>(null);
  readonly selectedProofType = signal<string>('');
  readonly selectedProofSafeUrl = signal<SafeResourceUrl | null>(null);
  readonly selectedProofName = signal<string>('Expense proof');
  /** The expense awaiting a confirm/cancel answer - replaces the previous `window.confirm()`. */
  readonly pendingConfirmation = signal<PendingConfirmation | null>(null);
  readonly confirming = signal(false);
  private fleetOwnerId: string | null = null;

  constructor(
    private readonly fleetOwnerService: FleetOwnerService,
    private readonly expenseService: ExpenseService,
    private readonly driverService: DriverService,
    private readonly toast: ToastService,
    private readonly sanitizer: DomSanitizer,
  ) {}

  /** Mirrors FleetTripsComponent.driverNameFor - same "name if known, else license number,
   *  else Unassigned" fallback for a driver-attributed record. */
  driverNameFor(driverId: string | null): string {
    if (!driverId) return '-';
    const driver = this.drivers().find((d) => d.driverId === driverId);
    if (!driver) return 'Unknown Driver';
    return driver.firstName || driver.lastName ? `${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim() : driver.licenseNumber;
  }

  ngOnInit(): void {
    this.fleetOwnerService.resolveMine().subscribe({
      next: (owner) => {
        if (!owner) {
          this.loading.set(false);
          return;
        }
        this.fleetOwnerId = owner.fleetOwnerId;
        this.driverService.mine(owner.fleetOwnerId).subscribe({ next: (list) => this.drivers.set(list), error: () => {} });
        this.load();
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy(): void {
    this.revokeSelectedProofUrl();
  }

  private load(): void {
    if (!this.fleetOwnerId) return;
    this.loading.set(true);
    this.expenseService.mine(this.fleetOwnerId).subscribe({
      next: (list) => {
        this.expenses.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Reimbursement always moves money, so it is always confirmed first - same as the original `window.confirm()`. */
  reimburse(expense: FleetExpense): void {
    this.pendingConfirmation.set({ kind: 'reimburse', expense });
  }

  /** Only confirmed when it REVERSES an already-approved expense - rejecting a still-pending one needs no extra step,
   *  matching the original `window.confirm()` behaviour exactly. */
  reject(expense: FleetExpense): void {
    if (expense.approvalStatus === 'APPROVED') {
      this.pendingConfirmation.set({ kind: 'reverse-to-rejected', expense });
    } else {
      this.runReject(expense);
    }
  }

  confirmPending(): void {
    const pending = this.pendingConfirmation();
    if (!pending || this.confirming()) return;
    if (pending.kind === 'reimburse') this.runReimburse(pending.expense);
    else this.runReject(pending.expense);
  }

  cancelPending(): void {
    if (this.confirming()) return;
    this.pendingConfirmation.set(null);
  }

  private runReimburse(expense: FleetExpense): void {
    this.confirming.set(true);
    this.actingOnId.set(expense.fleetExpenseId);
    this.expenseService.approve(expense.fleetExpenseId).subscribe({
      next: () => {
        this.confirming.set(false);
        this.actingOnId.set(null);
        this.pendingConfirmation.set(null);
        this.toast.show('Expense approved for reimbursement.', 'success');
        this.load();
      },
      error: (err) => {
        this.confirming.set(false);
        this.actingOnId.set(null);
        this.pendingConfirmation.set(null);
        this.toast.show(extractErrorMessage(err, 'Could not reimburse this expense.'), 'error');
      },
    });
  }

  private runReject(expense: FleetExpense): void {
    const wasApproved = expense.approvalStatus === 'APPROVED';
    this.confirming.set(true);
    this.actingOnId.set(expense.fleetExpenseId);
    this.expenseService.reject(expense.fleetExpenseId).subscribe({
      next: () => {
        this.confirming.set(false);
        this.actingOnId.set(null);
        this.pendingConfirmation.set(null);
        this.toast.show(wasApproved ? 'Approved expense changed to rejected.' : 'Expense rejected.', 'success');
        this.load();
      },
      error: (err) => {
        this.confirming.set(false);
        this.actingOnId.set(null);
        this.pendingConfirmation.set(null);
        this.toast.show(extractErrorMessage(err, 'Could not reject this expense.'), 'error');
      },
    });
  }

  viewProof(expense: FleetExpense): void {
    this.expenseService.proofFileBlob(expense.fleetExpenseId).subscribe({
      next: (blob) => {
        this.revokeSelectedProofUrl();
        const url = URL.createObjectURL(blob);
        this.selectedProofUrl.set(url);
        this.selectedProofSafeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
        this.selectedProofType.set(blob.type || 'application/octet-stream');
        this.selectedProofName.set(expense.proofFileName || 'Expense proof');
      },
      error: () => this.toast.show('Could not load the proof file.', 'error'),
    });
  }

  closeProof(): void {
    this.revokeSelectedProofUrl();
    this.selectedProofType.set('');
    this.selectedProofSafeUrl.set(null);
    this.selectedProofName.set('Expense proof');
  }

  get confirmDialogTitle(): string {
    return this.pendingConfirmation()?.kind === 'reimburse' ? 'Approve this expense?' : 'Change this expense to Rejected?';
  }

  get confirmDialogMessage(): string {
    return this.pendingConfirmation()?.kind === 'reimburse'
      ? 'This marks the expense as approved for reimbursement. You can still reverse it to Rejected afterwards if this was selected accidentally.'
      : 'This expense is already approved for reimbursement. Changing it to Rejected reverses that approval.';
  }

  private revokeSelectedProofUrl(): void {
    const url = this.selectedProofUrl();
    if (url) URL.revokeObjectURL(url);
    this.selectedProofUrl.set(null);
  }
}

