import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ShellComponent } from './shell.component';
import { AuthService } from '../../core/auth/auth.service';
import { CartService } from '../../core/services/cart.service';

describe('ShellComponent', () => {
  function setup(
    cartGet = jasmine
      .createSpy()
      .and.returnValue(of({ items: [], distinctProducts: 0, totalQuantity: 3, subtotal: 0 })),
  ) {
    const logout = jasmine.createSpy('logout');
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { logout, email: () => 'customer@example.com' } },
        { provide: CartService, useValue: { get: cartGet, itemCount: () => 3 } },
      ],
    });
    const fixture = TestBed.createComponent(ShellComponent);
    const router = TestBed.inject(Router);
    return { fixture, logout, router, cartGet };
  }

  it('should create', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('fetches the cart on init to sync the nav badge', () => {
    const { fixture, cartGet } = setup();
    fixture.detectChanges();

    expect(cartGet).toHaveBeenCalled();
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
