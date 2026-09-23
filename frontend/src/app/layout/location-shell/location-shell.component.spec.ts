import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LocationShellComponent } from './location-shell.component';
import { AuthService } from '../../core/auth/auth.service';

describe('LocationShellComponent', () => {
  function setup() {
    const logout = jasmine.createSpy('logout');
    TestBed.configureTestingModule({
      imports: [LocationShellComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { logout, email: () => 'location@example.com' } },
      ],
    });
    const fixture = TestBed.createComponent(LocationShellComponent);
    const router = TestBed.inject(Router);
    return { fixture, logout, router };
  }

  it('should create', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('logs out and navigates to /login', () => {
    const { fixture, logout, router } = setup();
    fixture.detectChanges();
    const navigateSpy = spyOn(router, 'navigate');

    fixture.componentInstance.logout();

    expect(logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
