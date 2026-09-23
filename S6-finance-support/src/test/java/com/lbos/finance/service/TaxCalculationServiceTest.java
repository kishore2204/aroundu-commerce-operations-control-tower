package com.lbos.finance.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.lbos.finance.dto.TaxCalculationDtos.TaxCalculationRequest;
import com.lbos.finance.dto.TaxCalculationDtos.TaxCalculationResponse;
import com.lbos.finance.dto.TaxCalculationDtos.TaxItemRequest;
import com.lbos.finance.entity.TaxConfiguration;
import com.lbos.finance.exception.BusinessRuleException;
import com.lbos.finance.integration.client.CatalogServiceClient;
import com.lbos.finance.integration.dto.ProductCategoryResponse;
import com.lbos.finance.repository.TaxConfigurationRepository;

@ExtendWith(MockitoExtension.class)
class TaxCalculationServiceTest {

    private static final Long GROCERIES = 1L;
    private static final Long ELECTRONICS = 2L;

    @Mock TaxConfigurationRepository taxConfigurationRepository;
    @Mock TaxConfigurationCategoryLinker categoryLinker;
    @Mock CityStateResolver cityStateResolver;
    @Mock CatalogServiceClient catalogServiceClient;

    private TaxCalculationService service;
    private UUID cityId;
    private UUID stateId;

    @BeforeEach
    void setUp() {
        service = new TaxCalculationService(taxConfigurationRepository, categoryLinker, cityStateResolver, catalogServiceClient);
        cityId = UUID.randomUUID();
        stateId = UUID.randomUUID();
    }

    private TaxConfiguration rule(Long categoryId, UUID state, String cgst, String sgst) {
        TaxConfiguration configuration = new TaxConfiguration();
        configuration.setTaxConfigurationId(UUID.randomUUID());
        configuration.setProductCategoryId(categoryId);
        configuration.setStateId(state);
        configuration.setCgst(new BigDecimal(cgst));
        configuration.setSgst(new BigDecimal(sgst));
        configuration.setActive(Boolean.TRUE);
        return configuration;
    }

    private TaxCalculationRequest basket(TaxItemRequest... items) {
        return new TaxCalculationRequest(UUID.randomUUID(), cityId, List.of(items));
    }

    @Test
    void eachCategoryInAMixedBasketIsTaxedWithItsOwnRateInOneLookup() {
        when(cityStateResolver.stateOf(cityId)).thenReturn(Optional.of(stateId));
        when(taxConfigurationRepository.findApplicable(anyCollection(), eq(stateId), any(LocalDate.class)))
                .thenReturn(List.of(rule(GROCERIES, stateId, "2.50", "2.50"), rule(ELECTRONICS, stateId, "9.00", "9.00")));

        TaxCalculationResponse response = service.calculate(basket(
                new TaxItemRequest(10L, GROCERIES, 2, new BigDecimal("100.00")),
                new TaxItemRequest(20L, ELECTRONICS, 1, new BigDecimal("1000.00"))));

        assertEquals(new BigDecimal("1200.00"), response.subtotal());
        assertEquals(new BigDecimal("10.00"), response.lines().get(0).taxAmount());   // 200 x 5%
        assertEquals(new BigDecimal("180.00"), response.lines().get(1).taxAmount());  // 1000 x 18%
        assertEquals(new BigDecimal("190.00"), response.taxAmount());
        assertEquals(new BigDecimal("1390.00"), response.totalAfterTax());
        verify(taxConfigurationRepository, times(1)).findApplicable(anyCollection(), eq(stateId), any(LocalDate.class));
    }

    @Test
    void aStateSpecificRuleBeatsANationwideRuleOfTheSameCategory() {
        when(cityStateResolver.stateOf(cityId)).thenReturn(Optional.of(stateId));
        when(taxConfigurationRepository.findApplicable(anyCollection(), eq(stateId), any(LocalDate.class)))
                .thenReturn(List.of(rule(GROCERIES, null, "9.00", "9.00"), rule(GROCERIES, stateId, "2.50", "2.50")));

        TaxCalculationResponse response = service.calculate(basket(new TaxItemRequest(10L, GROCERIES, 1, new BigDecimal("100.00"))));

        assertEquals(new BigDecimal("5.00"), response.taxAmount());
    }

    @Test
    void aMissingConfigurationBlocksTheCalculationInsteadOfUsingADefaultRate() {
        when(cityStateResolver.stateOf(cityId)).thenReturn(Optional.of(stateId));
        when(taxConfigurationRepository.findApplicable(anyCollection(), eq(stateId), any(LocalDate.class)))
                .thenReturn(List.of(rule(GROCERIES, stateId, "2.50", "2.50")));
        when(catalogServiceClient.getProductCategory(ELECTRONICS)).thenReturn(new ProductCategoryResponse(ELECTRONICS, "Electronics", null, "ACTIVE"));

        BusinessRuleException ex = assertThrows(BusinessRuleException.class, () -> service.calculate(basket(
                new TaxItemRequest(10L, GROCERIES, 1, new BigDecimal("100.00")),
                new TaxItemRequest(20L, ELECTRONICS, 1, new BigDecimal("500.00")))));

        assertTrue(ex.getMessage().startsWith("No applicable tax configuration found"));
        assertTrue(ex.getMessage().contains("Electronics"));
    }

    @Test
    void legacyRowsAreLinkedOnDemandBeforeGivingUp() {
        when(cityStateResolver.stateOf(cityId)).thenReturn(Optional.of(stateId));
        when(taxConfigurationRepository.findApplicable(anyCollection(), eq(stateId), any(LocalDate.class)))
                .thenReturn(List.of())
                .thenReturn(List.of(rule(GROCERIES, stateId, "2.50", "2.50")));
        when(categoryLinker.linkLegacyConfigurations()).thenReturn(true);

        TaxCalculationResponse response = service.calculate(basket(new TaxItemRequest(10L, GROCERIES, 1, new BigDecimal("100.00"))));

        assertEquals(new BigDecimal("5.00"), response.taxAmount());
    }

    @Test
    void anUnknownDeliveryStateBlocksTheCalculation() {
        when(cityStateResolver.stateOf(cityId)).thenReturn(Optional.empty());

        assertThrows(BusinessRuleException.class,
                () -> service.calculate(basket(new TaxItemRequest(10L, GROCERIES, 1, new BigDecimal("100.00")))));
    }

    @Test
    void aProductWithoutACategoryBlocksTheCalculation() {
        assertThrows(BusinessRuleException.class,
                () -> service.calculate(basket(new TaxItemRequest(10L, null, 1, new BigDecimal("100.00")))));
    }
}
