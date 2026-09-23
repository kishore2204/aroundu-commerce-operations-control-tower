import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { FleetOnboardingComponent } from './onboarding.component';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FleetOwner } from '../../../core/models/fleet-owner.model';

describe('FleetOnboardingComponent', () => {
  const owner: FleetOwner = {
    fleetOwnerId: 'f1',
    userAccountId: 'u1',
    operationsManagerId: null,
    cityId: 'city-1',
    zoneId: null,
    businessName: 'Acme Fleet',
    bankVerifiedByAccountId: null,
    profileStatus: 'PENDING_VERIFICATION',
    ownerStatus: 'INACTIVE',
  };

  function setup(fleetOwnerServiceSpy: Partial<FleetOwnerService>) {
    TestBed.configureTestingModule({
      imports: [FleetOnboardingComponent],
      providers: [
        { provide: FleetOwnerService, useValue: fleetOwnerServiceSpy },
        { provide: AuthService, useValue: { userAccountId: () => 'u1' } },
      ],
    });
    const fixture = TestBed.createComponent(FleetOnboardingComponent);
    return fixture;
  }

  it('should create', () => {
    const fixture = setup({ resolveMine: () => of(null) });
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the registration form when the user has no fleet owner profile yet', () => {
    const fixture = setup({ resolveMine: () => of(null) });
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('form'))).not.toBeNull();
  });

  it('registers a fleet owner using the current user id and the entered form values', () => {
    const register = jasmine.createSpy().and.returnValue(of(owner));
    const fixture = setup({ resolveMine: () => of(null), register });
    fixture.detectChanges();

    fixture.componentInstance.registerForm.setValue({
      businessName: 'Acme Fleet',
      cityId: 'city-1',
      zoneId: '',
    });
    fixture.componentInstance.register();

    expect(register).toHaveBeenCalledWith(
      jasmine.objectContaining({ userAccountId: 'u1', businessName: 'Acme Fleet', cityId: 'city-1' }),
    );
  });

  it('does not submit the registration form while it is invalid', () => {
    const register = jasmine.createSpy().and.returnValue(of(owner));
    const fixture = setup({ resolveMine: () => of(null), register });
    fixture.detectChanges();

    fixture.componentInstance.register();

    expect(register).not.toHaveBeenCalled();
  });

  it('fetches the verification status once a fleet owner profile is found', () => {
    const verificationStatus = jasmine.createSpy().and.returnValue(of({ status: 'PENDING_VERIFICATION' }));
    const fixture = setup({ resolveMine: () => of(owner), verificationStatus });
    fixture.detectChanges();

    expect(verificationStatus).toHaveBeenCalledWith('f1');
  });
});
