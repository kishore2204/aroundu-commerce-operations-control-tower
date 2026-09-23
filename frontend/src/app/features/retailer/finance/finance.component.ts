import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { SettlementService } from '../../../core/services/settlement.service';
import { Settlement } from '../../../core/models/settlement.model';

/**
 * GET /api/settlements is `.authenticated()` in S6's SecurityConfig (not staff-only, despite
 * the stale message this used to show) - any signed-in retailer can call it. The Settlement
 * entity itself has no retailer_id (only operationsManagerId/paymentTransactionId, see
 * database.sql:582), so there is no server-side "my settlements" filter yet - this shows the
 * real platform settlement list rather than inventing a filter the schema doesn't support.
 */
@Component({
  selector: 'app-retailer-finance',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, EmptyStateComponent],
  templateUrl: './finance.component.html',
  styleUrl: './finance.component.css',
})
export class RetailerFinanceComponent implements OnInit {
  readonly loading = signal(true);
  readonly settlements = signal<Settlement[]>([]);

  constructor(private readonly settlementService: SettlementService) {}

  ngOnInit(): void {
    this.settlementService.list().subscribe({
      next: (list) => {
        this.settlements.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
