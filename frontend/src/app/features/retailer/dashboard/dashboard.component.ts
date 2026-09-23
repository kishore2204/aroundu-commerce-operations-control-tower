import { CurrencyPipe, NgFor } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { CatalogueService } from '../../../core/services/catalogue.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { OrderService } from '../../../core/services/order.service';
import { RetailerService } from '../../../core/services/retailer.service';
import { CatalogueSummary, InventorySummary } from '../../../core/models/inventory.model';
import { Order } from '../../../core/models/order.model';

const RECENT_ORDERS_LIMIT = 5;

@Component({
  selector: 'app-retailer-dashboard',
  standalone: true,
  imports: [NgFor, CurrencyPipe, RouterLink, EmptyStateComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class RetailerDashboardComponent implements OnInit {
  readonly loading = signal(true);
  readonly catalogueSummary = signal<CatalogueSummary | null>(null);
  readonly inventorySummary = signal<InventorySummary | null>(null);
  readonly ordersLoading = signal(true);
  readonly recentOrders = signal<Order[]>([]);

  constructor(
    private readonly catalogueService: CatalogueService,
    private readonly inventoryService: InventoryService,
    private readonly orderService: OrderService,
    protected readonly retailerService: RetailerService,
  ) {}

  retailerName(): string | undefined {
    return this.retailerService.myRetailer()?.businessName;
  }

  ngOnInit(): void {
    this.catalogueService.summary().subscribe({
      next: (s) => this.catalogueSummary.set(s),
      error: () => {},
    });
    this.inventoryService.summary().subscribe({
      next: (s) => {
        this.inventorySummary.set(s);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.retailerService.resolveMine().subscribe({
      next: (retailer) => {
        if (!retailer) {
          this.ordersLoading.set(false);
          return;
        }
        this.orderService.mineForRetailer(retailer.retailerId).subscribe({
          next: (orders) => {
            const newestFirst = [...orders].sort(
              (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime(),
            );
            this.recentOrders.set(newestFirst.slice(0, RECENT_ORDERS_LIMIT));
            this.ordersLoading.set(false);
          },
          error: () => this.ordersLoading.set(false),
        });
      },
      error: () => this.ordersLoading.set(false),
    });
  }
}
