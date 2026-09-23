package com.cbg.lbos.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * S4-local mirror of S5's VehicleDto. S5 returns the DTO directly (no envelope).
 * vehicleStatus is deliberately a String - S5's enum is not imported here.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record VehicleSummary(
        UUID vehicleId,
        UUID fleetOwnerId,
        UUID updatedByAccountId,
        String registrationNumber,
        String vehicleType,
        String make,
        String model,
        Integer modelYear,
        BigDecimal capacityKg,
        String vehicleStatus) {
}
