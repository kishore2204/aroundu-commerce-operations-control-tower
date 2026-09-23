package com.lbos.finance.dto;

import java.math.BigDecimal;

/**
 * Read-only refundable balance for one order item. The balance is derived from the order item's
 * persisted line total minus every non-rejected refund already recorded for that item, so the
 * frontend never has to reproduce refund-cap business rules.
 */
public record RefundableOrderItemResponse(
        Long orderItemId,
        String productName,
        Integer quantity,
        BigDecimal lineTotal,
        BigDecimal alreadyRequestedAmount,
        BigDecimal remainingRefundableAmount) {
}
