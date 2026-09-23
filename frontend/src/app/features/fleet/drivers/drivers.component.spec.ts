import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { FleetDriversComponent } from './drivers.component';
import { DriverService } from '../../../core/services/driver.service';
import { VerificationQueueService } from '../../../core/services/verification-queue.service';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { Driver, AddDriverResult } from '../../../core/models/driver.model';
import { FleetOwner } from '../../../core/models/fleet-owner.model';

describe('FleetDriversComponent', () => {
  const driver: Driver = {
    driverId: 'd1',
    fleetOwnerId: 'f1',
    userAccountId: 'u1',
    cityId: 'city-1',
    verifiedByAccountId: null,
    licenseNumber: 'LIC-1',
    licenseExpiryDate: '2027-01-01',
    driverStatus: 'ACTIVE',
  };

  const fleetOwner: FleetOwner = {
    fleetOwnerId: 'f1',
    userAccountId: 'u-owner',
    operationsManagerId: null,
    cityId: 'city-1',
    zoneId: null,
    businessName: 'Fleet Co',
    bankVerifiedByAccountId: null,
    profileStatus: 'ACTIVE',
    ownerStatus: 'ACTIVE',
  };

  function setup(overrides: {
    mine?: jasmine.Spy;
    add?: jasmine.Spy;
    submitForVerification?: jasmine.Spy;
    myFleetOwner?: FleetOwner | null;
  } = {}) {
    const driverServiceSpy = {
      mine: overrides.mine ?? jasmine.createSpy().and.returnValue(of([driver])),
      add: overrides.add ?? jasmine.createSpy().and.returnValue(of<AddDriverResult>({ driverId: 'd2', verificationQueueId: 'q1', verificationStatus: 'PENDING' })),
      rememberDriverId: jasmine.createSpy(),
    };
    const queueServiceSpy = {
      submitForVerification: overrides.submitForVerification ?? jasmine.createSpy().and.returnValue(of(undefined)),
    };
    const owner = overrides.myFleetOwner === undefined ? fleetOwner : overrides.myFleetOwner;
    const fleetOwnerServiceSpy = {
      myFleetOwner: jasmine.createSpy().and.returnValue(owner),
      resolveMine: jasmine.createSpy().and.returnValue(of(owner)),
    };

    TestBed.configureTestingModule({
      imports: [FleetDriversComponent],
      providers: [
        { provide: DriverService, useValue: driverServiceSpy },
        { provide: VerificationQueueService, useValue: queueServiceSpy },
        { provide: FleetOwnerService, useValue: fleetOwnerServiceSpy },
      ],
    });

    const fixture = TestBed.createComponent(FleetDriversComponent);
    return { fixture, driverServiceSpy, queueServiceSpy, fleetOwnerServiceSpy };
  }

  it('should create', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads this fleet owner\'s drivers and renders them', () => {
    const { fixture } = setup();
    fixture.detectChanges();

    expect(fixture.componentInstance.drivers()).toEqual([driver]);
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.debugElement.query(By.css('.items'))).not.toBeNull();
  });

  it('shows the empty state when there are no drivers', () => {
    const { fixture } = setup({ mine: jasmine.createSpy().and.returnValue(of([])) });
    fixture.detectChanges();

    expect(fixture.componentInstance.drivers()).toEqual([]);
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
  });

  it('shows the empty state when the fetch fails', () => {
    const mine = jasmine.createSpy().and.returnValue(throwError(() => new Error('network error')));
    const { fixture } = setup({ mine });

    fixture.detectChanges();

    expect(fixture.componentInstance.drivers()).toEqual([]);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('adds a driver, submits it for verification, and reloads the list', () => {
    const { fixture, driverServiceSpy, queueServiceSpy } = setup();
    fixture.detectChanges();

    fixture.componentInstance.showForm.set(true);
    fixture.componentInstance.form.setValue({
      userAccountId: 'u1',
      cityId: 'city-1',
      licenseNumber: 'TN1420110012345',
      licenseExpiryDate: '2028-01-01',
    });

    fixture.componentInstance.save();

    expect(driverServiceSpy.add).toHaveBeenCalledWith('f1', {
      userAccountId: 'u1',
      cityId: 'city-1',
      licenseNumber: 'TN1420110012345',
      licenseExpiryDate: '2028-01-01',
    });
    expect(driverServiceSpy.rememberDriverId).toHaveBeenCalledWith('d2');
    expect(queueServiceSpy.submitForVerification).toHaveBeenCalledWith('q1');
    expect(fixture.componentInstance.showForm()).toBeFalse();
    expect(fixture.componentInstance.saving()).toBeFalse();
  });

  it('does not submit when the form is invalid', () => {
    const { fixture, driverServiceSpy } = setup();
    fixture.detectChanges();

    fixture.componentInstance.save();

    expect(driverServiceSpy.add).not.toHaveBeenCalled();
  });

  it('surfaces an error message when adding the driver fails', () => {
    const add = jasmine.createSpy().and.returnValue(throwError(() => ({ status: 400 })));
    const { fixture } = setup({ add });
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({
      userAccountId: 'u1',
      cityId: 'city-1',
      licenseNumber: 'TN1420110012345',
      licenseExpiryDate: '2028-01-01',
    });

    fixture.componentInstance.save();

    expect(fixture.componentInstance.saving()).toBeFalse();
    expect(fixture.componentInstance.formError()).toBeTruthy();
  });
});
