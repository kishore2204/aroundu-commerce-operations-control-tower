import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models/user.model';
import { AuthService } from './auth.service';

/** Restricts a route subtree to one or more roles; other authenticated roles are redirected to /unavailable. */
export function roleGuard(...allowedRoles: Role[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }
    if (auth.role() && allowedRoles.includes(auth.role()!)) {
      return true;
    }
    return router.createUrlTree(['/unavailable']);
  };
}
