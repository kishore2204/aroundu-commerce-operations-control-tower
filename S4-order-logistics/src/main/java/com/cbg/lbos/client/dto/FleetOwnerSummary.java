package com.cbg.lbos.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.UUID;

/**
 * S4-local mirror of S2's InternalFleetOwnerController.FleetOwnerValidationResponse.
 * S2 returns the DTO directly (no envelope).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FleetOwnerSummary(
        UUID fleetOwnerId,
        UUID userAccountId,
        String businessName,
        String profileStatus,
        String ownerStatus,
        String verificationStatus) {
}
