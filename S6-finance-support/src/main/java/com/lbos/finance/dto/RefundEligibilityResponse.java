package com.lbos.finance.dto;

import java.util.List;
import java.util.UUID;

/**
 * Backend-owned refund eligibility decision for a support ticket. A ticket is eligible only when
 * it is a supported customer refund/return claim, references a delivered order with a completed
 * trip and a successful captured payment, and at least one order item still has refundable value.
 */
public record RefundEligibilityResponse(
        boolean eligible,
        String reason,
        UUID paymentTransactionId,
        List<RefundableOrderItemResponse> items) {
}
