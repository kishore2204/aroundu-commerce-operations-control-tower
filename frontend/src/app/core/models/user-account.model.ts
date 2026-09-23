/** S1 UserAccountResponseDto */
export interface UserAccount {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: string;
  accountStatus: string;
  passwordChangedOn: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** S1 UserAccountRequestDto - password required on create, omit on update to leave unchanged (server-dependent). */
export interface UserAccountRequest {
  email: string;
  phoneNumber: string;
  password?: string;
  firstName: string;
  lastName: string;
  role: string;
  accountStatus: string;
}

export type PlatformRole =
  | 'SUPER_ADMIN'
  | 'OPERATIONS_MANAGER'
  | 'LOCATION_MANAGER'
  | 'RETAILER'
  | 'FLEET_MANAGER'
  | 'CUSTOMER';
