import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RetailerInventoryComponent } from './inventory.component';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventorySummary } from '../../../core/models/inventory.model';
import { Product } from '../../../core/models/product.model';

describe('RetailerInventoryComponent', () => {
  const summary: InventorySummary = { totalProducts: 3, totalStock: 90, lowStock: 1, outOfStock: 0 };

  function product(overrides: Partial<Product> = {}): Product {
    return {
      id: 1,
      name: 'Rice 5kg',
      sku: 'SKU-1',
      categoryId: 1,
      categoryName: 'Grocery',
      retailerId: 'r1',
      retailerName: 'Fresh Mart',
      retailerStatus: 'VERIFIED',
      retailerLatitude: null,
      retailerLongitude: null,
      unitPrice: 250,
      stock: 20,
      status: 'ACTIVE',
      inventoryStatus: 'HEALTHY',
      description: '',
      qualityFlag: null,
      lowStockThreshold: 5,
      ...overrides,
    };
  }

  function setup(inventoryServiceSpy: Partial<InventoryService>) {
    TestBed.configureTestingModule({
      imports: [RetailerInventoryComponent],
      providers: [
        { provide: InventoryService, useValue: inventoryServiceSpy },
      ],
    });
    const fixture = TestBed.createComponent(RetailerInventoryComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should create', () => {
    const fixture = setup({
      summary: () => of(summary),
      search: () => of({ items: [], page: 0, size: 50, totalElements: 0, totalPages: 0 }),
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads the summary and product list on init', () => {
    const fixture = setup({
      summary: () => of(summary),
      search: () => of({ items: [product()], page: 0, size: 50, totalElements: 1, totalPages: 1 }),
    });
    expect(fixture.componentInstance.summary()).toEqual(summary);
    expect(fixture.componentInstance.products()).toEqual([product()]);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('calls InventoryService.adjust with the product id, type, and quantity', () => {
    const adjust = jasmine.createSpy().and.returnValue(of({ productId: 1, resultingQuantity: 25, inventoryStatus: 'HEALTHY' }));
    const fixture = setup({
      summary: () => of(summary),
      search: () => of({ items: [product()], page: 0, size: 50, totalElements: 1, totalPages: 1 }),
      adjust,
    });
    fixture.componentInstance.adjustQuantity = 5;

    fixture.componentInstance.adjust(product(), 'ADD_STOCK');

    expect(adjust).toHaveBeenCalledWith({ productId: 1, type: 'ADD_STOCK', quantity: 5 });
  });
});
