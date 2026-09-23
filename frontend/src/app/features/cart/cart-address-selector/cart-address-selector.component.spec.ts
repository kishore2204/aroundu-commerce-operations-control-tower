import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CartAddressSelectorComponent } from './cart-address-selector.component';
import { AddressService } from '../../../core/services/address.service';
import { CartService } from '../../../core/services/cart.service';
import { TerritoryService } from '../../../core/services/territory.service';
import { Address } from '../../../core/models/address.model';
import { Cart } from '../../../core/models/cart.model';

describe('CartAddressSelectorComponent', () => {
  const address: Address = {
    id: 'a1',
    cityId: 'c1',
    cityName: 'Chennai',
    zoneId: 'z1',
    zoneName: 'North',
    addressTag: 'HOME',
    line1: '12 Main St',
    line2: null,
    postalCode: null,
    latitude: null,
    longitude: null,
    defaultAddress: false,
  };
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

  function setup(cartServiceSpy: Partial<CartService>, addressServiceSpy: Partial<AddressService> = {}) {
    TestBed.configureTestingModule({
      imports: [CartAddressSelectorComponent],
      providers: [
        { provide: CartService, useValue: cartServiceSpy },
        {
          provide: AddressService,
          useValue: {
            list: () => of({ items: [address], page: 0, size: 50, totalElements: 1, totalPages: 1 }),
            setDefault: () => of(address),
            ...addressServiceSpy,
          },
        },
        { provide: TerritoryService, useValue: { cities: () => of({ content: [], totalElements: 0, totalPages: 0, size: 100, number: 0 }), zones: () => of({ content: [], totalElements: 0, totalPages: 0, size: 100, number: 0 }) } },
      ],
    });
    const fixture = TestBed.createComponent(CartAddressSelectorComponent);
    fixture.componentInstance.cart = cart;
    fixture.detectChanges();
    return fixture;
  }

  it('confirms the address immediately when every line is serviceable', () => {
    const fixture = setup({
      checkServiceability: () => of({ addressId: 'a1', allServiceable: true, lines: [] }),
    });
    const confirmed: string[] = [];
    fixture.componentInstance.addressConfirmed.subscribe((id) => confirmed.push(id));

    fixture.componentInstance.onAddressPicked(address);

    expect(confirmed).toEqual(['a1']);
  });

  it('opens the conflict dialog instead of confirming when a line is unserviceable', () => {
    const fixture = setup({
      checkServiceability: () =>
        of({
          addressId: 'a1',
          allServiceable: false,
          lines: [{ productId: 1, retailerId: 'r1', serviceable: false, reasonCode: 'OUT_OF_RANGE', deliveryCharge: null, estimate: null }],
        }),
    });
    const confirmed: string[] = [];
    fixture.componentInstance.addressConfirmed.subscribe((id) => confirmed.push(id));

    fixture.componentInstance.onAddressPicked(address);

    expect(fixture.componentInstance.conflictData()).not.toBeNull();
    expect(confirmed).toEqual([]);
  });

  it('never confirms the address when the conflict dialog is dismissed without an action', () => {
    const fixture = setup({
      checkServiceability: () =>
        of({
          addressId: 'a1',
          allServiceable: false,
          lines: [{ productId: 1, retailerId: 'r1', serviceable: false, reasonCode: 'OUT_OF_RANGE', deliveryCharge: null, estimate: null }],
        }),
    });
    const confirmed: string[] = [];
    fixture.componentInstance.addressConfirmed.subscribe((id) => confirmed.push(id));

    fixture.componentInstance.onAddressPicked(address);
    fixture.componentInstance.onConflictClosed(undefined);

    expect(confirmed).toEqual([]);
  });
});
