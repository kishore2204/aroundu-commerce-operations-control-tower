import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { OrderDetailComponent } from './order-detail.component';
import { OrderService } from '../../../core/services/order.service';
import { SupportService } from '../../../core/services/notification.service';
import { CustomerService } from '../../../core/services/customer.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Order, OrderTracking } from '../../../core/models/order.model';

describe('OrderDetailComponent', () => {
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
    orderStatus: 'WAITING_FOR_RETAILER',
    statusHistoryJson: '[]',
    orderTrackingJson: '{}',
    deliveryAddress: '12 Main St',
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
  const tracking: OrderTracking = {
    orderId: 1,
    orderNumber: 'ORD-1',
    orderStatus: 'WAITING_FOR_RETAILER',
    orderTrackingJson: '{}',
    updatedDatetime: new Date().toISOString(),
    slaStatus: 'IN_PROGRESS',
    displayStage: 'Waiting for Retailer',
    steps: [{ key: 'ORDER_PLACED', label: 'Order Placed', state: 'DONE', reachedAt: null }],
    haltedState: null,
  };

  function setup(orderServiceSpy: Partial<OrderService>) {
    TestBed.configureTestingModule({
      imports: [OrderDetailComponent],
      providers: [
        { provide: OrderService, useValue: orderServiceSpy },
        { provide: SupportService, useValue: { create: () => of({ ticketNumber: 'TCK-1' }) } },
        { provide: CustomerService, useValue: { me: () => of({ id: 'c1' }) } },
        { provide: AuthService, useValue: { userAccountId: () => 'u1' } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', '1']]) } } },
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(OrderDetailComponent);
    return fixture;
  }

  it('renders the display stage from tracking rather than the raw orderStatus', fakeAsync(() => {
    const fixture = setup({ get: () => of(order), getTracking: () => of(tracking) });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const chip = fixture.debugElement.query(By.css('.badge'));
    expect(chip.nativeElement.textContent).toContain('Waiting for Retailer');
    fixture.destroy();
  }));

  it('polls tracking again after the interval elapses', fakeAsync(() => {
    let calls = 0;
    const fixture = setup({
      get: () => of(order),
      getTracking: () => {
        calls++;
        return of(tracking);
      },
    });
    fixture.detectChanges();
    tick();
    expect(calls).toBe(1);

    tick(5000);
    expect(calls).toBe(2);
    fixture.destroy();
  }));

  it('shows an empty state when the order cannot be found', fakeAsync(() => {
    const fixture = setup({ get: () => of(null as unknown as Order), getTracking: () => of(tracking) });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
    fixture.destroy();
  }));
});
