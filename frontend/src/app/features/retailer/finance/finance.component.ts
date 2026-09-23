import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { SettlementService } from '../../../core/services/settlement.service';
import { Settlement } from '../../../core/models/settlement.model';

/**
 * GET /api/settlements is scoped server-side: for a RETAILER it returns only that retailer's own
 * settlements (payeeType RETAILER + their retailerId, resolved from the JWT subject in S6), so no
 * client-side filtering is needed or trusted here.
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
