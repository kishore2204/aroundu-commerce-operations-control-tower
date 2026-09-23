import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { RetailerOrdersComponent } from './orders.component';
import { OrderService } from '../../../core/services/order.service';
import { RetailerService } from '../../../core/services/retailer.service';
import { Order } from '../../../core/models/order.model';

describe('RetailerOrdersComponent', () => {
  function order(overrides: Partial<Order> = {}): Order {
    return {
      id: 1,
      orderNumber: 'ORD-1',
      customerProfileId: 'c1',
      orderType: 'RETAIL',
      orderDate: new Date().toISOString(),
      subtotalAmount: 250,
      deliveryCharge: 49,
      discountAmount: 0,
      totalAmount: 299,
      orderStatus: 'WAITING_FOR_RETAILER',
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
      ...overrides,
    };
  }

  function setup(orderServiceSpy: Partial<OrderService>) {
    TestBed.configureTestingModule({
      imports: [RetailerOrdersComponent],
      providers: [
        { provide: OrderService, useValue: orderServiceSpy },
        { provide: RetailerService, useValue: { resolveMine: () => of({ retailerId: 'r1' } as any) } },
      ],
    });
    const fixture = TestBed.createComponent(RetailerOrdersComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows Accept/Reject only for orders waiting on the retailer', () => {
    const fixture = setup({
      mineForRetailer: () => of([order({ id: 1, orderStatus: 'WAITING_FOR_RETAILER' }), order({ id: 2, orderStatus: 'DELIVERED' })]),
    });
    const rows = fixture.debugElement.queryAll(By.css('.items li'));
    expect(rows[0].queryAll(By.css('.actions button')).length).toBe(2);
    expect(rows[1].query(By.css('.actions'))).toBeNull();
  });

  it('calls retailerAccept with the order id when Accept is clicked', () => {
    const retailerAccept = jasmine.createSpy().and.returnValue(of(order()));
    const fixture = setup({ mineForRetailer: () => of([order()]), retailerAccept });

    fixture.componentInstance.accept(order());

    expect(retailerAccept).toHaveBeenCalledWith(1);
  });

  it('calls retailerReject with the order id when Reject is clicked', () => {
    const retailerReject = jasmine.createSpy().and.returnValue(of(order()));
    const fixture = setup({ mineForRetailer: () => of([order()]), retailerReject });

    fixture.componentInstance.reject(order());

    expect(retailerReject).toHaveBeenCalledWith(1, {});
  });
});
