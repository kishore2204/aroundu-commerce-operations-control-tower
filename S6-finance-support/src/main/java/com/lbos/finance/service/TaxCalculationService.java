package com.lbos.finance.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.lbos.finance.dto.TaxCalculationDtos.TaxCalculationRequest;
import com.lbos.finance.dto.TaxCalculationDtos.TaxCalculationResponse;
import com.lbos.finance.dto.TaxCalculationDtos.TaxItemRequest;
import com.lbos.finance.dto.TaxCalculationDtos.TaxLineResponse;
import com.lbos.finance.entity.TaxConfiguration;
import com.lbos.finance.exception.BusinessRuleException;
import com.lbos.finance.integration.client.CatalogServiceClient;
import com.lbos.finance.integration.dto.ProductCategoryResponse;
import com.lbos.finance.repository.TaxConfigurationRepository;

/**
 * The single tax calculation of the platform (called by checkout; the result flows into the order and its payment).
 *
 * Each line is taxed with the configuration of its own product category for the customer's state: the state is the
 * one the delivery city belongs to (S1 territory data), and the configuration must be active and in force today.
 * A state-specific rule wins over a nationwide rule (no state) of the same category. All categories of a basket are
 * loaded with one query. There is deliberately no fallback rate: if any category has no applicable configuration the
 * calculation fails with "No applicable tax configuration found ..." and checkout is blocked.
 */
@Service
@Transactional
public class TaxCalculationService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final TaxConfigurationRepository taxConfigurationRepository;
    private final TaxConfigurationCategoryLinker categoryLinker;
    private final CityStateResolver cityStateResolver;
    private final CatalogServiceClient catalogServiceClient;

    public TaxCalculationService(TaxConfigurationRepository taxConfigurationRepository, TaxConfigurationCategoryLinker categoryLinker,
                                 CityStateResolver cityStateResolver, CatalogServiceClient catalogServiceClient) {
        this.taxConfigurationRepository = taxConfigurationRepository;
        this.categoryLinker = categoryLinker;
        this.cityStateResolver = cityStateResolver;
        this.catalogServiceClient = catalogServiceClient;
    }

    public TaxCalculationResponse calculate(TaxCalculationRequest request) {
        List<TaxItemRequest> items = request.items() == null ? List.of() : request.items();
        if (items.isEmpty()) {
            return new TaxCalculationResponse(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, "INR", List.of());
        }
        for (TaxItemRequest item : items) {
            if (item.productCategoryId() == null) {
                throw new BusinessRuleException("Product " + item.productId() + " has no product category, so its tax cannot be calculated");
            }
            if (item.quantity() == null || item.quantity() < 1 || item.unitPrice() == null || item.unitPrice().signum() < 0) {
                throw new BusinessRuleException("Product " + item.productId() + " has an invalid quantity or price, so its tax cannot be calculated");
            }
        }
        UUID stateId = cityStateResolver.stateOf(request.cityId())
                .orElseThrow(() -> new BusinessRuleException("The state of the delivery city could not be determined, so tax cannot be calculated"));

        Set<Long> categoryIds = items.stream().map(TaxItemRequest::productCategoryId).collect(Collectors.toCollection(LinkedHashSet::new));
        LocalDate today = LocalDate.now();
        Map<Long, TaxConfiguration> applicable = applicableConfigurations(categoryIds, stateId, today);
        if (!applicable.keySet().containsAll(categoryIds) && categoryLinker.linkLegacyConfigurations()) {
            applicable = applicableConfigurations(categoryIds, stateId, today); // legacy rows were just linked to their categories
        }
        Map<Long, TaxConfiguration> resolved = applicable;
        List<Long> missing = categoryIds.stream().filter(id -> !resolved.containsKey(id)).toList();
        if (!missing.isEmpty()) {
            throw new BusinessRuleException("No applicable tax configuration found for product category "
                    + missing.stream().map(this::categoryLabel).collect(Collectors.joining(", ")));
        }

        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;
        List<TaxLineResponse> lines = new ArrayList<>();
        for (TaxItemRequest item : items) {
            TaxConfiguration configuration = resolved.get(item.productCategoryId());
            BigDecimal cgst = configuration.getCgst() == null ? BigDecimal.ZERO : configuration.getCgst();
            BigDecimal sgst = configuration.getSgst() == null ? BigDecimal.ZERO : configuration.getSgst();
            BigDecimal taxable = item.unitPrice().multiply(BigDecimal.valueOf(item.quantity()));
            BigDecimal tax = taxable.multiply(cgst.add(sgst)).divide(HUNDRED, 2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(taxable);
            totalTax = totalTax.add(tax);
            lines.add(new TaxLineResponse(item.productId(), item.productCategoryId(), taxable, cgst, sgst, tax));
        }
        return new TaxCalculationResponse(subtotal, totalTax, subtotal.add(totalTax), "INR", lines);
    }

    /** One configuration per category: the state-specific rule if there is one, else the nationwide rule; latest effective date wins a tie. */
    private Map<Long, TaxConfiguration> applicableConfigurations(Set<Long> categoryIds, UUID stateId, LocalDate on) {
        Comparator<TaxConfiguration> mostSpecific = Comparator
                .comparing((TaxConfiguration t) -> stateId.equals(t.getStateId()) ? 1 : 0)
                .thenComparing(TaxConfiguration::getEffectiveFrom, Comparator.nullsFirst(Comparator.naturalOrder()));
        Map<Long, TaxConfiguration> best = new HashMap<>();
        for (TaxConfiguration configuration : taxConfigurationRepository.findApplicable(categoryIds, stateId, on)) {
            best.merge(configuration.getProductCategoryId(), configuration, (a, b) -> mostSpecific.compare(a, b) >= 0 ? a : b);
        }
        return best;
    }

    /** Only used to make the error readable - the category name is looked up on the failure path only. */
    private String categoryLabel(Long categoryId) {
        try {
            ProductCategoryResponse category = catalogServiceClient.getProductCategory(categoryId);
            if (category != null && category.name() != null && !category.name().isBlank()) return category.name();
        } catch (RuntimeException ignored) {
            // fall through to the id
        }
        return "#" + categoryId;
    }
}
