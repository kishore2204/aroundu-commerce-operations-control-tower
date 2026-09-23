package com.cbg.lbos.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.UUID;

/**
 * S4-local mirror of S2's InternalRetailerController.RetailerContextResponse, returned by
 * GET /internal/v1/retailers/by-user/{userAccountId} - resolves which retailer a logged-in
 * RETAILER-role JWT subject owns, so S4 can verify a retailer-accept/reject caller actually
 * owns the order's line items (see OrderService.resolveActingRetailerId()).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RetailerContextSummary(
        UUID retailerId,
        UUID userAccountId,
        String businessName,
        UUID cityId) {
}
