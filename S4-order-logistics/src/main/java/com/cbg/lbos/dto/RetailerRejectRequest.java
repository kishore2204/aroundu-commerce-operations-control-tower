package com.cbg.lbos.dto;

/**
 * Optional free-text reason a retailer gives when rejecting an order
 * (e.g. "out of stock"). Stored on Order.cancellationReason.
 */
public record RetailerRejectRequest(String reason) {
}
