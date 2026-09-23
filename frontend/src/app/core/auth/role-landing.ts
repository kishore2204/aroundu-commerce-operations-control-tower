import { Role } from '../models/user.model';

/** Base path for the verification-queue screens, shared by LOCATION_MANAGER/OPERATIONS_MANAGER/SUPER_ADMIN. */
export function queueBasePathFor(role: Role | null): string {
  switch (role) {
    case 'OPERATIONS_MANAGER':
      return '/operations/queue';
    case 'SUPER_ADMIN':
      return '/admin/queue';
    default:
      return '/location/queue';
  }
}

/** Where to send a user right after login, based on role. Other roles land on /unavailable via roleGuard. */
export function landingRouteFor(role: Role): string[] {
  switch (role) {
    case 'CUSTOMER':
      return ['/home'];
    case 'RETAILER':
      return ['/retailer/dashboard'];
    case 'LOCATION_MANAGER':
      return ['/location/dashboard'];
    case 'OPERATIONS_MANAGER':
      return ['/operations/dashboard'];
    case 'FLEET_MANAGER':
      return ['/fleet/dashboard'];
    case 'DRIVER':
      return ['/driver/dashboard'];
    case 'SUPER_ADMIN':
      return ['/admin/dashboard'];
    case 'SUPPORT_STAFF':
      return ['/support-staff/dashboard'];
    default:
      return ['/unavailable'];
  }
}
