import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';
import { FleetOwnerService } from '../services/fleet-owner.service';

/** Redirects a FLEET_MANAGER with no resolved fleet-owner business profile to onboarding. */
export const fleetOwnerProfileGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const fleetOwnerService = inject(FleetOwnerService);
  const router = inject(Router);

  if (fleetOwnerService.myFleetOwner() && fleetOwnerService.myFleetOwner()?.userAccountId === auth.userAccountId()) {
    return of(fleetOwnerService.myFleetOwner()?.profileStatus === 'VERIFIED' && fleetOwnerService.myFleetOwner()?.ownerStatus === 'ACTIVE'
      ? true : router.createUrlTree(['/fleet/onboarding']));
  }

  return fleetOwnerService.resolveMine().pipe(
    map((owner) => (owner?.profileStatus === 'VERIFIED' && owner.ownerStatus === 'ACTIVE' ? true : router.createUrlTree(['/fleet/onboarding']))),
    catchError(() => of(router.createUrlTree(['/fleet/onboarding']))),
  );
};
