package com.lbos.finance.integration.dto;
import java.util.UUID;
import java.time.OffsetDateTime;
public record TripResponse(UUID tripId, Long orderId, UUID vehicleId, UUID driverId, UUID fleetOwnerId, String tripStatus, OffsetDateTime completedAt, String proofOfDelivery) { }
