export type AssignmentStatus = 'ACTIVE' | 'ENDED';

/** S5 VehicleAssignmentDto */
export interface VehicleAssignment {
  vehicleAssignmentId: string;
  vehicleId: string;
  driverId: string;
  assignedByAccountId: string | null;
  assignmentStatus: AssignmentStatus;
  assignedAt: string;
  endedAt: string | null;
  cargoWeightKg: number | null;
  requiredVehicleType: string | null;
}
