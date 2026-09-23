export type DriverStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LICENSE_EXPIRED';

/** S5 DriverDto */
export interface Driver {
  driverId: string;
  fleetOwnerId: string;
  userAccountId: string;
  cityId: string;
  cityName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  licenseNumber: string;
  licenseExpiryDate: string;
  licenseDocumentUrl?: string;
  driverStatus: DriverStatus;
}

export interface AddDriverRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  userAccountId?: string;
  cityId: string;
  cityName?: string;
  licenseNumber: string;
  licenseExpiryDate: string;
  licenseDocumentUrl?: string;
}

export interface AddDriverResult {
  driverId: string;
  verificationQueueId?: string;
  verificationStatus?: string;
  email?: string;
  password?: string;
}

