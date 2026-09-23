package com.lbos.finance.dto;

import com.lbos.finance.entity.TaxConfiguration;

/** What "save by category name" did: {@code outcome} is CATEGORY_AND_TAX_CONFIGURATION_CREATED,
 *  TAX_CONFIGURATION_CREATED or TAX_CONFIGURATION_UPDATED, and {@code message} is the text to show. */
public record TaxConfigurationSaveResponse(TaxConfiguration taxConfiguration, String outcome, String message) { }
