package com.cbg.lbos.dto;

import java.util.UUID;

/**
 * Response contract for S3's {@code OrderLogisticsClient.reviewEligibility}, matching the
 * shape S3 has expected since its own integration pass (same field names/order as S3's local
 * {@code ReviewEligibilityResponse} record).
 */
public record ReviewEligibilityResponse(
        boolean eligible,
        Long orderId,
        UUID customerProfileId,
        Long productId,
        String reasonCode) {
}
