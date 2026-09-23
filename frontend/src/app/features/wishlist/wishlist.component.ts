import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/toast/toast.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { WishlistService } from '../../core/services/wishlist.service';
import { extractErrorMessage } from '../../core/api/http-error.util';
import { WishlistItem } from '../../core/models/wishlist.model';

/**
 * Reuses the shared ProductCardComponent (previously hand-rolled its own product tile here,
 * duplicating markup already in shared/product-card) - every product listing, wishlist
 * included, must show its shop the same way, and this dedup gets that for free.
 */
@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, ProductCardComponent],
  templateUrl: './wishlist.component.html',
  styleUrl: './wishlist.component.css',
})
export class WishlistComponent implements OnInit {
  readonly items = signal<WishlistItem[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal(false);

  constructor(
    private readonly wishlistService: WishlistService,
    private readonly snackBar: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.wishlistService.list(0, 50).subscribe({
      next: (page) => {
        this.items.set(page.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(extractErrorMessage(err, 'Could not load your wishlist.'));
      },
    });
  }

  remove(item: WishlistItem): void {
    this.busy.set(true);
    this.wishlistService.remove(item.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.snackBar.show(extractErrorMessage(err), 'error');
      },
    });
  }
}
