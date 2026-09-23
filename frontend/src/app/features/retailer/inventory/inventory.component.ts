import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { InventoryService } from '../../../core/services/inventory.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { InventorySummary, StockAdjustmentType } from '../../../core/models/inventory.model';
import { Product } from '../../../core/models/product.model';
import { IntegerOnlyDirective } from '../../../shared/input-rules/integer-only.directive';

@Component({
  selector: 'app-retailer-inventory',
  standalone: true,
  imports: [IntegerOnlyDirective, ReactiveFormsModule, FormsModule, EmptyStateComponent],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css',
})
export class RetailerInventoryComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly products = signal<Product[]>([]);
  readonly summary = signal<InventorySummary | null>(null);
  readonly loading = signal(true);
  readonly adjusting = signal(false);
  readonly toastMessage = signal<string | null>(null);

  readonly searchControl = this.fb.nonNullable.control('');
  readonly statusControl = this.fb.control<string | null>(null);

  /** One shared `adjustQuantity` field bound to every row's input meant every row displayed
   *  (and edited) the same value at once - typing in one product's box visibly changed every
   *  other product's box too, even though the actual stock adjustment on submit still targeted
   *  the correct product. Keyed per product id so each row keeps its own quantity. */
  private readonly adjustQuantities = new Map<number, number>();

  quantityFor(productId: number): number {
    return this.adjustQuantities.get(productId) ?? 1;
  }

  setQuantityFor(productId: number, quantity: number): void {
    this.adjustQuantities.set(productId, quantity);
  }

  constructor(private readonly inventoryService: InventoryService) {}

  ngOnInit(): void {
    this.loadSummary();
    this.searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.load());
    this.statusControl.valueChanges.subscribe(() => this.load());
    this.load();
  }

  private loadSummary(): void {
    this.inventoryService.summary().subscribe({ next: (s) => this.summary.set(s), error: () => {} });
  }

  private load(): void {
    this.loading.set(true);
    this.inventoryService
      .search(this.searchControl.value || undefined, undefined, this.statusControl.value || undefined, 0, 50)
      .subscribe({
        next: (page) => {
          this.products.set(page.items);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  adjust(product: Product, type: StockAdjustmentType): void {
    const quantity = this.quantityFor(product.id);
    if (quantity < 1) return;
    this.adjusting.set(true);
    this.inventoryService.adjust({ productId: product.id, type, quantity }).subscribe({
      next: () => {
        this.adjusting.set(false);
        this.load();
        this.loadSummary();
      },
      error: (err) => {
        this.adjusting.set(false);
        this.toastMessage.set(extractErrorMessage(err));
        setTimeout(() => this.toastMessage.set(null), 3000);
      },
    });
  }
}
