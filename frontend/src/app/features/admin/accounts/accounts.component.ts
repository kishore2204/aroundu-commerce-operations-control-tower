import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { UserAccountService } from '../../../core/services/user-account.service';
import { LocationManagerAssignmentService } from '../../../core/services/location-manager-assignment.service';
import { VerificationQueueService } from '../../../core/services/verification-queue.service';
import { LocationManagerAssignment } from '../../../core/models/location-manager-assignment.model';
import { WorkTransferDialogComponent } from '../../../shared/work-transfer/work-transfer-dialog.component';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { UserAccount } from '../../../core/models/user-account.model';
import { DigitsOnlyDirective } from '../../../shared/input-rules/digits-only.directive';
import { FieldHintComponent } from '../../../shared/field-hint/field-hint.component';
import { PasswordRequirementsComponent } from '../../../shared/password-requirements/password-requirements.component';
import { mobileNumberValidator } from '../../../core/validation/input-rules';
import { PASSWORD_MAX_LENGTH, passwordPolicyValidator } from '../../../core/validation/password-policy';

const adminPasswordsMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-admin-accounts',
  standalone: true,
  imports: [DigitsOnlyDirective, PasswordRequirementsComponent, FieldHintComponent, DatePipe, ReactiveFormsModule, EmptyStateComponent, WorkTransferDialogComponent],
  templateUrl: './accounts.component.html',
  styleUrl: './accounts.component.css',
})
export class AdminAccountsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly accounts = signal<UserAccount[]>([]);
  readonly filtered = signal<UserAccount[]>([]);
  readonly loading = signal(true);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly toastMessage = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly searchControl = this.fb.nonNullable.control('');
  /** '' means "All". Combined with the search box in applyFilter(). */
  readonly roleFilter = this.fb.nonNullable.control('');
  readonly statusFilter = this.fb.nonNullable.control('');

  private static readonly KNOWN_ROLES = ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'LOCATION_MANAGER', 'RETAILER', 'FLEET_MANAGER', 'DRIVER', 'CUSTOMER'];
  private static readonly KNOWN_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

  /** The known roles/statuses plus anything else present in the loaded accounts, so no account is unreachable. */
  readonly roleOptions = computed(() => this.optionsFor(AdminAccountsComponent.KNOWN_ROLES, this.accounts().map((a) => a.role)));
  readonly statusOptions = computed(() => this.optionsFor(AdminAccountsComponent.KNOWN_STATUSES, this.accounts().map((a) => a.accountStatus)));

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', [Validators.required, mobileNumberValidator()]],
    role: ['CUSTOMER', [Validators.required]],
    password: ['', [Validators.required, passwordPolicyValidator(), Validators.maxLength(PASSWORD_MAX_LENGTH)]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: adminPasswordsMatchValidator });

  /** A Location Manager account about to be disabled while they still hold pending verification work. */
  readonly transferGate = signal<{ account: UserAccount; assignment: LocationManagerAssignment; status: string } | null>(null);

  constructor(
    private readonly userAccountService: UserAccountService,
    private readonly assignmentService: LocationManagerAssignmentService,
    private readonly queueService: VerificationQueueService,
  ) {}

  ngOnInit(): void {
    this.searchControl.valueChanges.subscribe(() => this.applyFilter());
    this.roleFilter.valueChanges.subscribe(() => this.applyFilter());
    this.statusFilter.valueChanges.subscribe(() => this.applyFilter());
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.userAccountService.all(true).subscribe({
      next: (accounts) => {
        this.accounts.set(accounts.sort((a, b) => a.email.localeCompare(b.email)));
        this.applyFilter();
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private optionsFor(known: string[], present: string[]): string[] {
    return [...known, ...present.filter((value) => value && !known.includes(value)).sort()].filter((value, i, all) => all.indexOf(value) === i);
  }

  /** "OPERATIONS_MANAGER" -> "Operations Manager" */
  label(value: string): string {
    return value.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  /*
  ##################################################################
  
                                             TK_INC0010081_User_Account_Filters_3239293
  
  #####################################################################
  */
  /** Search, role and status narrow the same list together; the account actions work on the filtered rows as before. */
  private applyFilter(): void {
    const q = this.searchControl.value.trim().toLowerCase();
    const role = this.roleFilter.value;
    const status = this.statusFilter.value;
    this.filtered.set(
      this.accounts().filter(
        (a) =>
          (!role || a.role === role) &&
          (!status || a.accountStatus === status) &&
          (!q ||
            a.email.toLowerCase().includes(q) ||
            `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
            a.role.toLowerCase().includes(q)),
      ),
    );
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(null), 3000);
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.formError.set(null);
    const { confirmPassword: _confirmPassword, ...accountRequest } = this.form.getRawValue();
    this.userAccountService.create({ ...accountRequest, accountStatus: 'ACTIVE' }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.form.reset({ firstName: '', lastName: '', email: '', phoneNumber: '', role: 'CUSTOMER', password: '', confirmPassword: '' });
        this.showPassword.set(false);
        this.showConfirmPassword.set(false);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(extractErrorMessage(err, 'Could not create this account.'));
      },
    });
  }

  setStatus(account: UserAccount, status: string): void {
    // Taking a Location Manager out of service is blocked while they still hold pending verification work:
    // no pending work -> straight through; otherwise the Work Transfer popup, then the change.
    if (account.role === 'LOCATION_MANAGER' && status !== 'ACTIVE') {
      this.queueService.pendingWork(account.id).subscribe({
        next: (items) => (items.length === 0 ? this.applyStatus(account, status) : this.openTransfer(account, status)),
        error: (err) => this.showToast(extractErrorMessage(err, 'Could not check this Location Manager\'s pending work.')),
      });
      return;
    }
    this.applyStatus(account, status);
  }

  private openTransfer(account: UserAccount, status: string): void {
    this.assignmentService.list().subscribe({
      next: (page) => {
        const assignment = page.content.find((a) => a.userAccountId === account.id);
        if (assignment) this.transferGate.set({ account, assignment, status });
        else this.showToast('This Location Manager still has pending work but no assignment could be found to transfer it from.');
      },
      error: (err) => this.showToast(extractErrorMessage(err)),
    });
  }

  onWorkTransferred(): void {
    const gate = this.transferGate();
    this.transferGate.set(null);
    this.showToast('All pending work has been successfully transferred.');
    if (gate) this.applyStatus(gate.account, gate.status);
  }

  private applyStatus(account: UserAccount, status: string): void {
    this.userAccountService.setStatus(account.id, status).subscribe({
      next: () => this.load(),
      error: (err) => this.showToast(extractErrorMessage(err)),
    });
  }
}
