import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { LocationDashboardService } from '../../../core/services/location-dashboard.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import {
  DashboardSummary,
  FleetAssets,
  RetailerReviewPage,
  ZoneUserPage,
  ZoneUserRow,
  ZoneUserType,
} from '../../../core/models/location-dashboard.model';

type RangePreset = 'today' | '7' | '30' | 'custom';

const VERIFICATION_LABELS: Record<string, string> = {
  NOT_SUBMITTED: 'Not submitted',
  DOCUMENTS_SUBMITTED: 'Documents uploaded',
  SENT_TO_LOCATION_MANAGER: 'Awaiting review',
  RESUBMISSION_REQUIRED: 'Re-upload required',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};
const ONBOARDING_LABELS: Record<string, string> = {
  PENDING_VERIFICATION: 'Pending verification',
  SENT_TO_LOCATION_MANAGER: 'Under review',
  RESUBMISSION_REQUIRED: 'Re-upload required',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};
const PENDING_ACTION_LABELS: Record<string, string> = {
  REVIEW_DOCUMENTS: 'Review documents',
  AWAITING_REUPLOAD: 'Awaiting document re-upload',
  AWAITING_SUBMISSION: 'Awaiting submission',
  NONE: 'None',
};
const SUBJECT_LABELS: Record<string, string> = { RETAILER: 'Retailers', FLEET_OWNER: 'Fleet Owners', DRIVER: 'Drivers', VEHICLE: 'Vehicles' };

function isoDay(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return isoDay(date);
}

@Component({
  selector: 'app-location-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class LocationDashboardComponent implements OnInit {
  private readonly dashboard = inject(LocationDashboardService);
  private readonly destroyRef = inject(DestroyRef);

  // ---- summary (KPIs + analytics), driven by the date range
  readonly summary = signal<DashboardSummary | null>(null);
  readonly summaryLoading = signal(true);
  readonly summaryError = signal<string | null>(null);
  readonly preset = signal<RangePreset>('30');
  readonly customFrom = signal(daysAgo(29));
  readonly customTo = signal(isoDay(new Date()));

  // ---- partner list: search / filters / sort / paging all run on the server
  readonly userType = signal<ZoneUserType>('RETAILER');
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly onboardingFilter = signal('');
  readonly verificationFilter = signal('');
  readonly activationFilter = signal('');
  readonly pendingActionFilter = signal('');
  readonly sortField = signal('businessName');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  readonly page = signal(0);
  readonly pageSize = 10;
  readonly users = signal<ZoneUserPage | null>(null);
  readonly usersLoading = signal(true);
  readonly usersError = signal<string | null>(null);

  // ---- one partner opened in detail (loaded on demand, then kept)
  readonly expandedId = signal<string | null>(null);
  readonly reviews = signal<Record<string, RetailerReviewPage>>({});
  readonly assets = signal<Record<string, FleetAssets>>({});
  readonly detailLoading = signal<string | null>(null);
  readonly detailError = signal<string | null>(null);

  readonly totalPages = computed(() => Math.max(1, Math.ceil((this.users()?.totalElements ?? 0) / this.pageSize)));

  /** Onboarding trend: bar heights relative to the busiest bucket. */
  readonly trend = computed(() => {
    const points = this.summary()?.onboardingTrend ?? [];
    const max = Math.max(1, ...points.map((p) => Math.max(p.retailers, p.fleetOwners)));
    return points.map((p) => ({ ...p, retailerPct: (p.retailers / max) * 100, ownerPct: (p.fleetOwners / max) * 100 }));
  });
  readonly trendTotals = computed(() => {
    const points = this.summary()?.onboardingTrend ?? [];
    return { retailers: points.reduce((s, p) => s + p.retailers, 0), fleetOwners: points.reduce((s, p) => s + p.fleetOwners, 0) };
  });

  /** Verification analytics: one stacked bar per partner type. */
  readonly verificationRows = computed(() =>
    (this.summary()?.verificationBySubject ?? []).map((row) => {
      const total = Math.max(1, row.pending + row.approved + row.rejected);
      return { ...row, pendingPct: (row.pending / total) * 100, approvedPct: (row.approved / total) * 100, rejectedPct: (row.rejected / total) * 100 };
    }),
  );

  /** Pending work by kind, widest bar = the biggest pile. */
  readonly workloadRows = computed(() => {
    const items = this.summary()?.workload ?? [];
    const max = Math.max(1, ...items.map((i) => i.count));
    return items.map((item) => ({ ...item, pct: (item.count / max) * 100 }));
  });

  readonly orderSplit = computed(() => {
    const s = this.summary();
    const active = s?.activeOrders ?? 0;
    const completed = s?.completedOrders ?? 0;
    const total = active + completed;
    return { activePct: total ? (active / total) * 100 : 0, completedPct: total ? (completed / total) * 100 : 0 };
  });

  ngOnInit(): void {
    this.searchControl.valueChanges.pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.page.set(0);
      this.loadUsers();
    });
    this.loadSummary();
    this.loadUsers();
  }

  // ------------------------------------------------------------------ date range

  private range(): { from: string; to: string } {
    switch (this.preset()) {
      case 'today': return { from: daysAgo(0), to: daysAgo(0) };
      case '7': return { from: daysAgo(6), to: daysAgo(0) };
      case 'custom': return { from: this.customFrom(), to: this.customTo() };
      default: return { from: daysAgo(29), to: daysAgo(0) };
    }
  }

  setPreset(preset: RangePreset): void {
    this.preset.set(preset);
    if (preset !== 'custom') this.loadSummary();
  }

  applyCustomRange(): void {
    this.loadSummary();
  }

  customRangeValid(): boolean {
    return !!this.customFrom() && !!this.customTo() && this.customFrom() <= this.customTo();
  }

  /** The range only changes the time-based figures, so only the summary reloads - never the partner list. */
  loadSummary(): void {
    const { from, to } = this.range();
    if (!from || !to || from > to) return;
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    this.dashboard.summary(from, to).subscribe({
      next: (summary) => { this.summary.set(summary); this.summaryLoading.set(false); },
      error: (err) => { this.summaryError.set(extractErrorMessage(err, 'Could not load the dashboard.')); this.summaryLoading.set(false); },
    });
  }

  refresh(): void {
    this.loadSummary();
    this.loadUsers();
  }

  // ------------------------------------------------------------------ partner list

  loadUsers(): void {
    this.usersLoading.set(true);
    this.usersError.set(null);
    this.dashboard.users({
      type: this.userType(),
      search: this.searchControl.value.trim(),
      onboardingStatus: this.onboardingFilter(),
      verificationStatus: this.verificationFilter(),
      activation: this.activationFilter(),
      pendingAction: this.pendingActionFilter(),
      sort: this.sortField(),
      direction: this.sortDirection(),
      page: this.page(),
      size: this.pageSize,
    }).subscribe({
      next: (page) => { this.users.set(page); this.usersLoading.set(false); },
      error: (err) => { this.usersError.set(extractErrorMessage(err, 'Could not load the list.')); this.usersLoading.set(false); },
    });
  }

  selectType(type: ZoneUserType): void {
    if (this.userType() === type) return;
    this.userType.set(type);
    this.expandedId.set(null);
    this.page.set(0);
    this.loadUsers();
  }

  /** Jump from a KPI card to the matching list. */
  showList(type: ZoneUserType): void {
    this.selectType(type);
    document.getElementById('zone-partners')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  setFilter(target: 'onboarding' | 'verification' | 'activation' | 'pendingAction', value: string): void {
    ({ onboarding: this.onboardingFilter, verification: this.verificationFilter, activation: this.activationFilter, pendingAction: this.pendingActionFilter })[target].set(value);
    this.page.set(0);
    this.loadUsers();
  }

  filtersActive(): boolean {
    return !!(this.searchControl.value || this.onboardingFilter() || this.verificationFilter() || this.activationFilter() || this.pendingActionFilter());
  }

  clearFilters(): void {
    this.onboardingFilter.set('');
    this.verificationFilter.set('');
    this.activationFilter.set('');
    this.pendingActionFilter.set('');
    this.page.set(0);
    if (this.searchControl.value) this.searchControl.setValue(''); // its own subscription reloads
    else this.loadUsers();
  }

  sortBy(field: string): void {
    if (this.sortField() === field) this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    else { this.sortField.set(field); this.sortDirection.set('asc'); }
    this.page.set(0);
    this.loadUsers();
  }

  sortIcon(field: string): string {
    if (this.sortField() !== field) return 'fa-sort text-slate-300';
    return this.sortDirection() === 'asc' ? 'fa-sort-up text-violet-600' : 'fa-sort-down text-violet-600';
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.expandedId.set(null);
    this.loadUsers();
  }

  // ------------------------------------------------------------------ detail

  toggle(row: ZoneUserRow): void {
    if (this.expandedId() === row.id) { this.expandedId.set(null); return; }
    this.expandedId.set(row.id);
    this.detailError.set(null);
    if (row.userType === 'RETAILER' && !this.reviews()[row.id]) this.loadReviews(row, 0);
    if (row.userType === 'FLEET_OWNER' && !this.assets()[row.id]) this.loadAssets(row);
  }

  loadReviews(row: ZoneUserRow, page: number): void {
    this.detailLoading.set(row.id);
    this.dashboard.retailerReviews(row.id, page, 5).subscribe({
      next: (reviewPage) => { this.reviews.update((all) => ({ ...all, [row.id]: reviewPage })); this.detailLoading.set(null); },
      error: (err) => { this.detailError.set(extractErrorMessage(err, 'Could not load the reviews.')); this.detailLoading.set(null); },
    });
  }

  reviewPages(id: string): number {
    const page = this.reviews()[id];
    return page ? Math.max(1, Math.ceil(page.totalElements / page.size)) : 1;
  }

  loadAssets(row: ZoneUserRow): void {
    this.detailLoading.set(row.id);
    this.dashboard.fleetAssets(row.id).subscribe({
      next: (assets) => { this.assets.update((all) => ({ ...all, [row.id]: assets })); this.detailLoading.set(null); },
      error: (err) => { this.detailError.set(extractErrorMessage(err, 'Could not load the drivers and vehicles.')); this.detailLoading.set(null); },
    });
  }

  // ------------------------------------------------------------------ wording

  verificationLabel(status: string): string { return VERIFICATION_LABELS[status] ?? status; }
  onboardingLabel(status: string): string { return ONBOARDING_LABELS[status] ?? status; }
  pendingActionLabel(action: string): string { return PENDING_ACTION_LABELS[action] ?? action; }
  subjectLabel(type: string): string { return SUBJECT_LABELS[type] ?? type; }

  verificationBadge(status: string): string {
    if (status === 'APPROVED') return 'badge-active';
    if (status === 'REJECTED' || status === 'RESUBMISSION_REQUIRED') return 'badge-danger';
    return 'badge-pending';
  }

  stars(rating: number | null): string {
    return rating == null ? '' : '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  }

  rangeLabel(): string {
    const s = this.summary();
    if (!s) return '';
    return s.from === s.to ? s.from : `${s.from} to ${s.to}`;
  }

  trendLabel(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
}
