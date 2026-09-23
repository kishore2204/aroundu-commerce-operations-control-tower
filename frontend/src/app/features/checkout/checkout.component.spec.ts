import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { CheckoutComponent } from './checkout.component';
import { CartService } from '../../core/services/cart.service';
import { AddressService } from '../../core/services/address.service';
import { CheckoutService } from '../../core/services/checkout.service';
import { Cart } from '../../core/models/cart.model';
import { CheckoutSummary } from '../../core/models/checkout.model';

describe('CheckoutComponent', () => {
  const cart: Cart = {
    items: [
      {
        cartItemId: 'ci1',
        productId: 1,
        productName: 'Rice 5kg',
        retailerId: 'r1',
        retailerName: 'Fresh Mart',
        quantity: 1,
        unitPrice: 250,
        lineTotal: 250,
        availableStock: 5,
        productActive: true,
      },
    ],
    distinctProducts: 1,
    totalQuantity: 1,
    subtotal: 250,
  };

  function setup(checkoutServiceSpy: Partial<CheckoutService>) {
    TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        { provide: CartService, useValue: { get: () => of(cart), clear: () => of(undefined) } },
        {
          provide: AddressService,
          useValue: { getDefault: () => of(null), list: () => of({ items: [], page: 0, size: 50, totalElements: 0, totalPages: 0 }) },
        },
        { provide: CheckoutService, useValue: checkoutServiceSpy },
        provideRouter([]),
        provideHttpClient(),
      ],
    });
    const fixture = TestBed.createComponent(CheckoutComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows an empty-cart state when there is nothing to check out', () => {
    TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        { provide: CartService, useValue: { get: () => of({ items: [], distinctProducts: 0, totalQuantity: 0, subtotal: 0 }) } },
        {
          provide: AddressService,
          useValue: { getDefault: () => of(null), list: () => of({ items: [], page: 0, size: 50, totalElements: 0, totalPages: 0 }) },
        },
        { provide: CheckoutService, useValue: { prepare: () => of(null) } },
        provideRouter([]),
        provideHttpClient(),
      ],
    });
    const fixture = TestBed.createComponent(CheckoutComponent);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
  });

  it('populates the summary after a successful prepare() call', () => {
    const summary: CheckoutSummary = {
      addressId: 'a1',
      items: cart.items,
      subtotal: 250,
      tax: 10,
      deliveryCharge: 49,
      grandTotal: 309,
      serviceable: true,
      pointsRedeemed: 0,
      pointsEarned: 0,
      rewardPointsBalance: 0,
      serviceabilityLines: [],
    };
    const fixture = setup({ prepare: () => of(summary) });
    fixture.componentInstance.selectedAddressId = 'a1';

    fixture.componentInstance.prepare();

    expect(fixture.componentInstance.summary()?.grandTotal).toBe(309);
  });

  it('opens the serviceability conflict dialog instead of placing the order when a line is unserviceable', () => {
    const summary: CheckoutSummary = {
      addressId: 'a1',
      items: cart.items,
      subtotal: 250,
      tax: 0,
      deliveryCharge: 0,
      grandTotal: 250,
      serviceable: false,
      pointsRedeemed: 0,
      pointsEarned: 0,
      rewardPointsBalance: 0,
      serviceabilityLines: [
        { productId: 1, retailerId: 'r1', serviceable: false, reasonCode: 'OUT_OF_RANGE', deliveryCharge: null, estimate: null },
      ],
    };
    const fixture = setup({ prepare: () => of(summary) });
    fixture.componentInstance.selectedAddressId = 'a1';

    fixture.componentInstance.placeOrder();

    expect(fixture.componentInstance.conflictData()).not.toBeNull();
    expect(fixture.componentInstance.step()).not.toBe('done');
  });

  it('surfaces a friendly error message when serviceability verification itself fails', () => {
    const fixture = setup({ prepare: () => throwError(() => new Error('network down')) });
    fixture.componentInstance.selectedAddressId = 'a1';

    fixture.componentInstance.placeOrder();

    expect(fixture.componentInstance.placeError()).toContain('serviceability');
  });
});
