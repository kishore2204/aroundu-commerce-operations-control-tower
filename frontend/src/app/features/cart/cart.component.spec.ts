import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { CartComponent } from './cart.component';
import { CartService } from '../../core/services/cart.service';
import { Cart } from '../../core/models/cart.model';

describe('CartComponent', () => {
  const cart: Cart = {
    items: [
      {
        cartItemId: 'ci1',
        productId: 1,
        productName: 'Rice 5kg',
        retailerId: 'r1',
        retailerName: 'Fresh Mart',
        quantity: 2,
        unitPrice: 250,
        lineTotal: 500,
        availableStock: 5,
        productActive: true,
      },
    ],
    distinctProducts: 1,
    totalQuantity: 2,
    subtotal: 500,
  };

  function setup(cartServiceSpy: Partial<CartService>) {
    TestBed.configureTestingModule({
      imports: [CartComponent],
      providers: [{ provide: CartService, useValue: cartServiceSpy }, provideRouter([]), provideHttpClient()],
    });
    const fixture = TestBed.createComponent(CartComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders each cart line with its shop name', () => {
    const fixture = setup({ get: () => of(cart) });
    const shop = fixture.debugElement.query(By.css('.shop'));
    expect(shop.nativeElement.textContent).toContain('Fresh Mart');
  });

  it('shows an empty state when the cart has no items', () => {
    const fixture = setup({ get: () => of({ items: [], distinctProducts: 0, totalQuantity: 0, subtotal: 0 }) });
    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.items'))).toBeNull();
  });

  it('embeds the address selector once the cart has items', () => {
    const fixture = setup({ get: () => of(cart) });
    expect(fixture.debugElement.query(By.css('app-cart-address-selector'))).not.toBeNull();
  });
});
