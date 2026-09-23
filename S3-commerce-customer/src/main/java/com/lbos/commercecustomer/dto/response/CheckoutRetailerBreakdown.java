package com.lbos.commercecustomer.dto.response;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Authoritative per-retailer financial split for a multi-shop cart. */
public record CheckoutRetailerBreakdown(
        UUID retailerId,
        List<CartItemResponse> items,
        BigDecimal subtotal,
        BigDecimal tax,
        BigDecimal deliveryCharge,
        BigDecimal platformFee,
        BigDecimal discount,
        BigDecimal grandTotal) {
}
