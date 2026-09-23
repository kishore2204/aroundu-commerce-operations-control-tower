import { Component, OnInit, effect, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { CategoryService } from '../../core/services/category.service';
import { ProductService } from '../../core/services/product.service';
import { CustomerZoneService } from '../../core/services/customer-zone.service';
import { ProductCategory } from '../../core/models/category.model';
import { Product } from '../../core/models/product.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ProductCardComponent, EmptyStateComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  readonly categories = signal<ProductCategory[]>([]);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);

  constructor(
    private readonly categoryService: CategoryService,
    private readonly productService: ProductService,
    protected readonly zone: CustomerZoneService,
    private readonly router: Router,
  ) {
    // Re-loads products whenever the active address/zone changes (e.g. via the header's
    // Change Address control) - no page reload needed. Waits out zone.loading(): otherwise this
    // effect's first run lands before the shell's initial getDefault() call resolves, firing an
    // unfiltered search(); a second, zone-filtered search() then fires the moment the address
    // arrives, doubling every product-card's own image/wishlist fetch (confirmed via a live
    // network trace showing each product's image request firing twice on Home).
    effect(() => {
      if (this.zone.loading()) return;
      const zoneId = this.zone.activeAddress()?.zoneId ?? undefined;
      this.loadProducts(zoneId);
    });
  }

  ngOnInit(): void {
    this.categoryService.active().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => this.categories.set([]),
    });
  }

  private loadProducts(zoneId: string | undefined): void {
    this.loading.set(true);
    this.productService.search({ page: 0, size: 20, zoneId }).subscribe({
      next: (page) => {
        this.products.set(page.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  browseCategory(category: ProductCategory): void {
    this.router.navigate(['/products'], { queryParams: { categoryId: category.id } });
  }
}
