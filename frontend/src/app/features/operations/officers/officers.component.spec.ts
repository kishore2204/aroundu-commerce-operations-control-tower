import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OfficersComponent } from './officers.component';
import { LocationManagerAssignmentService } from '../../../core/services/location-manager-assignment.service';
import { UserAccountService } from '../../../core/services/user-account.service';
import { TerritoryService } from '../../../core/services/territory.service';
import { OperationsManagerService } from '../../../core/services/operations-manager.service';
import { LocationManagerAssignment } from '../../../core/models/location-manager-assignment.model';

describe('OfficersComponent', () => {
  const assignment: LocationManagerAssignment = {
    locationManagerId: 'lm1',
    userAccountId: 'u1',
    firstName: 'Asha',
    lastName: 'Rao',
    email: 'asha@example.com',
    zoneId: 'z1',
    zoneName: 'North',
    cityId: 'c1',
    cityName: 'Bengaluru',
    operationsManagerId: 'om1',
    operationsManagerAccountId: null,
    assignmentStatus: 'ACTIVE',
    assignedAt: '2026-01-01',
  };

  function setup(overrides: { content?: LocationManagerAssignment[] } = {}) {
    const service = {
      list: jasmine.createSpy().and.returnValue(
        of({ content: overrides.content ?? [assignment], totalElements: 1, totalPages: 1, size: 100, number: 0 }),
      ),
      create: jasmine.createSpy().and.returnValue(of(assignment)),
      setActive: jasmine.createSpy().and.returnValue(of(assignment)),
    };

    TestBed.configureTestingModule({
      imports: [OfficersComponent],
      providers: [
        { provide: LocationManagerAssignmentService, useValue: service },
        { provide: UserAccountService, useValue: { byRole: () => of([]) } },
        { provide: TerritoryService, useValue: { zones: () => of({ content: [], totalElements: 0, totalPages: 0, size: 100, number: 0 }) } },
        { provide: OperationsManagerService, useValue: { list: () => of({ content: [], totalElements: 0, totalPages: 0, size: 100, number: 0 }) } },
      ],
    });

    const fixture = TestBed.createComponent(OfficersComponent);
    return { fixture, service };
  }

  it('should create', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads assignments on init', () => {
    const { fixture, service } = setup();
    fixture.detectChanges();

    expect(service.list).toHaveBeenCalled();
    expect(fixture.componentInstance.assignments()).toEqual([assignment]);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('deactivates an assignment and reloads the list', () => {
    const { fixture, service } = setup();
    fixture.detectChanges();

    fixture.componentInstance.setActive(assignment, false);

    expect(service.setActive).toHaveBeenCalledWith('lm1', false);
    expect(service.list).toHaveBeenCalledTimes(2);
  });
});
