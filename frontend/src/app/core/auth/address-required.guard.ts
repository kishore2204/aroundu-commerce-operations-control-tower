import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of } from 'rxjs';
import { CustomerZoneService } from '../services/customer-zone.service';

/**
 * A customer with no saved address is redirected to /add-address before seeing any other
 * Commerce Customer page (products, home, orders, etc.) - zone-based content everywhere else
 * depends on having one. Excludes /add-address itself (see app.routes.ts) to avoid a redirect
 * loop.
 */
export const addressRequiredGuard: CanActivateFn = () => {
  const zone = inject(CustomerZoneService);
  const router = inject(Router);

  if (zone.activeAddress()) {
    return of(true);
  }

  return zone.load().pipe(
    map((address) => (address ? true : router.createUrlTree(['/add-address']))),
  );
};
