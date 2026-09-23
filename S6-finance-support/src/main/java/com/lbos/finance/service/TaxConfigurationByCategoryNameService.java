package com.lbos.finance.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import com.lbos.finance.dto.TaxConfigurationCategoryRequest;
import com.lbos.finance.dto.TaxConfigurationRequest;
import com.lbos.finance.dto.TaxConfigurationSaveResponse;
import com.lbos.finance.entity.TaxConfiguration;
import com.lbos.finance.exception.BusinessRuleException;
import com.lbos.finance.integration.client.CatalogCategoryResolveClient;
import com.lbos.finance.integration.client.CatalogCategoryResolveClient.CategoryResolution;
import com.lbos.finance.integration.client.CatalogCategoryResolveClient.ResolveRequest;
import com.lbos.finance.repository.TaxConfigurationRepository;

import feign.FeignException;

/**
 * "New tax rule" with a TYPED category. S3 owns the category (found by trimmed, case-insensitive name, or created
 * ACTIVE), S6 owns the rule and keeps only the category id - the name is never the relationship key.
 *
 * <pre>
 *   name -> S3 resolve (reuse | create ACTIVE) -> productCategoryId
 *        -> a rule with the same category + state + effective period?  yes: update it   no: create
 * </pre>
 *
 * Creating and updating go through {@link TaxConfigurationService}, so the state / active-category / overlap rules
 * stay exactly the ones already enforced there: a period that overlaps a different rule is refused, never
 * overwritten. A rule whose period has already ended is history and is not changed.
 */
@Service
public class TaxConfigurationByCategoryNameService {

    public static final String CATEGORY_AND_RULE_CREATED = "CATEGORY_AND_TAX_CONFIGURATION_CREATED";
    public static final String RULE_CREATED = "TAX_CONFIGURATION_CREATED";
    public static final String RULE_UPDATED = "TAX_CONFIGURATION_UPDATED";

    private static final Pattern ERROR_MESSAGE = Pattern.compile("\"(?:userMessage|message)\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"");

    private final TaxConfigurationService taxConfigurationService;
    private final TaxConfigurationRepository taxConfigurationRepository;
    private final CatalogCategoryResolveClient categoryClient;

    public TaxConfigurationByCategoryNameService(TaxConfigurationService taxConfigurationService,
            TaxConfigurationRepository taxConfigurationRepository, CatalogCategoryResolveClient categoryClient) {
        this.taxConfigurationService = taxConfigurationService;
        this.taxConfigurationRepository = taxConfigurationRepository;
        this.categoryClient = categoryClient;
    }

    /** @param mayCreateCategory only a Super Admin may add a category to the catalogue; others can only reuse one. */
    public TaxConfigurationSaveResponse save(TaxConfigurationCategoryRequest request, boolean mayCreateCategory) {
        String name = normalise(request.categoryName());
        validate(name, request);

        CategoryResolution resolution = resolve(name, mayCreateCategory);
        Long categoryId = resolution.category().id();
        TaxConfigurationRequest rule = new TaxConfigurationRequest(categoryId, resolution.category().name(),
                request.description(), request.stateId(), request.cgst(), request.sgst(), request.effectiveFrom(),
                request.effectiveTo(), request.active() == null ? Boolean.TRUE : request.active());

        List<TaxConfiguration> samePeriod = taxConfigurationRepository.findByProductCategoryId(categoryId).stream()
                .filter(existing -> Objects.equals(existing.getStateId(), request.stateId())
                        && Objects.equals(existing.getEffectiveFrom(), request.effectiveFrom())
                        && Objects.equals(existing.getEffectiveTo(), request.effectiveTo()))
                .toList();
        if (samePeriod.size() > 1) {
            throw new BusinessRuleException("More than one tax configuration already exists for this category, state and period; resolve the duplicates first");
        }
        if (samePeriod.size() == 1) {
            TaxConfiguration existing = samePeriod.get(0);
            if (existing.getEffectiveTo() != null && existing.getEffectiveTo().isBefore(LocalDate.now())) {
                throw new BusinessRuleException("This tax period has already ended and cannot be changed; enter a new effective period");
            }
            TaxConfiguration updated = taxConfigurationService.updateTaxConfiguration(existing.getTaxConfigurationId(), rule);
            return new TaxConfigurationSaveResponse(updated, RULE_UPDATED, "Tax configuration updated successfully.");
        }
        TaxConfiguration created = taxConfigurationService.createTaxConfiguration(rule);
        return resolution.created()
                ? new TaxConfigurationSaveResponse(created, CATEGORY_AND_RULE_CREATED, "Category and tax configuration created successfully.")
                : new TaxConfigurationSaveResponse(created, RULE_CREATED, "Tax configuration created successfully.");
    }

    /** Trim and collapse inner whitespace, so "  organic   foods " and "Organic Foods" are the same category. */
    static String normalise(String name) {
        return name == null ? "" : name.trim().replaceAll("\\s+", " ");
    }

    private void validate(String name, TaxConfigurationCategoryRequest request) {
        if (name.isEmpty()) throw new BusinessRuleException("Product category is required");
        if (name.length() > 100) throw new BusinessRuleException("Product category must be at most 100 characters");
        requireRate(request.cgst(), "CGST");
        requireRate(request.sgst(), "SGST");
        if (request.effectiveFrom() != null && request.effectiveTo() != null && request.effectiveTo().isBefore(request.effectiveFrom())) {
            throw new BusinessRuleException("Effective To cannot be before Effective From");
        }
    }

    private static void requireRate(BigDecimal rate, String label) {
        if (rate == null) throw new BusinessRuleException(label + " is required");
        if (rate.signum() < 0 || rate.compareTo(new BigDecimal("100")) > 0) throw new BusinessRuleException(label + " must be between 0 and 100");
    }

    private CategoryResolution resolve(String name, boolean mayCreateCategory) {
        try {
            CategoryResolution resolution = categoryClient.resolve(new ResolveRequest(name, mayCreateCategory));
            if (resolution == null || resolution.category() == null || resolution.category().id() == null) {
                throw new BusinessRuleException("The product category could not be resolved");
            }
            return resolution;
        } catch (FeignException.NotFound notFound) {
            throw new BusinessRuleException("Product category '" + name + "' does not exist. Only an administrator can create a new category.");
        } catch (FeignException failure) {
            if (failure.status() >= 400 && failure.status() < 500) {
                throw new BusinessRuleException(messageOf(failure, "The product category could not be used"));
            }
            throw new BusinessRuleException("The product catalogue is not reachable right now. Please try again.");
        }
    }

    private static String messageOf(FeignException failure, String fallback) {
        String body = failure.contentUTF8();
        if (body != null) {
            Matcher matcher = ERROR_MESSAGE.matcher(body);
            if (matcher.find() && !matcher.group(1).isBlank()) return matcher.group(1).replace("\\\"", "\"");
        }
        return fallback;
    }
}
