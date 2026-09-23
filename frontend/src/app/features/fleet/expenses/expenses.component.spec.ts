import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { FleetExpensesComponent } from './expenses.component';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { ExpenseService } from '../../../core/services/expense.service';
import { FleetOwner } from '../../../core/models/fleet-owner.model';

describe('FleetExpensesComponent', () => {
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
      imports: [FleetExpensesComponent],
      providers: [
        { provide: FleetOwnerService, useValue: { resolveMine: () => of(owner) } },
        { provide: ExpenseService, useValue: { mine } },
      ],
    });
    const fixture = TestBed.createComponent(FleetExpensesComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should create', () => {
    const fixture = setup(jasmine.createSpy().and.returnValue(of([])));
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the empty state when there are no expenses', () => {
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
