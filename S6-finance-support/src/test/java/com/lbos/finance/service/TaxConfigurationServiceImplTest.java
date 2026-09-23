package com.lbos.finance.service;

import com.lbos.finance.dto.TaxConfigurationRequest;
import com.lbos.finance.entity.TaxConfiguration;
import com.lbos.finance.exception.BusinessRuleException;
import com.lbos.finance.exception.ResourceNotFoundException;
import com.lbos.finance.integration.client.CatalogServiceClient;
import com.lbos.finance.integration.client.IdentityServiceClient;
import com.lbos.finance.integration.client.LogisticsServiceClient;
import com.lbos.finance.integration.client.OperationsServiceClient;
import com.lbos.finance.integration.client.OrderServiceClient;
import com.lbos.finance.integration.dto.ProductCategoryResponse;
import com.lbos.finance.integration.dto.StateResponse;
import com.lbos.finance.repository.PaymentTransactionRepository;
import com.lbos.finance.repository.TaxConfigurationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaxConfigurationServiceImplTest {

	@Mock
	private TaxConfigurationRepository taxConfigurationRepository;
	@Mock
	private PaymentTransactionRepository paymentTransactionRepository;
	@Mock
	private OrderServiceClient orderServiceClient;
	@Mock
	private IdentityServiceClient identityServiceClient;
	@Mock
	private CatalogServiceClient catalogServiceClient;
	@Mock
	private LogisticsServiceClient logisticsServiceClient;
	@Mock
	private OperationsServiceClient operationsServiceClient;
	@Mock
	private TaxConfigurationCategoryLinker categoryLinker;

	@InjectMocks
	private TaxConfigurationServiceImpl service;

	private static final Long CATEGORY_ID = 7L;

	private UUID stateId;

	@BeforeEach
	void setUp() {
		stateId = UUID.randomUUID();
	}

	private void categoryIs(String name, String status) {
		when(catalogServiceClient.getProductCategory(CATEGORY_ID)).thenReturn(new ProductCategoryResponse(CATEGORY_ID, name, null, status));
	}

	private StateResponse state(Boolean active) {
		return new StateResponse(stateId, "Karnataka", "IN", active);
	}

	private TaxConfigurationRequest request(String taxCategoryName, BigDecimal cgst, BigDecimal sgst) {
		return new TaxConfigurationRequest(CATEGORY_ID, taxCategoryName, "Standard GST slab", stateId, cgst, sgst,
				LocalDate.of(2026, 4, 1), LocalDate.of(2027, 3, 31), Boolean.TRUE);
	}

	@Test
	void createStoresTheSlabForAnActiveState() {
		when(operationsServiceClient.getState(stateId)).thenReturn(state(Boolean.TRUE));
		categoryIs("GST_18", "ACTIVE");
		when(taxConfigurationRepository.save(any(TaxConfiguration.class))).thenAnswer(invocation -> invocation.getArgument(0));

		TaxConfiguration result = service
				.createTaxConfiguration(request("GST_18", new BigDecimal("9.00"), new BigDecimal("9.00")));

		ArgumentCaptor<TaxConfiguration> captor = ArgumentCaptor.forClass(TaxConfiguration.class);
		verify(taxConfigurationRepository).save(captor.capture());
		TaxConfiguration saved = captor.getValue();
		assertEquals(CATEGORY_ID, saved.getProductCategoryId());
		assertEquals("GST_18", saved.getTaxCategoryName());
		assertEquals("Standard GST slab", saved.getDescription());
		assertEquals(stateId, saved.getStateId());
		assertEquals(new BigDecimal("9.00"), saved.getCgst());
		assertEquals(new BigDecimal("9.00"), saved.getSgst());
		assertEquals(LocalDate.of(2026, 4, 1), saved.getEffectiveFrom());
		assertEquals(LocalDate.of(2027, 3, 31), saved.getEffectiveTo());
		assertTrue(saved.isActive());
		assertEquals("GST_18", result.getTaxCategoryName());
	}

	@Test
	void createRejectsAStateWhoseActiveFlagIsFalse() {
		when(operationsServiceClient.getState(stateId)).thenReturn(state(Boolean.FALSE));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createTaxConfiguration(request("GST_18", new BigDecimal("9.00"), new BigDecimal("9.00"))));

		assertEquals("State is inactive", ex.getMessage());
		verify(taxConfigurationRepository, never()).save(any(TaxConfiguration.class));
	}

	@Test
	void createRejectsAStateWhoseActiveFlagIsNull() {
		when(operationsServiceClient.getState(stateId)).thenReturn(state(null));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createTaxConfiguration(request("GST_18", new BigDecimal("9.00"), new BigDecimal("9.00"))));

		assertEquals("State is inactive", ex.getMessage());
		verify(taxConfigurationRepository, never()).save(any(TaxConfiguration.class));
	}

	@Test
	void getAllReturnsEverythingTheRepositoryHolds() {
		TaxConfiguration taxConfiguration = new TaxConfiguration();
		taxConfiguration.setTaxConfigurationId(UUID.randomUUID());
		when(taxConfigurationRepository.findAll()).thenReturn(List.of(taxConfiguration));

		assertEquals(1, service.getAllTaxConfigurations().size());
	}

	@Test
	void getByIdThrowsResourceNotFoundWhenAbsent() {
		UUID id = UUID.randomUUID();
		when(taxConfigurationRepository.findById(id)).thenReturn(Optional.empty());

		ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class,
				() -> service.getTaxConfigurationById(id));

		assertEquals("TaxConfiguration not found: " + id, ex.getMessage());
	}

	@Test
	void updateCopiesTheRemappedValuesOntoTheExistingRowAndKeepsItsId() {
		UUID id = UUID.randomUUID();
		TaxConfiguration existing = new TaxConfiguration();
		existing.setTaxConfigurationId(id);
		existing.setTaxCategoryName("GST_5");
		existing.setDescription("old description");
		existing.setCgst(new BigDecimal("2.50"));
		existing.setSgst(new BigDecimal("2.50"));
		existing.setEffectiveFrom(LocalDate.of(2020, 1, 1));
		existing.setEffectiveTo(LocalDate.of(2021, 1, 1));
		existing.setActive(Boolean.FALSE);

		when(taxConfigurationRepository.findById(id)).thenReturn(Optional.of(existing));
		when(operationsServiceClient.getState(stateId)).thenReturn(state(Boolean.TRUE));
		categoryIs("GST_28", "ACTIVE");
		when(taxConfigurationRepository.save(any(TaxConfiguration.class))).thenAnswer(invocation -> invocation.getArgument(0));

		TaxConfiguration result = service.updateTaxConfiguration(id,
				request("GST_28", new BigDecimal("14.00"), new BigDecimal("14.00")));

		assertEquals(id, result.getTaxConfigurationId());
		assertEquals("GST_28", result.getTaxCategoryName());
		assertEquals("Standard GST slab", result.getDescription());
		assertEquals(new BigDecimal("14.00"), result.getCgst());
		assertEquals(new BigDecimal("14.00"), result.getSgst());
		assertEquals(LocalDate.of(2026, 4, 1), result.getEffectiveFrom());
		assertEquals(LocalDate.of(2027, 3, 31), result.getEffectiveTo());
		// The reflection copy overwrites every non-@Id field, so the stale inactive flag is replaced.
		assertTrue(result.isActive());
		// The state check is re-run at update time.
		verify(operationsServiceClient).getState(stateId);
		verify(taxConfigurationRepository).save(existing);
		assertEquals("GST_28", existing.getTaxCategoryName());
	}

	@Test
	void updateReRunsTheStateRuleAndRefusesAnInactiveState() {
		UUID id = UUID.randomUUID();
		TaxConfiguration existing = new TaxConfiguration();
		existing.setTaxConfigurationId(id);
		existing.setTaxCategoryName("GST_5");
		when(taxConfigurationRepository.findById(id)).thenReturn(Optional.of(existing));
		when(operationsServiceClient.getState(stateId)).thenReturn(state(Boolean.FALSE));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class, () -> service.updateTaxConfiguration(id,
				request("GST_28", new BigDecimal("14.00"), new BigDecimal("14.00"))));

		assertEquals("State is inactive", ex.getMessage());
		assertEquals("GST_5", existing.getTaxCategoryName());
		verify(taxConfigurationRepository, never()).save(any(TaxConfiguration.class));
	}

	@Test
	void deleteRemovesTheLoadedTaxConfiguration() {
		UUID id = UUID.randomUUID();
		TaxConfiguration existing = new TaxConfiguration();
		existing.setTaxConfigurationId(id);
		when(taxConfigurationRepository.findById(id)).thenReturn(Optional.of(existing));

		service.deleteTaxConfiguration(id);

		verify(taxConfigurationRepository).delete(existing);
	}

	@Test
	void deleteThrowsWhenTheTaxConfigurationIsMissing() {
		UUID id = UUID.randomUUID();
		when(taxConfigurationRepository.findById(id)).thenReturn(Optional.empty());

		assertThrows(ResourceNotFoundException.class, () -> service.deleteTaxConfiguration(id));
		verify(taxConfigurationRepository, never()).delete(any(TaxConfiguration.class));
	}

	@Test
	void createRejectsAnInactiveProductCategory() {
		when(operationsServiceClient.getState(stateId)).thenReturn(state(Boolean.TRUE));
		categoryIs("Groceries", "INACTIVE");

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createTaxConfiguration(request("Groceries", new BigDecimal("2.50"), new BigDecimal("2.50"))));

		assertEquals("Product category is not active", ex.getMessage());
		verify(taxConfigurationRepository, never()).save(any(TaxConfiguration.class));
	}

	@Test
	void createRejectsAProductCategoryThatDoesNotExist() {
		when(operationsServiceClient.getState(stateId)).thenReturn(state(Boolean.TRUE));
		when(catalogServiceClient.getProductCategory(CATEGORY_ID)).thenReturn(null);

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createTaxConfiguration(request("Groceries", new BigDecimal("2.50"), new BigDecimal("2.50"))));

		assertEquals("Product category not found", ex.getMessage());
	}

	@Test
	void createRejectsAnOverlappingActiveRuleForTheSameCategoryAndState() {
		when(operationsServiceClient.getState(stateId)).thenReturn(state(Boolean.TRUE));
		categoryIs("Groceries", "ACTIVE");
		TaxConfiguration other = new TaxConfiguration();
		other.setTaxConfigurationId(UUID.randomUUID());
		other.setProductCategoryId(CATEGORY_ID);
		other.setStateId(stateId);
		other.setEffectiveFrom(LocalDate.of(2026, 1, 1));
		other.setActive(Boolean.TRUE);
		when(taxConfigurationRepository.findByProductCategoryIdAndActiveTrue(CATEGORY_ID)).thenReturn(List.of(other));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createTaxConfiguration(request("Groceries", new BigDecimal("2.50"), new BigDecimal("2.50"))));

		assertTrue(ex.getMessage().startsWith("An active tax configuration already exists"));
		verify(taxConfigurationRepository, never()).save(any(TaxConfiguration.class));
	}
}
