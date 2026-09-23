export type AssignmentStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TRANSFERRED';

/** S1 LocationManagerDto */
export interface LocationManagerAssignment {
  locationManagerId: string;
  userAccountId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  zoneId: string;
  zoneName: string | null;
  cityId: string | null;
  cityName: string | null;
  operationsManagerId: string;
  operationsManagerAccountId: string | null;
  assignmentStatus: AssignmentStatus;
  assignedAt: string | null;
  /** Where the officer was before their latest transfer (history is kept server-side). */
  previousZoneName?: string | null;
  previousCityName?: string | null;
  lastTransferredAt?: string | null;
}

/**
 * userAccountId (the officer being assigned) and operationsManagerId (their supervisor) are
 * raw UUIDs the caller must already know - GET /api/v1/operations-managers/by-user/{id} (which
 * would let an OM self-resolve their own operationsManagerId) is SUPER_ADMIN-only at both the
 * Gateway and S1 (deliberately, not a gap - see docs/api-catalog.md), so there is no in-app
 * lookup for it today.
 */
export interface LocationManagerAssignmentRequest {
  userAccountId: string;
  zoneId: string;
  operationsManagerId: string;
}
