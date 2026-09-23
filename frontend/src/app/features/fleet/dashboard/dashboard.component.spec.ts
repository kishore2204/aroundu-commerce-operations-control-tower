import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { FleetDashboardComponent } from './dashboard.component';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { DriverService } from '../../../core/services/driver.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { AssignmentService } from '../../../core/services/assignment.service';
import { TripService } from '../../../core/services/trip.service';
import { FleetOwner } from '../../../core/models/fleet-owner.model';

describe('FleetDashboardComponent', () => {
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

  function setup(
    myFleetOwner: FleetOwner | null,
    driverCount: number,
    vehicleCount: number,
    assignments: { assignmentStatus: string }[] = [],
    trips: unknown[] = [],
  ) {
    TestBed.configureTestingModule({
      imports: [FleetDashboardComponent],
      providers: [
        {
          provide: FleetOwnerService,
          useValue: { myFleetOwner: () => myFleetOwner, resolveMine: () => of(myFleetOwner) },
        },
        { provide: DriverService, useValue: { mine: () => of(new Array(driverCount).fill({})) } },
        { provide: VehicleService, useValue: { mine: () => of(new Array(vehicleCount).fill({})) } },
        { provide: AssignmentService, useValue: { mine: () => of(assignments) } },
        { provide: TripService, useValue: { mine: () => of(trips) } },
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(FleetDashboardComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('creates', () => {
    const fixture = setup(owner, 0, 0);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the counts of drivers and vehicles', () => {
    const fixture = setup(owner, 2, 1);
    expect(fixture.componentInstance.driverCount()).toBe(2);
    expect(fixture.componentInstance.vehicleCount()).toBe(1);
    const values = fixture.debugElement.queryAll(By.css('.value'));
    expect(values[0].nativeElement.textContent).toContain('2');
    expect(values[1].nativeElement.textContent).toContain('1');
  });

  it('shows the fleet owner business name and status when available', () => {
    const fixture = setup(owner, 0, 0);
    const subtitle = fixture.debugElement.query(By.css('h1 + p.subtitle'));
    expect(subtitle.nativeElement.textContent).toContain('Speedy Logistics');
    expect(subtitle.nativeElement.textContent).toContain('VERIFIED');
  });

  it('omits the subtitle when there is no fleet owner yet', () => {
    const fixture = setup(null, 0, 0);
    expect(fixture.debugElement.query(By.css('h1 + p.subtitle'))).toBeNull();
  });
});
