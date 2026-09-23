export type VehicleStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'SUSPENDED' | 'RETIRED';

/** S5 VehicleDto */
export interface Vehicle {
  vehicleId: string;
  fleetOwnerId: string;
  updatedByAccountId: string | null;
  registrationNumber: string;
  vehicleType: string;
  make: string | null;
  model: string | null;
  modelYear: number | null;
  capacityKg: number | null;
  vehicleStatus: VehicleStatus;
  insuranceDocumentUrl?: string | null;
}

/**
 * S5's own VehicleController.create() (POST /api/vehicles) has no ownership check, so S5's
 * SecurityConfig locks list-all and every mutation there to SUPER_ADMIN/OPERATIONS_MANAGER -
 * a FLEET_MANAGER token gets 403. The real, ownership-checked path is S2's
 * FleetOwnerVehicleController (POST /api/fleet-owners/{fleetOwnerId}/vehicles).
 */
export interface AddVehicleRequest {
  registrationNumber: string;
  vehicleType: string;
  make: string;
  model: string;
  modelYear: number;
  capacityKg: number;
}

/** S2 FleetOwnerVehicleController.AddVehicleResponse */
export interface AddVehicleResult {
  vehicleId: string;
  verificationQueueId: string;
  verificationStatus: string;
}
