import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { landingRouteFor } from './role-landing';

/** Sends an already-logged-in visitor straight to their role's workspace instead of the public landing page. */
export const guestLandingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.role();
  return role ? router.createUrlTree(landingRouteFor(role)) : true;
};
