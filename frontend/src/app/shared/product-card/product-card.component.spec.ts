import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { ProductCardComponent } from './product-card.component';
import { Product } from '../../core/models/product.model';

describe('ProductCardComponent', () => {
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
    stock: 10,
    status: 'ACTIVE',
    inventoryStatus: 'HEALTHY',
    description: '',
    qualityFlag: null,
    lowStockThreshold: null,
  };

  async function setup(overrides: Partial<Product> = {}) {
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = { ...product, ...overrides };
    fixture.detectChanges();
    return fixture;
  }

  it('renders the product name and price', async () => {
    const fixture = await setup();
    const name = fixture.debugElement.query(By.css('.name'));
    expect(name.nativeElement.textContent).toContain('Rice 5kg');
  });

  it('hides the out-of-stock chip when stock is positive', async () => {
    const inStock = await setup({ stock: 5 });
    expect(inStock.debugElement.query(By.css('.out-of-stock'))).toBeNull();
  });

  it('shows the out-of-stock chip when stock is zero', async () => {
    const outOfStock = await setup({ stock: 0 });
    expect(outOfStock.debugElement.query(By.css('.out-of-stock'))).not.toBeNull();
  });

  it('always renders the shop-detail-expander with the product\'s retailerId', async () => {
    const fixture = await setup();
    const expander = fixture.debugElement.query(By.css('app-shop-detail-expander'));
    expect(expander).not.toBeNull();
    expect(expander.componentInstance.retailerId).toBe('r1');
  });
});
