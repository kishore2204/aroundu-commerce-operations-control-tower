import { AssignmentStatus } from './location-manager-assignment.model';

/** S1 OperationsManagerDtos.Response */
export interface OperationsManagerAssignment {
  id: string;
  userAccountId: string;
  displayName: string | null;
  email: string | null;
  cityId: string;
  cityName: string | null;
  assignmentStatus: AssignmentStatus;
  assignedAt: string | null;
  updatedAt: string | null;
  version: number | null;
}

/** S1 OperationsManagerDtos.CreateRequest */
export interface OperationsManagerCreateRequest {
  userAccountId: string;
  cityId: string;
  assignmentStatus?: AssignmentStatus;
}

/** S1 OperationsManagerDtos.Summary */
export interface OperationsManagerSummary {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  transferred: number;
}
