import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { RetailerService } from '../../core/services/retailer.service';
import { RetailerRatingSummary, RetailerSummary } from '../../core/models/retailer.model';
import { StarRatingComponent } from '../star-rating/star-rating.component';
import { LoadingStateComponent } from '../loading-state/loading-state.component';

/**
 * The "tap a shop to see its details" pattern used on every product card (and the order
 * tracking page, to show which shop an order is from) - fetches shop name/verification/
 * location and rating only on first expand, never eagerly on page load, so a grid of product
 * cards doesn't fire one Feign-backed call per card up front.
 */
@Component({
  selector: 'app-shop-detail-expander',
  standalone: true,
  imports: [StarRatingComponent, LoadingStateComponent],
  templateUrl: './shop-detail-expander.component.html',
  styleUrl: './shop-detail-expander.component.css',
})
export class ShopDetailExpanderComponent {
  @Input({ required: true }) retailerId!: string;
  /** Shown collapsed, before the shop details have loaded - typically the retailer name already
   * present on the product (Product.retailerName), so the badge isn't blank while collapsed. */
  @Input() collapsedLabel = 'View shop details';
  @Output() readonly shopSelected = new EventEmitter<string>();

  protected readonly expanded = signal(false);
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);
  protected readonly error = signal(false);
  protected readonly retailer = signal<RetailerSummary | null>(null);
  protected readonly rating = signal<RetailerRatingSummary | null>(null);

  constructor(private readonly retailers: RetailerService) {}

  toggle(): void {
    this.expanded.set(!this.expanded());
    if (this.expanded()) {
      this.onOpened();
    }
  }

  onOpened(): void {
    if (this.loaded() || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.retailers.getPublicSummary(this.retailerId).subscribe({
      next: (summary) => {
        this.retailer.set(summary);
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
    this.retailers.ratingSummary(this.retailerId).subscribe({
      next: (summary) => this.rating.set(summary),
      error: () => undefined, // rating is a nice-to-have; a failure here shouldn't block the rest of the panel
    });
  }

  selectShop(): void {
    this.shopSelected.emit(this.retailerId);
  }
}
