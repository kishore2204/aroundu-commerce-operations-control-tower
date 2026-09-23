import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { FleetTripsComponent } from './trips.component';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { TripService } from '../../../core/services/trip.service';
import { FleetOwner } from '../../../core/models/fleet-owner.model';

describe('FleetTripsComponent', () => {
  const owner: FleetOwner = {
    fleetOwnerId: 'f1',
    userAccountId: 'u1',
    operationsManagerId: null,
    cityId: 'city-1',
    zoneId: null,
    businessName: 'Speedy Logistics',
    bankVerifiedByAccountId: null,
    profileStatus: 'VERIFIED',
    ownerStatus: 'ACTIVE',
  };

  function setup(mine: jasmine.Spy) {
    TestBed.configureTestingModule({
      imports: [FleetTripsComponent],
      providers: [
        { provide: FleetOwnerService, useValue: { resolveMine: () => of(owner) } },
        { provide: TripService, useValue: { mine } },
      ],
    });
    const fixture = TestBed.createComponent(FleetTripsComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should create', () => {
    const fixture = setup(jasmine.createSpy().and.returnValue(of([])));
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the empty state when there are no trips', () => {
    const fixture = setup(jasmine.createSpy().and.returnValue(of([])));
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
  });

  it('shows the empty state on error', () => {
    const fixture = setup(jasmine.createSpy().and.returnValue(throwError(() => new Error('network error'))));
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
  });
});
