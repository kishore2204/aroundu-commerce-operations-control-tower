/** S2 RetailerDTO */
export interface Retailer {
  retailerId: string;
  userAccountId: string;
  operationsManagerId: string | null;
  cityId: string;
  zoneId: string | null;
  longitude: number | null;
  latitude: number | null;
  businessName: string;
  registrationNumber: string | null;
  gstNumber: string | null;
  retailerStatus: string;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

/**
 * Registration/update request. cityId/zoneId are raw UUIDs the retailer must already know -
 * S1's /api/v1/cities and /api/v1/zones endpoints are SUPER_ADMIN/OPERATIONS_MANAGER-only
 * (a RETAILER token gets 403), so there is no in-app way to browse valid city/zone ids today.
 * This is a real backend gap, not an oversight in this form.
 *
 * userAccountId is @NotNull-validated on RetailerDTO even though the controller overwrites
 * it from the JWT before persisting (RetailerController.applyOwnerIdentity) - it must still
 * be present in the request body or validation fails with 400 before the controller runs.
 */
export interface RetailerRequest {
  userAccountId: string;
  cityId: string;
  zoneId?: string | null;
  longitude?: number | null;
  latitude?: number | null;
  businessName: string;
  registrationNumber?: string | null;
  gstNumber?: string | null;
  retailerStatus: string;
  isOpen?: boolean;
  opensAt?: string | null;
  closesAt?: string | null;
}

/** S2 VerificationDocumentDTO - submitted via POST /api/retailers/{id}/documents */
export interface VerificationDocumentRequest {
  documentTypeName: string;
  fileName?: string | null;
  expiryDate?: string | null;
  isCurrentVersion: boolean;
}

export interface VerificationStatusResponse {
  status: string;
  rejectionReason?: string;
  verificationQueueId?: string;
  /** Comma-separated current document types the reviewer rejected and wants uploaded again. */
  rejectedDocuments?: string;
}

/**
 * S3 RetailerRatingSummaryResponse - GET /api/v1/retailers/{id}/rating-summary. There is no
 * retailer rating anywhere else in the system; this is derived server-side from every review
 * left on the retailer's products, computed lazily (only when a shop card is expanded), not
 * included on the Product/ProductResponse itself.
 */
export interface RetailerRatingSummary {
  retailerId: string;
  average: number;
  count: number;
}

/**
 * S3's customer-facing mirror of S2's Retailer - GET /api/v1/retailers/{id}. Distinct from the
 * `Retailer` interface above (which is S2's own RetailerDTO, reached at /api/retailers/{id} and
 * only readable by RETAILER/staff roles) - this is the shape a CUSTOMER can actually read, used
 * by ShopDetailExpanderComponent.
 */
export interface RetailerSummary {
  retailerId: string;
  businessName: string;
  cityId: string;
  retailerStatus: string;
  zoneId: string | null;
  latitude: number | null;
  longitude: number | null;
}
