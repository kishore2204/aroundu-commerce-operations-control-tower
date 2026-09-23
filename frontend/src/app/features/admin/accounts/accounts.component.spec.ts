import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { AdminAccountsComponent } from './accounts.component';
import { UserAccountService } from '../../../core/services/user-account.service';
import { UserAccount } from '../../../core/models/user-account.model';

describe('AdminAccountsComponent', () => {
  const account: UserAccount = {
    id: 'a1',
    email: 'ann@example.com',
    phoneNumber: '9999999999',
    firstName: 'Ann',
    lastName: 'Lee',
    role: 'CUSTOMER',
    accountStatus: 'ACTIVE',
    passwordChangedOn: null,
    lastLoginAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  function setup(userAccountServiceSpy: Partial<UserAccountService>) {
    TestBed.configureTestingModule({
      imports: [AdminAccountsComponent],
      providers: [{ provide: UserAccountService, useValue: userAccountServiceSpy }],
    });
    const fixture = TestBed.createComponent(AdminAccountsComponent);
    return fixture;
  }

  it('should create', () => {
    const fixture = setup({ all: () => of([]) });
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads and renders accounts sorted by email on init', () => {
    const other: UserAccount = { ...account, id: 'a2', email: 'ben@example.com' };
    const all = jasmine.createSpy().and.returnValue(of([other, account]));
    const fixture = setup({ all });
    fixture.detectChanges();

    expect(all).toHaveBeenCalled();
    expect(fixture.componentInstance.accounts().map((a) => a.email)).toEqual(['ann@example.com', 'ben@example.com']);
    const items = fixture.debugElement.queryAll(By.css('li'));
    expect(items.length).toBe(2);
  });

  it('filters the list as the search control changes', () => {
    const fixture = setup({ all: () => of([account]) });
    fixture.detectChanges();

    fixture.componentInstance.searchControl.setValue('nomatch');
    expect(fixture.componentInstance.filtered().length).toBe(0);

    fixture.componentInstance.searchControl.setValue('ann');
    expect(fixture.componentInstance.filtered().length).toBe(1);
  });

  it('calls setStatus with the toggled status and reloads on success', () => {
    const all = jasmine.createSpy().and.returnValue(of([account]));
    const setStatus = jasmine.createSpy().and.returnValue(of({ ...account, accountStatus: 'SUSPENDED' }));
    const fixture = setup({ all, setStatus });
    fixture.detectChanges();

    fixture.componentInstance.setStatus(account, 'SUSPENDED');

    expect(setStatus).toHaveBeenCalledWith('a1', 'SUSPENDED');
    expect(all).toHaveBeenCalledTimes(2);
  });

  it('creates a new account and closes the form on success', () => {
    const all = jasmine.createSpy().and.returnValue(of([account]));
    const create = jasmine.createSpy().and.returnValue(of(account));
    const fixture = setup({ all, create });
    fixture.detectChanges();

    fixture.componentInstance.showForm.set(true);
    fixture.componentInstance.form.setValue({
      firstName: 'Ann',
      lastName: 'Lee',
      email: 'ann@example.com',
      phoneNumber: '9999999999',
      role: 'CUSTOMER',
      password: 'password1',
    });
    fixture.componentInstance.save();

    expect(create).toHaveBeenCalledWith(
      jasmine.objectContaining({ email: 'ann@example.com', accountStatus: 'ACTIVE' }),
    );
    expect(fixture.componentInstance.showForm()).toBeFalse();
  });
});
