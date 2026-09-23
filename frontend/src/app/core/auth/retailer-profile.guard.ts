import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';
import { RetailerService } from '../services/retailer.service';

export const retailerProfileGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const retailerService = inject(RetailerService);
  const router = inject(Router);

  if (retailerService.myRetailer() && retailerService.myRetailer()?.userAccountId === auth.userAccountId()) {
    return of(retailerService.myRetailer()?.retailerStatus === 'VERIFIED' ? true : router.createUrlTree(['/retailer/onboarding']));
  }

  return retailerService.resolveMine().pipe(
    map((retailer) => (retailer?.retailerStatus === 'VERIFIED' ? true : router.createUrlTree(['/retailer/onboarding']))),
    catchError(() => of(router.createUrlTree(['/retailer/onboarding']))),
  );
};
