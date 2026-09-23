package com.lbos.finance.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * The admin's "new tax rule" form: the category is TYPED (an existing name is reused, a new one is created), the rule
 * is then created - or, when a rule for the same category + state + effective period already exists, updated.
 */
public record TaxConfigurationCategoryRequest(String categoryName, String description, UUID stateId, BigDecimal cgst,
        BigDecimal sgst, LocalDate effectiveFrom, LocalDate effectiveTo, Boolean active) { }
