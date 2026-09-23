import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { FleetAssignmentsComponent } from './assignments.component';
import { OrderService } from '../../../core/services/order.service';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { DriverService } from '../../../core/services/driver.service';
import { TripService } from '../../../core/services/trip.service';
import { AssignmentService } from '../../../core/services/assignment.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Order } from '../../../core/models/order.model';

describe('FleetAssignmentsComponent', () => {
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
    orderStatus: 'FINDING_DELIVERY_PARTNER',
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

  function setup(hasFleetAssets: boolean) {
    TestBed.configureTestingModule({
      imports: [FleetAssignmentsComponent],
      providers: [
        { provide: OrderService, useValue: { pendingFleetAssignment: () => of([order]) } },
        { provide: FleetOwnerService, useValue: { resolveMine: () => of({ fleetOwnerId: 'f1' } as any) } },
        {
          provide: VehicleService,
          useValue: { mine: () => of(hasFleetAssets ? [{ vehicleId: 'v1', vehicleStatus: 'ACTIVE' }] : []) },
        },
        {
          provide: DriverService,
          useValue: { mine: () => of(hasFleetAssets ? [{ driverId: 'd1', driverStatus: 'ACTIVE' }] : []) },
        },
        { provide: TripService, useValue: { create: jasmine.createSpy().and.returnValue(of({ id: 't1' })) } },
        { provide: AuthService, useValue: { userAccountId: () => 'me-1' } },
        { provide: AssignmentService, useValue: { mine: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(FleetAssignmentsComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('lists orders awaiting a delivery partner', () => {
    const fixture = setup(true);
    const rows = fixture.debugElement.queryAll(By.css('.items li'));
    expect(rows.length).toBe(1);
    expect(rows[0].nativeElement.textContent).toContain('ORD-1');
  });

  it('disables Accept and shows a warning when the fleet owner has no vehicle/driver yet', () => {
    const fixture = setup(false);
    expect(fixture.debugElement.query(By.css('.warn'))).not.toBeNull();
    const button = fixture.debugElement.query(By.css('button'));
    expect(button.nativeElement.disabled).toBeTrue();
  });

  it('creates a trip with the order id and the fleet owner\'s vehicle/driver on accept', () => {
    const fixture = setup(true);
    const tripService = TestBed.inject(TripService);

    fixture.componentInstance.accept(order);

    expect(tripService.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ orderId: 1, vehicleId: 'v1', driverId: 'd1', fleetOwnerId: 'f1' }),
    );
  });
});
