/** S2 FleetOwnerDTO */
export interface FleetOwner {
  fleetOwnerId: string;
  userAccountId: string;
  operationsManagerId: string | null;
  cityId: string;
  zoneId: string | null;
  businessName: string | null;
  bankVerifiedByAccountId: string | null;
  profileStatus: string;
  ownerStatus: string;
}

/**
 * Registration/update request. As with RetailerRequest, userAccountId is @NotNull-validated
 * on FleetOwnerDTO even though the controller overwrites it from the JWT before persisting,
 * and cityId/zoneId are raw UUIDs with no in-app lookup (S1's cities/zones endpoints are
 * staff-only) - see retailer.model.ts for the fuller explanation, identical situation here.
 */
export interface FleetOwnerRequest {
  userAccountId: string;
  cityId: string;
  zoneId?: string | null;
  businessName: string;
  profileStatus: string;
  ownerStatus: string;
}
