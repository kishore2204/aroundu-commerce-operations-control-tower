package com.lbos.finance.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lbos.finance.dto.TaxCalculationDtos.TaxCalculationRequest;
import com.lbos.finance.dto.TaxCalculationDtos.TaxCalculationResponse;
import com.lbos.finance.service.TaxCalculationService;

/**
 * Service-to-service tax calculation, consumed by S3's checkout flow (FinanceClient.tax()).
 * Gated by hasRole("SERVICE") like the other /api/v1/internal/** endpoints.
 *
 * Tax is decided per product category and customer state by {@link TaxCalculationService}; when a category has no
 * applicable tax configuration the call is rejected (409 with a clear message) - there is no default rate.
 */
@RestController
@RequestMapping("/api/v1/internal/tax-calculations")
public class InternalTaxCalculationController {

    private final TaxCalculationService taxCalculationService;

    public InternalTaxCalculationController(TaxCalculationService taxCalculationService) {
        this.taxCalculationService = taxCalculationService;
    }

    @PostMapping
    public TaxCalculationResponse calculate(@RequestBody TaxCalculationRequest request) {
        return taxCalculationService.calculate(request);
    }
}
