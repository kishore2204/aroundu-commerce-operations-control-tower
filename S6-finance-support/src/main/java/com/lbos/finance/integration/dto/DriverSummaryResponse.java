package com.lbos.finance.integration.dto;

import java.util.UUID;

/** S6-local mirror of S5's DriverDto - only the fields this service needs. */
public record DriverSummaryResponse(UUID driverId, UUID fleetOwnerId) {
}
