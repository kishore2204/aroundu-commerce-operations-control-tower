package com.cbg.lbos.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * S4-local mirror of S5's DriverDto. S5 returns the DTO directly (no envelope).
 * driverStatus is deliberately a String - S5's enum is not imported here.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DriverSummary(
        UUID driverId,
        UUID fleetOwnerId,
        UUID userAccountId,
        UUID cityId,
        UUID verifiedByAccountId,
        String licenseNumber,
        LocalDate licenseExpiryDate,
        String driverStatus,
        BigDecimal commissionPercent) {
}
