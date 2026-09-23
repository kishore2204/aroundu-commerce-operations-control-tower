import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/auth/auth.service';
import { CustomerService } from '../../core/services/customer.service';
import { NotificationService, SupportService } from '../../core/services/notification.service';
import { CurrentUser, CustomerProfile } from '../../core/models/user.model';

describe('ProfileComponent', () => {
  const currentUser: CurrentUser = {
    id: 'u1',
    email: 'jane@example.com',
    phoneNumber: '9999999999',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'CUSTOMER',
    accountStatus: 'ACTIVE',
    passwordChangedOn: null,
    lastLoginAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const profile: CustomerProfile = {
    id: 'c1',
    userAccountId: 'u1',
    dateOfBirth: '1990-01-01',
    profileStatus: 'ACTIVE',
    rewardPointsBalance: 120,
  };

  function setup(overrides: {
    fetchCurrentUser?: jasmine.Spy;
    me?: jasmine.Spy;
    update?: jasmine.Spy;
    mineNotifications?: jasmine.Spy;
    mineTickets?: jasmine.Spy;
    createTicket?: jasmine.Spy;
    userAccountId?: () => string | null;
  } = {}) {
    const fetchCurrentUser = overrides.fetchCurrentUser ?? jasmine.createSpy().and.returnValue(of(currentUser));
    const me = overrides.me ?? jasmine.createSpy().and.returnValue(of(profile));
    const update = overrides.update ?? jasmine.createSpy().and.returnValue(of(profile));
    const mine = overrides.mineNotifications ?? jasmine.createSpy().and.returnValue(of([]));
    const mineTickets = overrides.mineTickets ?? jasmine.createSpy().and.returnValue(of([]));
    const createTicket = overrides.createTicket ?? jasmine.createSpy();
    const userAccountId = overrides.userAccountId ?? (() => 'u1');

    TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: AuthService, useValue: { fetchCurrentUser, userAccountId, role: () => 'CUSTOMER' as const } },
        { provide: CustomerService, useValue: { me, update } },
        { provide: NotificationService, useValue: { mine } },
        { provide: SupportService, useValue: { mine: mineTickets, create: createTicket } },
      ],
    });

    const fixture = TestBed.createComponent(ProfileComponent);
    return { fixture, fetchCurrentUser, me, update, mine, mineTickets, createTicket };
  }

  it('should create', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads the current user and profile, rendering the name and reward balance', () => {
    const { fixture } = setup();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.value.dateOfBirth).toBe('1990-01-01');
    const text = fixture.debugElement.query(By.css('.read-only')).nativeElement.textContent;
    expect(text).toContain('Jane Doe');
    expect(fixture.debugElement.query(By.css('.rewards')).nativeElement.textContent).toContain('120');
  });

  it('saves the profile with the updated date of birth', () => {
    const { fixture, update } = setup();
    fixture.detectChanges();

    fixture.componentInstance.form.setValue({ dateOfBirth: '1991-02-02' });
    fixture.componentInstance.save();

    expect(update).toHaveBeenCalledWith({ dateOfBirth: '1991-02-02' });
    expect(fixture.componentInstance.saved()).toBeTrue();
  });
});
