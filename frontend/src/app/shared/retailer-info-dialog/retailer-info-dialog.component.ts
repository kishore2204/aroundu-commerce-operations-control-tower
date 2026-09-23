import { Component, EventEmitter, HostListener, Input, OnChanges, Output, signal } from '@angular/core';
import { RetailerService } from '../../core/services/retailer.service';
import { RetailerRatingSummary, RetailerSummary } from '../../core/models/retailer.model';
import { StarRatingComponent } from '../star-rating/star-rating.component';

/**
 * A modal (fixed overlay, same structural pattern as ServiceabilityConflictDialogComponent -
 * `@if`-rendered by the host, `closed` output, Escape-to-dismiss) showing one retailer's
 * details. Replaces the click-to-expand accordion (`ShopDetailExpanderComponent`) on product
 * cards, which grew that card's height in place and reflowed sibling cards in the same CSS-grid
 * row - a fixed-position overlay never affects card layout. `ShopDetailExpanderComponent` itself
 * is left untouched since it's also used on the order-tracking page.
 */
@Component({
  selector: 'app-retailer-info-dialog',
  standalone: true,
  imports: [StarRatingComponent],
  templateUrl: './retailer-info-dialog.component.html',
  styleUrl: './retailer-info-dialog.component.css',
})
export class RetailerInfoDialogComponent implements OnChanges {
  @Input({ required: true }) retailerId!: string;
  @Output() readonly closed = new EventEmitter<void>();
  /** "Browse this shop's other products" - same navigation the old shop-detail-expander's
   *  "Select this shop" button already did. */
  @Output() readonly shopSelected = new EventEmitter<string>();

  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly retailer = signal<RetailerSummary | null>(null);
  protected readonly rating = signal<RetailerRatingSummary | null>(null);

  constructor(private readonly retailers: RetailerService) {}

  ngOnChanges(): void {
    if (!this.retailerId) return;
    this.loading.set(true);
    this.error.set(false);
    this.retailers.getPublicSummary(this.retailerId).subscribe({
      next: (summary) => {
        this.retailer.set(summary);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
    this.retailers.ratingSummary(this.retailerId).subscribe({
      next: (summary) => this.rating.set(summary),
      error: () => undefined,
    });
  }

  @HostListener('document:keydown.escape')
  dismiss(): void {
    this.closed.emit();
  }

  browseShop(): void {
    this.shopSelected.emit(this.retailerId);
  }
}
