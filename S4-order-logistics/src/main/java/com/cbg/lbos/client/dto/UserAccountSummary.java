package com.cbg.lbos.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.UUID;

/**
 * S4-local mirror of the subset of S1's UserAccountResponseDto that S4 needs.
 * S1 returns the DTO directly from /internal/v1/user-accounts/{id}.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record UserAccountSummary(
        UUID id,
        String role,
        String accountStatus) {
}
