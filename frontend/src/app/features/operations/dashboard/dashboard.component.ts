import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '../../../core/services/audit-log.service';
import { VerificationQueueService } from '../../../core/services/verification-queue.service';
import { AnalyticsOverview } from '../../../core/models/audit-log.model';

@Component({
  selector: 'app-operations-dashboard',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class OperationsDashboardComponent implements OnInit {
  readonly loading = signal(true);
  readonly overview = signal<AnalyticsOverview | null>(null);
  readonly pendingReview = signal(0);

  constructor(
    private readonly analyticsService: AnalyticsService,
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
    // Only the count for the "Awaiting verification review" card - reassigning work lives in the Verification Queue.
    this.queueService.byStatus('SENT_TO_LOCATION_MANAGER').subscribe({
      next: (entries) => this.pendingReview.set(entries.length),
      error: () => {},
    });
  }
}
