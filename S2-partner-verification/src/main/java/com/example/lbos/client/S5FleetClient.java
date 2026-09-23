package com.example.lbos.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * S2 -> S5 direction, added for the driver/vehicle verification workflow: once a DRIVER or
 * VEHICLE verification-queue entry is APPROVED (see VerificationQueueServiceImpl.
 * processVerificationResult), this activates the corresponding driver/vehicle in S5 so it
 * moves from INACTIVE to ACTIVE. Targets S5's /internal/v1/** surface, gated by the shared
 * HTTP Basic credential (see ServiceBasicAuthFeignConfig) - not the public, JWT-gated
 * /api/** surface. POST rather than PATCH: Feign's default client doesn't support the PATCH
 * HTTP verb at all (java.net.HttpURLConnection-based, throws "Invalid HTTP method: PATCH") -
 * confirmed live, not a hypothetical.
 */
@FeignClient(name = "lbos-fleet", contextId = "partnerFleetClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface S5FleetClient {

    @PostMapping("/internal/v1/drivers/{id}/activate")
    void activateDriver(@PathVariable("id") UUID id);

    @PostMapping("/internal/v1/vehicles/{id}/activate")
    void activateVehicle(@PathVariable("id") UUID id);

    /** Used when a Location Manager revokes a previously-APPROVED DRIVER verification. */
    @PostMapping("/internal/v1/drivers/{id}/suspend")
    void suspendDriver(@PathVariable("id") UUID id);

    /** Used when a Location Manager revokes a previously-APPROVED VEHICLE verification. */
    @PostMapping("/internal/v1/vehicles/{id}/suspend")
    void suspendVehicle(@PathVariable("id") UUID id);

    /**
     * Creates the actual Driver record in S5 (owner of Driver operational data) on behalf of a
     * Fleet Owner adding a driver through S2's onboarding flow (FleetOwnerDriverController) -
     * S2 only orchestrates the verification side, it never stores driver data itself. Field
     * names/types mirror S5's DriverDto exactly so Feign's JSON body deserializes straight into
     * it; driverId/driverStatus are left absent (server-set by DriverServiceImpl.create(),
     * which always forces INACTIVE regardless of what's supplied).
     */
    @PostMapping("/internal/v1/drivers")
    DriverCreationResponse createDriver(@RequestBody DriverCreationRequest request);

    /** Same idea as {@link #createDriver}, for Vehicle. */
    @PostMapping("/internal/v1/vehicles")
    VehicleCreationResponse createVehicle(@RequestBody VehicleCreationRequest request);

    @org.springframework.web.bind.annotation.GetMapping("/internal/v1/drivers/{id}")
    DriverInfo getDriver(@PathVariable("id") UUID id);

    @org.springframework.web.bind.annotation.GetMapping("/internal/v1/vehicles/{id}")
    VehicleInfo getVehicle(@PathVariable("id") UUID id);

    @org.springframework.web.bind.annotation.GetMapping("/internal/v1/fleet-owners/{fleetOwnerId}/drivers")
    java.util.List<DriverInfo> driversOf(@PathVariable("fleetOwnerId") UUID fleetOwnerId);

    @org.springframework.web.bind.annotation.GetMapping("/internal/v1/fleet-owners/{fleetOwnerId}/vehicles")
    java.util.List<VehicleInfo> vehiclesOf(@PathVariable("fleetOwnerId") UUID fleetOwnerId);

    record DriverInfo(UUID driverId, String firstName, String lastName, String email, String driverStatus) {
    }

    record VehicleInfo(UUID vehicleId, String registrationNumber, String vehicleType, String make, String model,
                       Integer modelYear, BigDecimal capacityKg, String vehicleStatus) {
    }

    record DriverCreationRequest(UUID fleetOwnerId, UUID userAccountId, UUID cityId, String licenseNumber,
                                  LocalDate licenseExpiryDate) {
    }

    record DriverCreationResponse(UUID driverId, String driverStatus) {
    }

    record VehicleCreationRequest(UUID fleetOwnerId, String registrationNumber, String vehicleType, String make,
                                   String model, Integer modelYear, BigDecimal capacityKg) {
    }

    record VehicleCreationResponse(UUID vehicleId, String vehicleStatus) {
    }
}
