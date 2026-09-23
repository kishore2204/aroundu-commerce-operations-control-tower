package com.lbos.finance.service;
import java.math.BigDecimal; import java.time.*; import java.util.*;
import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional;
import com.lbos.finance.dto.*; import com.lbos.finance.entity.*; import com.lbos.finance.exception.*; import com.lbos.finance.integration.client.*; import com.lbos.finance.integration.dto.*; import com.lbos.finance.repository.*;
@Service @Transactional
public class TaxConfigurationServiceImpl implements TaxConfigurationService {
    private final TaxConfigurationRepository taxConfigurationRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final OrderServiceClient orderServiceClient; private final IdentityServiceClient identityServiceClient; private final CatalogServiceClient catalogServiceClient; private final LogisticsServiceClient logisticsServiceClient; private final OperationsServiceClient operationsServiceClient;
    private final TaxConfigurationCategoryLinker categoryLinker;
    public TaxConfigurationServiceImpl(TaxConfigurationRepository taxConfigurationRepository, PaymentTransactionRepository paymentTransactionRepository, OrderServiceClient orderServiceClient, IdentityServiceClient identityServiceClient, CatalogServiceClient catalogServiceClient, LogisticsServiceClient logisticsServiceClient, OperationsServiceClient operationsServiceClient, TaxConfigurationCategoryLinker categoryLinker) {
        this.categoryLinker=categoryLinker;
        this.taxConfigurationRepository=taxConfigurationRepository; this.paymentTransactionRepository=paymentTransactionRepository; this.orderServiceClient=orderServiceClient; this.identityServiceClient=identityServiceClient; this.catalogServiceClient=catalogServiceClient; this.logisticsServiceClient=logisticsServiceClient; this.operationsServiceClient=operationsServiceClient;
    }
    @Override public TaxConfiguration createTaxConfiguration(TaxConfigurationRequest request) { return taxConfigurationRepository.save(createWithoutSaving(request, null)); }
    @Override public List<TaxConfiguration> getAllTaxConfigurations() { try { categoryLinker.linkLegacyConfigurations(); } catch (RuntimeException ignored) { /* linking is best effort - the list itself must still load */ } return taxConfigurationRepository.findAll(); }
    @Override public TaxConfiguration getTaxConfigurationById(UUID id) { return taxConfigurationRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("TaxConfiguration not found: " + id)); }
    @Override public TaxConfiguration updateTaxConfiguration(UUID id, TaxConfigurationRequest request) { TaxConfiguration existingEntity = getTaxConfigurationById(id); TaxConfiguration newlyMappedEntity = createWithoutSaving(request, id); copyMutableValues(newlyMappedEntity, existingEntity); return taxConfigurationRepository.save(existingEntity); }
    /** The product category must exist and be ACTIVE in S3 (checked through the existing catalog client); its current name is kept as the display name. */
    private ProductCategoryResponse requireActiveCategory(Long productCategoryId) {
        if (productCategoryId == null) throw new BusinessRuleException("Product category is required");
        ProductCategoryResponse category;
        try { category = catalogServiceClient.getProductCategory(productCategoryId); }
        catch (feign.FeignException.NotFound notFound) { throw new BusinessRuleException("Product category not found"); }
        if (category == null || category.id() == null) throw new BusinessRuleException("Product category not found");
        if (!"ACTIVE".equalsIgnoreCase(category.status())) throw new BusinessRuleException("Product category is not active");
        return category;
    }
    /** Two active rules for the same category and state may not be in force at the same time - the rate would be ambiguous. */
    private void requireNoOverlap(TaxConfigurationRequest request, UUID excludingId) {
        if (!Boolean.TRUE.equals(request.active())) return;
        for (TaxConfiguration other : taxConfigurationRepository.findByProductCategoryIdAndActiveTrue(request.productCategoryId())) {
            if (other.getTaxConfigurationId() != null && other.getTaxConfigurationId().equals(excludingId)) continue;
            if (!Objects.equals(other.getStateId(), request.stateId())) continue;
            boolean startsBeforeOtherEnds = other.getEffectiveTo() == null || request.effectiveFrom() == null || !request.effectiveFrom().isAfter(other.getEffectiveTo());
            boolean endsAfterOtherStarts = request.effectiveTo() == null || other.getEffectiveFrom() == null || !request.effectiveTo().isBefore(other.getEffectiveFrom());
            if (startsBeforeOtherEnds && endsAfterOtherStarts) throw new BusinessRuleException("An active tax configuration already exists for this category and state in the same effective period");
        }
    }
    private TaxConfiguration createWithoutSaving(TaxConfigurationRequest request, UUID excludingId) { TaxConfiguration entity = new TaxConfiguration();
        if (request.stateId() != null) { StateResponse stateResponse = operationsServiceClient.getState(request.stateId()); if (!Boolean.TRUE.equals(stateResponse.active())) throw new BusinessRuleException("State is inactive"); }
        ProductCategoryResponse category = requireActiveCategory(request.productCategoryId());
        requireNoOverlap(request, excludingId);
        entity.setProductCategoryId(category.id()); entity.setTaxCategoryName(category.name()); entity.setDescription(request.description()); entity.setStateId(request.stateId()); entity.setCgst(request.cgst()); entity.setSgst(request.sgst()); entity.setEffectiveFrom(request.effectiveFrom()); entity.setEffectiveTo(request.effectiveTo()); entity.setActive(request.active()); return entity; }
    private void copyMutableValues(TaxConfiguration sourceEntity, TaxConfiguration targetEntity) {
        try { for (var field : TaxConfiguration.class.getDeclaredFields()) { if (field.isAnnotationPresent(jakarta.persistence.Id.class)) continue; field.setAccessible(true); field.set(targetEntity, field.get(sourceEntity)); } } catch (IllegalAccessException exception) { throw new IllegalStateException("Unable to update TaxConfiguration", exception); }
    }
    @Override public void deleteTaxConfiguration(UUID id) { taxConfigurationRepository.delete(getTaxConfigurationById(id)); }
}
