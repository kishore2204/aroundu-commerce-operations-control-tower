import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { FleetVehiclesComponent } from './vehicles.component';
import { VehicleService } from '../../../core/services/vehicle.service';
import { VerificationQueueService } from '../../../core/services/verification-queue.service';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { Vehicle } from '../../../core/models/vehicle.model';
import { FleetOwner } from '../../../core/models/fleet-owner.model';

describe('FleetVehiclesComponent', () => {
  const fleetOwner: FleetOwner = {
    fleetOwnerId: 'f1',
    userAccountId: 'u1',
    operationsManagerId: null,
    cityId: 'city-1',
    zoneId: null,
    businessName: 'Acme Fleet',
    bankVerifiedByAccountId: null,
    profileStatus: 'VERIFIED',
    ownerStatus: 'ACTIVE',
  };

  const vehicle: Vehicle = {
    vehicleId: 'v1',
    fleetOwnerId: 'f1',
    updatedByAccountId: null,
    registrationNumber: 'TN01AB1234',
    vehicleType: 'MINI_TRUCK',
    make: 'Tata',
    model: 'Ace',
    modelYear: 2022,
    capacityKg: 500,
    vehicleStatus: 'ACTIVE',
  };

  function setup(options: {
    vehicleServiceSpy: Partial<VehicleService>;
    queueServiceSpy?: Partial<VerificationQueueService>;
    owner?: FleetOwner | null;
  }) {
    const owner = options.owner === undefined ? null : options.owner;
    TestBed.configureTestingModule({
      imports: [FleetVehiclesComponent],
      providers: [
        { provide: VehicleService, useValue: options.vehicleServiceSpy },
        { provide: VerificationQueueService, useValue: options.queueServiceSpy ?? {} },
        {
          provide: FleetOwnerService,
          useValue: { myFleetOwner: () => owner, resolveMine: () => of(owner) },
        },
      ],
    });
    const fixture = TestBed.createComponent(FleetVehiclesComponent);
    return fixture;
  }

  it('should create', () => {
    const fixture = setup({ vehicleServiceSpy: { mine: () => of([]) } });
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the empty state when this fleet owner has no vehicles', () => {
    const fixture = setup({ vehicleServiceSpy: { mine: () => of([]) }, owner: fleetOwner });
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
  });

  it('loads and lists this fleet owner\'s vehicles', () => {
    const mine = jasmine.createSpy().and.returnValue(of([vehicle]));
    const fixture = setup({ vehicleServiceSpy: { mine }, owner: fleetOwner });
    fixture.detectChanges();

    expect(mine).toHaveBeenCalledWith('f1');
    const rows = fixture.debugElement.queryAll(By.css('.items li'));
    expect(rows.length).toBe(1);
    expect(rows[0].nativeElement.textContent).toContain('TN01AB1234');
  });

  it('adds a vehicle and submits it for verification on save', () => {
    const add = jasmine.createSpy().and.returnValue(
      of({ vehicleId: 'v2', verificationQueueId: 'q1', verificationStatus: 'PENDING' }),
    );
    const rememberVehicleId = jasmine.createSpy();
    const submitForVerification = jasmine.createSpy().and.returnValue(of(undefined));
    const fixture = setup({
      vehicleServiceSpy: { mine: () => of([]), add, rememberVehicleId },
      queueServiceSpy: { submitForVerification },
      owner: fleetOwner,
    });
    fixture.detectChanges();

    fixture.componentInstance.form.setValue({
      registrationNumber: 'TN01AB1234',
      vehicleType: 'MINI_TRUCK',
      make: 'Tata',
      model: 'Ace',
      modelYear: 2022,
      capacityKg: 500,
    });
    fixture.componentInstance.save();

    expect(add).toHaveBeenCalledWith('f1', jasmine.objectContaining({ registrationNumber: 'TN01AB1234' }));
    expect(rememberVehicleId).toHaveBeenCalledWith('v2');
    expect(submitForVerification).toHaveBeenCalledWith('q1');
  });

  it('does not save while the form is invalid', () => {
    const add = jasmine.createSpy().and.returnValue(of({ vehicleId: 'v2', verificationQueueId: 'q1', verificationStatus: 'PENDING' }));
    const fixture = setup({
      vehicleServiceSpy: { mine: () => of([]), add },
      owner: fleetOwner,
    });
    fixture.detectChanges();

    fixture.componentInstance.save();

    expect(add).not.toHaveBeenCalled();
  });
});
