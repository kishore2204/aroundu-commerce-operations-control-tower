package com.cbg.lbos.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.UUID;

/**
 * S4-local mirror of the subset of S3's InternalCustomerController.CustomerProfileInternalResponse
 * that S4 needs. S3 returns the DTO directly (no envelope) from /api/v1/internal/customers/{id}.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CustomerSummary(
        UUID customerProfileId,
        UUID userAccountId,
        String profileStatus) {
}
