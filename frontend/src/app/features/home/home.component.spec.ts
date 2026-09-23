import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { HomeComponent } from './home.component';
import { CategoryService } from '../../core/services/category.service';
import { ProductService } from '../../core/services/product.service';
import { Product } from '../../core/models/product.model';

describe('HomeComponent', () => {
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

  function setup() {
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        { provide: CategoryService, useValue: { active: () => of([]) } },
        { provide: ProductService, useValue: { search: () => of({ items: [product], page: 0, size: 20, totalElements: 1, totalPages: 1 }) } },
        provideRouter([]),
        provideHttpClient(),
      ],
    });
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders a product card per returned product', () => {
    const fixture = setup();
    expect(fixture.debugElement.queryAll(By.css('app-product-card')).length).toBe(1);
  });

  it('navigates to /products with the category id when a category chip is clicked', () => {
    const fixture = setup();
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    fixture.componentInstance.browseCategory({ id: 3, name: 'Groceries', description: '', status: 'ACTIVE' });

    expect(navigateSpy).toHaveBeenCalledWith(['/products'], { queryParams: { categoryId: 3 } });
  });
});
