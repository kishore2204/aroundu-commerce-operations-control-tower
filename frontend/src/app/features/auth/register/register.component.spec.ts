import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../../core/auth/auth.service';

describe('RegisterComponent', () => {
  function setup(authSpy: Partial<AuthService>) {
    TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        { provide: AuthService, useValue: authSpy },
        provideRouter([]),
      ],
    });
    // RegisterComponent's template uses routerLink, which needs a real Router+ActivatedRoute
    // (RouterLink's constructor subscribes to router.events) - provideRouter([]) sets those up;
    // we spy on the real Router's navigate method instead of faking the whole service.
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    return { fixture, router };
  }

  const validValue = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phoneNumber: '9876543210',
    password: 'supersecret',
  };

  it('creates', () => {
    const { fixture } = setup({ registerCustomer: () => of({}) });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('does not call registerCustomer when the form is invalid', () => {
    const registerCustomer = jasmine.createSpy('registerCustomer');
    const { fixture } = setup({ registerCustomer });
    fixture.componentInstance.submit();
    expect(registerCustomer).not.toHaveBeenCalled();
  });

  it('shows a success message and redirects to login after registering', fakeAsync(() => {
    const registerCustomer = jasmine.createSpy('registerCustomer').and.returnValue(of({}));
    const { fixture, router } = setup({ registerCustomer });

    fixture.componentInstance.form.setValue(validValue);
    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(registerCustomer).toHaveBeenCalledWith(validValue);
    expect(fixture.componentInstance.success()).toBeTrue();
    expect(fixture.debugElement.query(By.css('.success'))).not.toBeNull();

    tick(1200);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  }));

  it('shows an error message when registration fails', () => {
    const registerCustomer = jasmine
      .createSpy('registerCustomer')
      .and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Email already in use' } })));
    const { fixture } = setup({ registerCustomer });

    fixture.componentInstance.form.setValue(validValue);
    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(fixture.componentInstance.errorMessage()).toBe('Email already in use');
    expect(fixture.debugElement.query(By.css('.error'))).not.toBeNull();
  });
});
