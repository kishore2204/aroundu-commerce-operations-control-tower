package com.cbg.lbos.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.UUID;

/**
 * S4-local mirror of S2's InternalRetailerController.RetailerSummaryResponse.
 * S2 returns the DTO directly (no envelope).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RetailerSummary(
        UUID retailerId,
        UUID userAccountId,
        String businessName,
        UUID cityId) {
}
