import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '../../../core/services/audit-log.service';
import { UserAccountService } from '../../../core/services/user-account.service';
import { VerificationQueueService } from '../../../core/services/verification-queue.service';
import { AnalyticsOverview, RefundRegionInsight } from '../../../core/models/audit-log.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class AdminDashboardComponent implements OnInit {
  readonly loading = signal(true);
  readonly overview = signal<AnalyticsOverview | null>(null);
  readonly pendingReview = signal(0);
  readonly accountCount = signal(0);
  readonly roleCounts = signal<{ role: string; count: number }[]>([]);
  readonly refundRegionInsights = signal<RefundRegionInsight[]>([]);
  readonly refundInsightsLoading = signal(true);

  /** Bar-chart-ready role distribution: each bar's width as a percentage of the largest role
   *  count, so SVG-free CSS bars render proportionally without a charting library. */
  readonly roleBarChart = computed(() => {
    const counts = this.roleCounts();
    const max = Math.max(1, ...counts.map((c) => c.count));
    return counts.map((c) => ({ ...c, widthPct: Math.round((c.count / max) * 100) }));
  });

  /** Finance record-mix donut chart (payments/settlements/invoices/refunds) as SVG stroke-dash
   *  segments - a quick creative way to show relative volume without a charting dependency. */
  readonly financeMixChart = computed(() => {
    const o = this.overview();
    if (!o) return [];
    const segments = [
      { label: 'Payments', count: o.paymentTransactions, color: '#10b981' },
      { label: 'Settlements', count: o.settlements, color: '#6366f1' },
      { label: 'Invoices', count: o.invoices, color: '#f59e0b' },
      { label: 'Refunds', count: o.refunds, color: '#ef4444' },
    ];
    const total = Math.max(1, segments.reduce((sum, s) => sum + s.count, 0));
    const circumference = 2 * Math.PI * 40;
    let offset = 0;
    return segments.map((s) => {
      const dash = (s.count / total) * circumference;
      const segment = { ...s, pct: Math.round((s.count / total) * 100), dashArray: `${dash} ${circumference - dash}`, dashOffset: -offset };
      offset += dash;
      return segment;
    });
  });

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly userAccountService: UserAccountService,
    private readonly queueService: VerificationQueueService,
  ) {}

  ngOnInit(): void {
    this.analyticsService.overview().subscribe({
      next: (o) => {
        this.overview.set(o);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.analyticsService.refundRegions().subscribe({
      next: (insights) => {
        this.refundRegionInsights.set(insights);
        this.refundInsightsLoading.set(false);
      },
      error: () => this.refundInsightsLoading.set(false),
    });
    this.queueService.byStatus('SENT_TO_LOCATION_MANAGER').subscribe({
      next: (entries) => this.pendingReview.set(entries.length),
      error: () => {},
    });
    this.userAccountService.all().subscribe({
      next: (accounts) => {
        this.accountCount.set(accounts.length);
        const counts = new Map<string, number>();
        for (const a of accounts) {
          counts.set(a.role, (counts.get(a.role) ?? 0) + 1);
        }
        this.roleCounts.set(Array.from(counts, ([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count));
      },
      error: () => {},
    });
  }
}
