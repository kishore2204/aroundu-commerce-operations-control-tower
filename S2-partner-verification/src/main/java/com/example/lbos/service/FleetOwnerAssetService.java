package com.example.lbos.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Fleet-Owner-initiated Driver/Vehicle onboarding: creates the record in S5 (owner of driver/
 * vehicle operational data) via Feign, then opens a VerificationQueue entry for it using S2's
 * existing common verification mechanism - the same one Retailer/FleetOwner onboarding already
 * uses. Kept separate from RetailerService/FleetOwnerService (which own the Retailer/FleetOwner
 * entities themselves) since this is about a fleet owner's *relationship* to drivers/vehicles,
 * not about the FleetOwner entity itself.
 */
public interface FleetOwnerAssetService {

    AddDriverResult addDriver(UUID fleetOwnerId, AddDriverCommand command);

    AddVehicleResult addVehicle(UUID fleetOwnerId, AddVehicleCommand command);

    record AddDriverCommand(UUID userAccountId, UUID cityId, String licenseNumber, LocalDate licenseExpiryDate,
                             UUID submittedByAccountId) {
    }

    record AddDriverResult(UUID driverId, UUID verificationQueueId, String verificationStatus) {
    }

    record AddVehicleCommand(String registrationNumber, String vehicleType, String make, String model,
                              Integer modelYear, BigDecimal capacityKg, UUID submittedByAccountId) {
    }

    record AddVehicleResult(UUID vehicleId, UUID verificationQueueId, String verificationStatus) {
    }
}
