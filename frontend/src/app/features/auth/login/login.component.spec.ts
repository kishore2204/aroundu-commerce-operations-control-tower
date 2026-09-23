import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router, convertToParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/auth/auth.service';

describe('LoginComponent', () => {
  function setup(
    authSpy: Partial<AuthService>,
    queryParams: Record<string, string> = {},
  ) {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: authSpy },
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
      ],
    });
    // LoginComponent's template uses routerLink, which needs a real Router (its constructor
    // subscribes to router.events) - a plain { navigate: jasmine.createSpy() } stand-in throws.
    // provideRouter([]) sets up the real service; we spy on its navigate method instead.
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return { fixture, router };
  }

  it('creates', () => {
    const { fixture } = setup({ login: () => of() as any });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows a session-expired notice when the query param is present', () => {
    const { fixture } = setup({ login: () => of() as any }, { sessionExpired: 'true' });
    expect(fixture.debugElement.query(By.css('.notice'))).not.toBeNull();
  });

  it('does not call login when the form is invalid', () => {
    const login = jasmine.createSpy('login');
    const { fixture } = setup({ login });
    fixture.componentInstance.submit();
    expect(login).not.toHaveBeenCalled();
  });

  it('navigates to the role landing route on successful login', () => {
    const login = jasmine
      .createSpy('login')
      .and.returnValue(of({ accessToken: 't', tokenType: 'Bearer', expiresInSeconds: 3600, userAccountId: 'u1', email: 'a@b.com', role: 'CUSTOMER' }));
    const { fixture, router } = setup({ login });

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret1' });
    fixture.componentInstance.submit();

    expect(login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret1' });
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('shows an error message when login fails', () => {
    const login = jasmine.createSpy('login').and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const { fixture } = setup({ login });

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'wrongpass' });
    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(fixture.componentInstance.errorMessage()).toContain('session has expired');
    expect(fixture.debugElement.query(By.css('.error'))).not.toBeNull();
  });
});
