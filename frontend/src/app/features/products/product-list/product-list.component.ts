import { Component, OnInit, inject, effect, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ProductCardComponent } from '../../../shared/product-card/product-card.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ProductService } from '../../../core/services/product.service';
import { CategoryService } from '../../../core/services/category.service';
import { CustomerZoneService } from '../../../core/services/customer-zone.service';
import { Product } from '../../../core/models/product.model';
import { ProductCategory } from '../../../core/models/category.model';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [ReactiveFormsModule, ProductCardComponent, EmptyStateComponent],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css',
})
export class ProductListComponent implements OnInit {
  readonly categories = signal<ProductCategory[]>([]);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  private readonly fb = inject(FormBuilder);

  readonly filters = this.fb.nonNullable.group({
    q: '',
    categoryId: null as number | null,
    inStock: false,
  });

  /** Set from ?retailerId= (see ProductCardComponent's "select this shop" action) - not a
   * user-editable filter control, so it lives outside the reactive form. */
  private retailerId: string | null = null;

  constructor(
    private readonly productService: ProductService,
    private readonly categoryService: CategoryService,
    private readonly zone: CustomerZoneService,
    private readonly route: ActivatedRoute,
  ) {
    const categoryIdParam = this.route.snapshot.queryParamMap.get('categoryId');
    if (categoryIdParam) {
      this.filters.patchValue({ categoryId: Number(categoryIdParam) });
    }
    const searchParam = this.route.snapshot.queryParamMap.get('q');
    if (searchParam) {
      this.filters.patchValue({ q: searchParam });
    }
    this.retailerId = this.route.snapshot.queryParamMap.get('retailerId');

    // Re-loads whenever the active address/zone changes (header's Change Address control) -
    // no page reload needed. Also covers the initial load, with the query-param filters above
    // already applied since they're set synchronously before this effect first runs.
    // The reaction must depend ONLY on the active address: load() itself reads the page/filter
    // signals, and without untracked() this effect also re-ran (resetting to page 0 and issuing a
    // second request) every time the customer changed page - duplicating the request and undoing
    // the page change.
    // Also waits out zone.loading() for the same reason as HomeComponent: without it, this
    // effect's first run fires an unfiltered search() before the shell's initial address load
    // resolves, and a second, zone-filtered search() fires right after - doubling every
    // resulting product-card's image/wishlist fetch.
    effect(() => {
      if (this.zone.loading()) return;
      this.zone.activeAddress();
      untracked(() => {
        this.page.set(0);
        this.load();
      });
    });
  }

  ngOnInit(): void {
    this.categoryService.active().subscribe({ next: (c) => this.categories.set(c), error: () => {} });

    this.filters.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.page.set(0);
      this.load();
    });
  }

  changePage(page: number): void {
    this.page.set(page);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    const { q, categoryId, inStock } = this.filters.getRawValue();
    this.productService
      .search({
        q: q || undefined,
        categoryId: categoryId ?? undefined,
        retailerId: this.retailerId ?? undefined,
        inStock: inStock || undefined,
        zoneId: this.zone.activeAddress()?.zoneId ?? undefined,
        page: this.page(),
        size: 20,
      })
      .subscribe({
        next: (pageResult) => {
          this.products.set(pageResult.items);
          this.totalPages.set(pageResult.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
