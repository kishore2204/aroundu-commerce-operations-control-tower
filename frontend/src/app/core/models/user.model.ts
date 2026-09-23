export type Role =
  | 'CUSTOMER'
  | 'RETAILER'
  | 'LOCATION_MANAGER'
  | 'OPERATIONS_MANAGER'
  | 'FLEET_MANAGER'
  | 'SUPER_ADMIN'
  | 'SUPPORT_STAFF'
  | 'DRIVER';

/** Roles that can act as a support-ticket handler (assign/resolve/close/escalate, list-all,
 *  see internal notes) - mirrors S6's SupportTicketController/SecurityConfig STAFF_ROLES. */
export const SUPPORT_STAFF_ROLES: Role[] = ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_STAFF', 'LOCATION_MANAGER'];

/** Platform-internal roles - the only ones whose business actions are written to the audit log. */
export const INTERNAL_ROLES: Role[] = ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'LOCATION_MANAGER', 'SUPPORT_STAFF'];

export interface LoginRequest {
  email: string;
  password: string;
}

/** S1 LoginResponseDto */
export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  userAccountId: string;
  email: string;
  role: Role;
}

/** S1 CustomerRegistrationRequestDto - POST /api/v1/auth/register/customer */
export interface CustomerRegistrationRequest {
  email: string;
  phoneNumber: string;
  password: string;
  firstName: string;
  lastName: string;
  termsAccepted: boolean;
}

export interface PublicRegistrationRequest {
  email: string;
  phoneNumber: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'CUSTOMER' | 'RETAILER' | 'FLEET_MANAGER';
  termsAccepted: boolean;
}

/** S1 ForgotPasswordRequestDto/ResponseDto - POST /api/v1/auth/forgot-password.
 *  resetToken/resetLink are dev-mode only (no email provider exists in this codebase) - a real
 *  deployment would email the link and leave both null here. */
export interface ForgotPasswordResponse {
  message: string;
  resetToken: string | null;
  resetLink: string | null;
}

/** S1 ResetPasswordRequestDto - POST /api/v1/auth/reset-password */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}


/** S1 UserAccountResponseDto - GET /api/v1/users/me */
export interface CurrentUser {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: Role;
  accountStatus: string;
  passwordChangedOn: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCurrentUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}

/** S3 CustomerResponse - GET/PATCH /api/v1/customers/me */
export interface CustomerProfile {
  id: string;
  userAccountId: string;
  dateOfBirth: string | null;
  profileStatus: string;
  rewardPointsBalance: number;
}

/** S3 UpdateCustomerRequest */
export interface UpdateCustomerRequest {
  dateOfBirth: string | null;
}
