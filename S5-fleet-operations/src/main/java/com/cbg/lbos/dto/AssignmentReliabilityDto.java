package com.cbg.lbos.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record AssignmentReliabilityDto(UUID vehicleId, UUID driverId, long endedAssignmentCount, BigDecimal averageDurationHours, String reliabilityFlag) {
}
