package com.lbos.finance.dto;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.LocalDate;
import jakarta.validation.constraints.NotNull;
/** productCategoryId is the S3 product category the rate applies to; taxCategoryName is optional and only kept for
 *  display (the service stores the category's own name). */
public record TaxConfigurationRequest(@NotNull(message = "Product category is required") Long productCategoryId, String taxCategoryName, String description, UUID stateId, BigDecimal cgst, BigDecimal sgst, LocalDate effectiveFrom, LocalDate effectiveTo, Boolean active) { }
