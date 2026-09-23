package com.cbg.lbos.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.UUID;

/**
 * S4-local mirror of the name/phone subset of S1's UserAccountResponseDto - what a customer sees
 * of the driver assigned to their order. Same S1 endpoint as {@link UserAccountSummary}.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record UserContactSummary(UUID id, String firstName, String lastName, String phoneNumber) {
}
