import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { OrderListComponent } from './order-list.component';
import { OrderService } from '../../../core/services/order.service';
import { CustomerService } from '../../../core/services/customer.service';
import { Order } from '../../../core/models/order.model';

describe('OrderListComponent', () => {
  const order: Order = {
    id: 1,
    orderNumber: 'ORD-1',
    customerProfileId: 'c1',
    orderType: 'RETAIL',
    orderDate: new Date().toISOString(),
    subtotalAmount: 250,
    deliveryCharge: 49,
    discountAmount: 0,
    totalAmount: 299,
    orderStatus: 'DELIVERED',
    statusHistoryJson: '[]',
    orderTrackingJson: '{}',
    deliveryAddress: null,
    deliveryLatitude: null,
    deliveryLongitude: null,
    paymentMethod: 'UPI',
    paymentStatus: 'PAID',
    transactionReference: null,
    cancellationReason: null,
    cancelledDatetime: null,
    cancellationFeeAmount: null,
    updatedDatetime: new Date().toISOString(),
  };

  function setup(mineForCustomer: () => ReturnType<OrderService['mineForCustomer']>) {
    TestBed.configureTestingModule({
      imports: [OrderListComponent],
      providers: [
        { provide: OrderService, useValue: { mineForCustomer } },
        { provide: CustomerService, useValue: { me: () => of({ id: 'c1', userAccountId: 'u1', dateOfBirth: null, profileStatus: 'ACTIVE', rewardPointsBalance: 0 }) } },
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(OrderListComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('fetches orders scoped to the current customer profile id', () => {
    const mineForCustomer = jasmine.createSpy().and.returnValue(of([order]));
    setup(mineForCustomer);
    expect(mineForCustomer).toHaveBeenCalledWith('c1');
  });

  it('lists every returned order', () => {
    const fixture = setup(() => of([order]));
    const rows = fixture.debugElement.queryAll(By.css('.items li'));
    expect(rows.length).toBe(1);
    expect(rows[0].nativeElement.textContent).toContain('ORD-1');
  });

  it('shows an empty state when there are no orders', () => {
    const fixture = setup(() => of([]));
    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
  });
});
