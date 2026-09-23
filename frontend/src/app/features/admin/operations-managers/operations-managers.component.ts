import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { OperationsManagerService } from '../../../core/services/operations-manager.service';
import { UserAccountService } from '../../../core/services/user-account.service';
import { TerritoryService } from '../../../core/services/territory.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { OperationsManagerAssignment, OperationsManagerSummary } from '../../../core/models/operations-manager.model';
import { UserAccount } from '../../../core/models/user-account.model';
import { City } from '../../../core/models/territory.model';

@Component({
  selector: 'app-admin-operations-managers',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, EmptyStateComponent],
  templateUrl: './operations-managers.component.html',
  styleUrl: './operations-managers.component.css',
})
export class AdminOperationsManagersComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  /** Filter / paging state - the server does the filtering, searching, sorting and paging. */
  static readonly PAGE_SIZE = 10;
  readonly statusOptions: { value: string; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
    { value: 'SUSPENDED', label: 'Suspended' },
    { value: 'TRANSFERRED', label: 'Transferred' },
  ];
  readonly searchText = signal('');
  readonly statusFilter = signal('');
  readonly cityFilter = signal('');
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly sortField = signal('userAccount.firstName');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  private readonly searchTyped = new Subject<string>();
  /** Only the newest request may fill the table - a slow older answer must not overwrite a newer one. */
  private requestNumber = 0;

  readonly managers = signal<OperationsManagerAssignment[]>([]);
  readonly summary = signal<OperationsManagerSummary | null>(null);
  readonly loading = signal(true);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly toastMessage = signal<string | null>(null);

  /** Accounts already tagged OPERATIONS_MANAGER (create one via Accounts first) - lets the
   * assignment form offer a name/email search-select instead of a raw user account UUID. */
  readonly candidateOfficers = signal<UserAccount[]>([]);
  readonly cities = signal<City[]>([]);

  /** Row currently showing its inline "reassign city" select, or null. */
  readonly reassigningId = signal<string | null>(null);
  readonly reassignCityId = signal<string>('');

  readonly form = this.fb.nonNullable.group({
    userAccountId: ['', [Validators.required]],
    cityId: ['', [Validators.required]],
  });

  constructor(
    private readonly service: OperationsManagerService,
    private readonly userAccounts: UserAccountService,
    private readonly territory: TerritoryService,
  ) {
    this.searchTyped.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed()).subscribe((term) => {
      this.searchText.set(term);
      this.page.set(0);
      this.load();
    });
  }

  ngOnInit(): void {
    this.loadSummary();
    this.userAccounts.byRole('OPERATIONS_MANAGER').subscribe({ next: (a) => this.candidateOfficers.set(a), error: () => {} });
    this.territory.cities(true).subscribe({ next: (p) => this.cities.set(p.content), error: () => {} });
    this.load();
  }

  private loadSummary(): void {
    this.service.summary().subscribe({ next: (s) => this.summary.set(s), error: () => {} });
  }

  private load(): void {
    this.loading.set(true);
    const request = ++this.requestNumber;
    this.service
      .search({
        q: this.searchText(),
        status: this.statusFilter(),
        cityId: this.cityFilter(),
        page: this.page(),
        size: AdminOperationsManagersComponent.PAGE_SIZE,
        sort: `${this.sortField()},${this.sortDirection()}`,
      })
      .subscribe({
        next: (page) => {
          if (request !== this.requestNumber) return;
          this.managers.set(page.content);
          this.totalPages.set(page.totalPages);
          this.totalElements.set(page.totalElements);
          this.loading.set(false);
        },
        error: () => {
          if (request === this.requestNumber) this.loading.set(false);
        },
      });
  }

  onSearch(term: string): void {
    this.searchTyped.next(term.trim());
  }

  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
    this.page.set(0);
    this.load();
  }

  setCityFilter(cityId: string): void {
    this.cityFilter.set(cityId);
    this.page.set(0);
    this.load();
  }

  clearFilters(): void {
    this.searchText.set('');
    this.statusFilter.set('');
    this.cityFilter.set('');
    this.page.set(0);
    this.load();
  }

  hasFilters(): boolean {
    return !!(this.searchText() || this.statusFilter() || this.cityFilter());
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  sortBy(field: string): void {
    if (this.sortField() === field) this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.page.set(0);
    this.load();
  }

  sortIcon(field: string): string {
    if (this.sortField() !== field) return 'fa-sort';
    return this.sortDirection() === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(null), 3500);
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.formError.set(null);
    this.service.create(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.form.reset({ userAccountId: '', cityId: '' });
        this.loadSummary();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(extractErrorMessage(err, 'Could not create this assignment.'));
      },
    });
  }

  setStatus(manager: OperationsManagerAssignment, status: string): void {
    this.service.setStatus(manager.id, status).subscribe({
      next: () => {
        this.loadSummary();
        this.load();
      },
      error: (err) => this.showToast(extractErrorMessage(err)),
    });
  }

  startReassign(manager: OperationsManagerAssignment): void {
    this.reassigningId.set(manager.id);
    this.reassignCityId.set(manager.cityId);
  }

  cancelReassign(): void {
    this.reassigningId.set(null);
  }

  confirmReassign(manager: OperationsManagerAssignment): void {
    const cityId = this.reassignCityId();
    if (!cityId || cityId === manager.cityId) {
      this.reassigningId.set(null);
      return;
    }
    this.service.reassignCity(manager.id, cityId).subscribe({
      next: () => {
        this.reassigningId.set(null);
        this.showToast('City reassigned.');
        this.loadSummary();
        this.load();
      },
      error: (err) => this.showToast(extractErrorMessage(err, 'Could not reassign this manager.')),
    });
  }
}
