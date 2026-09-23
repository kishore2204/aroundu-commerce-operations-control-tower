package com.lbos.finance.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Service-to-service tax calculation contract (S3 checkout -> S6). Each item names its product category, and the
 * response carries the tax of every line so a mixed basket is taxed category by category.
 */
public final class TaxCalculationDtos {

    private TaxCalculationDtos() {
    }

    public record TaxItemRequest(Long productId, Long productCategoryId, Integer quantity, BigDecimal unitPrice) {
    }

    public record TaxCalculationRequest(UUID customerProfileId, UUID cityId, List<TaxItemRequest> items) {
    }

    public record TaxLineResponse(Long productId, Long productCategoryId, BigDecimal taxableAmount,
                                  BigDecimal cgstPercent, BigDecimal sgstPercent, BigDecimal taxAmount) {
    }

    public record TaxCalculationResponse(BigDecimal subtotal, BigDecimal taxAmount, BigDecimal totalAfterTax,
                                         String currencyCode, List<TaxLineResponse> lines) {
    }
}
