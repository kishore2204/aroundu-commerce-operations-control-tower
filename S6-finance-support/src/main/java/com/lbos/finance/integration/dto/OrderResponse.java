package com.lbos.finance.integration.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.UUID;

public record OrderResponse(
        Long orderId,
        String orderNumber,
        UUID customerProfileId,
        String orderType,
        LocalDateTime orderDate,
        BigDecimal subtotalAmount,
        BigDecimal deliveryCharge,
        BigDecimal discountAmount,
        BigDecimal taxAmount,
        BigDecimal platformFeeAmount,
        BigDecimal totalAmount,
        String orderStatus,
        String paymentMethod,
        String paymentStatus,
        String transactionReference,
        OffsetDateTime deliveredAt,
        String deliveryAddress) {
}
