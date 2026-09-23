import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { WishlistComponent } from './wishlist.component';
import { WishlistService } from '../../core/services/wishlist.service';
import { CartService } from '../../core/services/cart.service';
import { WishlistItem } from '../../core/models/wishlist.model';
import { Product } from '../../core/models/product.model';

describe('WishlistComponent', () => {
  const product: Product = {
    id: 1,
    name: 'Rice 5kg',
    sku: 'RICE-5KG',
    categoryId: 1,
    categoryName: 'Groceries',
    retailerId: 'r1',
    retailerName: 'Fresh Mart',
    retailerStatus: 'VERIFIED',
    retailerLatitude: null,
    retailerLongitude: null,
    unitPrice: 250,
    stock: 5,
    status: 'ACTIVE',
    inventoryStatus: 'HEALTHY',
    description: '',
    qualityFlag: null,
    lowStockThreshold: null,
  };
  const item: WishlistItem = { id: 'w1', product, createdAt: new Date().toISOString() };

  function setup(wishlistServiceSpy: Partial<WishlistService>) {
    TestBed.configureTestingModule({
      imports: [WishlistComponent],
      providers: [
        { provide: WishlistService, useValue: wishlistServiceSpy },
        { provide: CartService, useValue: { addItem: () => of(undefined) } },
        provideRouter([]),
        provideHttpClient(),
      ],
    });
    const fixture = TestBed.createComponent(WishlistComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders each wishlist item via the shared product card (so it shows the shop badge too)', () => {
    const fixture = setup({ list: () => of({ items: [item], page: 0, size: 50, totalElements: 1, totalPages: 1 }) });
    const card = fixture.debugElement.query(By.css('app-product-card'));
    expect(card).not.toBeNull();
    expect(card.componentInstance.product.name).toBe('Rice 5kg');
  });

  it('shows an empty state when the wishlist has no items', () => {
    const fixture = setup({ list: () => of({ items: [], page: 0, size: 50, totalElements: 0, totalPages: 0 }) });
    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
  });

  it('removes the wishlist item and reloads when Remove is clicked', () => {
    const remove = jasmine.createSpy().and.returnValue(of(undefined));
    const list = jasmine
      .createSpy()
      .and.returnValue(of({ items: [item], page: 0, size: 50, totalElements: 1, totalPages: 1 }));
    const fixture = setup({ list, remove });

    fixture.componentInstance.remove(item);

    expect(remove).toHaveBeenCalledWith('w1');
    expect(list).toHaveBeenCalledTimes(2); // once on init, once after remove
  });
});
