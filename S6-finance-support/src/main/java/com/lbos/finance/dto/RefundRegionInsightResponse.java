package com.lbos.finance.dto;

import java.math.BigDecimal;

/**
 * Refund insight grouped by the delivery region derived from the order's persisted delivery-address
 * snapshot. No new database field/table is introduced; the report is calculated from existing
 * payment, order and refund records.
 */
public record RefundRegionInsightResponse(
        String region,
        long requestCount,
        BigDecimal requestedAmount,
        BigDecimal approvedAmount,
        BigDecimal completedAmount) {
}
