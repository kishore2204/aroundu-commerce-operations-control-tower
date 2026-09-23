import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ToastService } from '../../../shared/toast/toast.service';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { ProductDetailComponent } from './product-detail.component';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { WishlistService } from '../../../core/services/wishlist.service';
import { ReviewService } from '../../../core/services/review.service';
import { ProductDetails } from '../../../core/models/product.model';

describe('ProductDetailComponent', () => {
  const details: ProductDetails = {
    product: {
      id: 5,
      name: 'Organic Rice',
      sku: 'SKU-5',
      categoryId: 1,
      categoryName: 'Groceries',
      retailerId: 'r1',
      retailerName: 'Fresh Mart',
      retailerStatus: 'VERIFIED',
      retailerLatitude: 12.9,
      retailerLongitude: 77.5,
      unitPrice: 199,
      stock: 10,
      status: 'ACTIVE',
      inventoryStatus: 'HEALTHY',
      description: 'Locally sourced rice.',
      qualityFlag: null,
      lowStockThreshold: 5,
    },
    ratingSummary: { productId: 5, average: 4.2, count: 8, distribution: {} },
  };

  function setup(overrides: {
    getDetails?: jasmine.Spy;
    addItem?: jasmine.Spy;
    add?: jasmine.Spy;
    byProduct?: jasmine.Spy;
    create?: jasmine.Spy;
  } = {}) {
    const getDetails = overrides.getDetails ?? jasmine.createSpy().and.returnValue(of(details));
    const addItem = overrides.addItem ?? jasmine.createSpy().and.returnValue(of({}));
    const add = overrides.add ?? jasmine.createSpy().and.returnValue(of({}));
    const byProduct = overrides.byProduct ?? jasmine.createSpy().and.returnValue(of({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
    const create = overrides.create ?? jasmine.createSpy().and.returnValue(of({}));

    TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [
        { provide: ProductService, useValue: { getDetails } },
        { provide: CartService, useValue: { addItem } },
        { provide: WishlistService, useValue: { add } },
        { provide: ReviewService, useValue: { byProduct, create } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } },
      ],
    });

    const open = spyOn(ToastService.prototype, 'open');

    const fixture = TestBed.createComponent(ProductDetailComponent);
    return { fixture, getDetails, addItem, add, byProduct, create, open };
  }

  it('should create', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads the product from the route param and renders it', () => {
    const { fixture, getDetails } = setup();
    fixture.detectChanges();

    expect(getDetails).toHaveBeenCalledWith(5);
    expect(fixture.debugElement.query(By.css('h1')).nativeElement.textContent).toContain('Organic Rice');
  });

  it('calls CartService.addItem when adding the product to the cart', () => {
    const { fixture, addItem, open } = setup();
    fixture.detectChanges();

    fixture.componentInstance.addToCart(details);

    expect(addItem).toHaveBeenCalledWith({ productId: 5, quantity: 1 });
    expect(open).toHaveBeenCalledWith('Added to cart', 'Dismiss', { duration: 2500 });
  });
});
