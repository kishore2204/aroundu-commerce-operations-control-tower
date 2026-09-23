/**
 * S4 TripDto (request side only - id/tripStatus/timestamps/enrichment are server-set). Creating
 * one IS the fleet owner's "accept this delivery" action - see TripService.create() on S4,
 * which already sets tripStatus=PLANNED and syncs the parent Order to VEHICLE_ASSIGNED with no
 * changes needed there.
 */
export interface CreateTripRequest {
  orderId: number;
  vehicleId: string;
  driverId: string;
  fleetOwnerId: string;
  createdByAccountId?: string | null;
  tripNumber: string;
  /** Must be a future instant (ISO string) - TripService.validateCreateRequest() on S4 rejects
   *  a null or past plannedStartAt. */
  plannedStartAt: string;
}

/**
 * S4's PUT /api/trips/{id} takes the whole object back (not a patch) - assignment fields
 * (vehicleId/driverId/fleetOwnerId) must match the trip's current values unless it's still
 * PLANNED/ASSIGNED, per TripService.validateAssignmentWasNotChanged()/updateTripAssignment().
 */
export interface UpdateTripRequest {
  orderId: number;
  vehicleId: string;
  driverId: string;
  fleetOwnerId: string;
  tripNumber: string;
  tripStatus: string;
  plannedStartAt: string | null;
  distanceKm?: number | null;
  proofOfPickup?: string | null;
  proofOfDelivery?: string | null;
}

/** S4 TripDto - returned directly (no envelope). */
export interface Trip {
  id: string;
  orderId: number;
  vehicleId: string;
  driverId: string;
  fleetOwnerId: string;
  tripNumber: string;
  tripStatus: string;
  plannedStartAt: string | null;
  actualStartAt: string | null;
  completedAt: string | null;
  distanceKm: number | null;
  proofOfPickup?: string | null;
  proofOfDelivery?: string | null;
  /** Read-only enrichment computed server-side (TripService.toDto()) - null unless the trip is
   *  COMPLETED and the assigned driver has a commissionPercent on file. */
  orderDeliveryCharge?: number | null;
  driverEarning?: number | null;
  pickupAddress?: string | null;
  dropAddress?: string | null;
}

/** S4 TripStatusHistoryDto - GET /api/trips/{id}/history. */
export interface TripStatusHistoryEntry {
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  changedByAccountId: string | null;
}
