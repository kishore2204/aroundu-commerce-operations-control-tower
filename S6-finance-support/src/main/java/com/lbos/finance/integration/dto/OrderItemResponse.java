package com.lbos.finance.integration.dto;
import java.util.UUID;
import java.math.BigDecimal;
public record OrderItemResponse(Long orderItemId, Long orderId, UUID retailerId, Long productId, String skuSnapshot, String productNameSnapshot, Integer quantity, BigDecimal unitPrice, BigDecimal discountAmount, BigDecimal lineTotal) { }
