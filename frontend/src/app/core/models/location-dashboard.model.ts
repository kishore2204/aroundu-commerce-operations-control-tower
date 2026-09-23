/** S2 LocationDashboardDTOs - everything the Location Manager dashboard shows, already limited to their zone. */
export interface DashboardSummary {
  zoneName: string | null;
  cityName: string | null;
  from: string;
  to: string;
  // current state - not affected by the date range
  totalRetailers: number;
  activeRetailers: number;
  totalFleetOwners: number;
  activeFleetOwners: number;
  pendingVerifications: number;
  /** null when the order service could not be reached. */
  activeOrders: number | null;
  // activity inside the selected range
  completedVerifications: number;
  rejectedRequests: number;
  completedOrders: number | null;
  onboardingTrend: TrendPoint[];
  workload: WorkloadItem[];
  verificationBySubject: VerificationBySubject[];
}

export interface TrendPoint { date: string; retailers: number; fleetOwners: number; }
export interface WorkloadItem { category: string; subjectType: string; count: number; }
export interface VerificationBySubject { subjectType: string; pending: number; approved: number; rejected: number; }

export type ZoneUserType = 'RETAILER' | 'FLEET_OWNER';

export interface ZoneUserRow {
  userType: ZoneUserType;
  /** Only the handle for the detail calls - never shown. */
  id: string;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  onboardingStatus: string;
  verificationStatus: string;
  activationStatus: 'ACTIVE' | 'INACTIVE';
  pendingAction: 'REVIEW_DOCUMENTS' | 'AWAITING_REUPLOAD' | 'AWAITING_SUBMISSION' | 'NONE';
  verificationQueueId: string | null;
  onboardingStartedAt: string | null;
  rating: number | null;
  ratingCount: number | null;
}

export interface ZoneUserPage { items: ZoneUserRow[]; totalElements: number; page: number; size: number; }

export interface ZoneUserQuery {
  type: ZoneUserType;
  search?: string;
  onboardingStatus?: string;
  verificationStatus?: string;
  activation?: string;
  pendingAction?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
  page: number;
  size: number;
}

export interface RetailerReview { rating: number; comment: string | null; productName: string | null; createdAt: string; }
export interface RetailerReviewPage { average: number; count: number; items: RetailerReview[]; totalElements: number; page: number; size: number; }

export interface FleetDriver { name: string | null; status: string | null; rating: number | null; }
export interface FleetVehicle {
  registrationNumber: string | null;
  vehicleType: string | null;
  make: string | null;
  model: string | null;
  modelYear: number | null;
  capacityKg: number | null;
  status: string | null;
}
/** ratingsAvailable is false: the platform has no customer rating for fleet owners or drivers. */
export interface FleetAssets { drivers: FleetDriver[]; vehicles: FleetVehicle[]; ratingsAvailable: boolean; }
