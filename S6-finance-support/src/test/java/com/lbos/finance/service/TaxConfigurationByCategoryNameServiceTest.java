package com.lbos.finance.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.lbos.finance.dto.TaxConfigurationCategoryRequest;
import com.lbos.finance.dto.TaxConfigurationRequest;
import com.lbos.finance.dto.TaxConfigurationSaveResponse;
import com.lbos.finance.entity.TaxConfiguration;
import com.lbos.finance.exception.BusinessRuleException;
import com.lbos.finance.integration.client.CatalogCategoryResolveClient;
import com.lbos.finance.integration.client.CatalogCategoryResolveClient.CategoryResolution;
import com.lbos.finance.integration.client.CatalogCategoryResolveClient.ResolveRequest;
import com.lbos.finance.integration.dto.ProductCategoryResponse;
import com.lbos.finance.repository.TaxConfigurationRepository;

import feign.FeignException;
import feign.Request;
import feign.RequestTemplate;

@ExtendWith(MockitoExtension.class)
class TaxConfigurationByCategoryNameServiceTest {

	@Mock private TaxConfigurationService taxConfigurationService;
	@Mock private TaxConfigurationRepository taxConfigurationRepository;
	@Mock private CatalogCategoryResolveClient categoryClient;
	@InjectMocks private TaxConfigurationByCategoryNameService service;

	private static final Long CATEGORY_ID = 12L;
	private final UUID stateId = UUID.randomUUID();
	private final LocalDate from = LocalDate.of(2026, 1, 1);

	private TaxConfigurationCategoryRequest request(String name, LocalDate effectiveFrom, LocalDate effectiveTo) {
		return new TaxConfigurationCategoryRequest(name, null, stateId, new BigDecimal("3.00"), new BigDecimal("3.00"), effectiveFrom, effectiveTo, true);
	}

	private void categoryResolves(boolean created) {
		when(categoryClient.resolve(any())).thenReturn(new CategoryResolution(new ProductCategoryResponse(CATEGORY_ID, "Groceries", null, "ACTIVE"), created));
	}

	private TaxConfiguration rule(LocalDate effectiveFrom, LocalDate effectiveTo) {
		TaxConfiguration rule = new TaxConfiguration();
		rule.setTaxConfigurationId(UUID.randomUUID());
		rule.setProductCategoryId(CATEGORY_ID);
		rule.setStateId(stateId);
		rule.setEffectiveFrom(effectiveFrom);
		rule.setEffectiveTo(effectiveTo);
		return rule;
	}

	private FeignException feignFailure(int status, String body) {
		Request feignRequest = Request.create(Request.HttpMethod.POST, "/api/v1/internal/product-categories/resolve",
				java.util.Collections.emptyMap(), null, StandardCharsets.UTF_8, new RequestTemplate());
		return FeignException.errorStatus("resolve", feign.Response.builder().status(status).reason("x").request(feignRequest)
				.headers(java.util.Collections.emptyMap()).body(body, StandardCharsets.UTF_8).build());
	}

	@Test
	void aNewCategoryIsCreatedInS3AndTheRuleIsCreatedWithItsId() {
		categoryResolves(true);
		when(taxConfigurationRepository.findByProductCategoryId(CATEGORY_ID)).thenReturn(List.of());
		when(taxConfigurationService.createTaxConfiguration(any())).thenAnswer(call -> new TaxConfiguration());

		TaxConfigurationSaveResponse response = service.save(request("Organic Foods", from, null), true);

		assertEquals(TaxConfigurationByCategoryNameService.CATEGORY_AND_RULE_CREATED, response.outcome());
		assertEquals("Category and tax configuration created successfully.", response.message());
		ArgumentCaptor<TaxConfigurationRequest> created = ArgumentCaptor.forClass(TaxConfigurationRequest.class);
		verify(taxConfigurationService).createTaxConfiguration(created.capture());
		assertEquals(CATEGORY_ID, created.getValue().productCategoryId());
	}

	@Test
	void theTypedNameIsTrimmedAndWhitespaceCollapsedBeforeItIsSentToS3() {
		categoryResolves(false);
		when(taxConfigurationRepository.findByProductCategoryId(CATEGORY_ID)).thenReturn(List.of());
		when(taxConfigurationService.createTaxConfiguration(any())).thenAnswer(call -> new TaxConfiguration());

		service.save(request("   groceries   ", from, null), true);

		ArgumentCaptor<ResolveRequest> sent = ArgumentCaptor.forClass(ResolveRequest.class);
		verify(categoryClient).resolve(sent.capture());
		assertEquals("groceries", sent.getValue().name());
		assertTrue(sent.getValue().createIfMissing());
	}

	@Test
	void anExistingCategoryWithNoRuleForThatPeriodCreatesANewRule() {
		categoryResolves(false);
		// an earlier, non-overlapping period exists - it is left alone
		when(taxConfigurationRepository.findByProductCategoryId(CATEGORY_ID)).thenReturn(List.of(rule(LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31))));
		when(taxConfigurationService.createTaxConfiguration(any())).thenAnswer(call -> new TaxConfiguration());

		TaxConfigurationSaveResponse response = service.save(request("Groceries", from, null), true);

		assertEquals(TaxConfigurationByCategoryNameService.RULE_CREATED, response.outcome());
		assertEquals("Tax configuration created successfully.", response.message());
		verify(taxConfigurationService, never()).updateTaxConfiguration(any(), any());
	}

	@Test
	void aRuleForTheSameCategoryStateAndPeriodIsUpdatedNotDuplicated() {
		categoryResolves(false);
		TaxConfiguration existing = rule(from, null);
		when(taxConfigurationRepository.findByProductCategoryId(CATEGORY_ID)).thenReturn(List.of(existing));
		when(taxConfigurationService.updateTaxConfiguration(eq(existing.getTaxConfigurationId()), any())).thenReturn(existing);

		TaxConfigurationSaveResponse response = service.save(request("groceries", from, null), true);

		assertEquals(TaxConfigurationByCategoryNameService.RULE_UPDATED, response.outcome());
		assertEquals("Tax configuration updated successfully.", response.message());
		verify(taxConfigurationService, never()).createTaxConfiguration(any());
	}

	@Test
	void aRuleForAnotherStateIsNotTheMatchingRule() {
		categoryResolves(false);
		TaxConfiguration otherState = rule(from, null);
		otherState.setStateId(UUID.randomUUID());
		when(taxConfigurationRepository.findByProductCategoryId(CATEGORY_ID)).thenReturn(List.of(otherState));
		when(taxConfigurationService.createTaxConfiguration(any())).thenAnswer(call -> new TaxConfiguration());

		assertEquals(TaxConfigurationByCategoryNameService.RULE_CREATED, service.save(request("Groceries", from, null), true).outcome());
	}

	@Test
	void anOverlapThatIsNotTheSamePeriodStaysBlockedByTheExistingOverlapValidation() {
		categoryResolves(false);
		when(taxConfigurationRepository.findByProductCategoryId(CATEGORY_ID)).thenReturn(List.of(rule(from, null)));
		when(taxConfigurationService.createTaxConfiguration(any()))
				.thenThrow(new BusinessRuleException("An active tax configuration already exists for this category and state in the same effective period"));

		BusinessRuleException failure = assertThrows(BusinessRuleException.class,
				() -> service.save(request("Groceries", LocalDate.of(2026, 6, 1), null), true));

		assertTrue(failure.getMessage().contains("already exists"));
		verify(taxConfigurationService, never()).updateTaxConfiguration(any(), any());
	}

	@Test
	void aRulePeriodThatHasAlreadyEndedIsHistoryAndIsNotChanged() {
		categoryResolves(false);
		LocalDate start = LocalDate.now().minusYears(2);
		LocalDate end = LocalDate.now().minusYears(1);
		when(taxConfigurationRepository.findByProductCategoryId(CATEGORY_ID)).thenReturn(List.of(rule(start, end)));

		assertThrows(BusinessRuleException.class, () -> service.save(request("Groceries", start, end), true));

		verify(taxConfigurationService, never()).updateTaxConfiguration(any(), any());
		verify(taxConfigurationService, never()).createTaxConfiguration(any());
	}

	@Test
	void twoRulesForTheSamePeriodAreAmbiguousAndBlocked() {
		categoryResolves(false);
		when(taxConfigurationRepository.findByProductCategoryId(CATEGORY_ID)).thenReturn(List.of(rule(from, null), rule(from, null)));

		assertThrows(BusinessRuleException.class, () -> service.save(request("Groceries", from, null), true));
		verify(taxConfigurationService, never()).updateTaxConfiguration(any(), any());
	}

	@Test
	void withoutPermissionToCreateAMissingCategoryTheAnswerIsAClearBusinessError() {
		when(categoryClient.resolve(any())).thenThrow(feignFailure(404, "{\"message\":\"Category 'X' does not exist\"}"));

		BusinessRuleException failure = assertThrows(BusinessRuleException.class, () -> service.save(request("Brand New", from, null), false));

		assertTrue(failure.getMessage().contains("Only an administrator can create a new category"));
		verify(taxConfigurationService, never()).createTaxConfiguration(any());
	}

	@Test
	void anInactiveCategoryIsReportedWithS3sOwnMessage() {
		when(categoryClient.resolve(any())).thenThrow(feignFailure(422,
				"{\"title\":\"x\",\"userMessage\":\"Category 'Festive Gifting' exists but is inactive. Activate it first or choose another category.\"}"));

		BusinessRuleException failure = assertThrows(BusinessRuleException.class, () -> service.save(request("Festive Gifting", from, null), true));

		assertEquals("Category 'Festive Gifting' exists but is inactive. Activate it first or choose another category.", failure.getMessage());
	}

	@Test
	void anUnreachableCatalogueIsReportedAndNothingIsSaved() {
		when(categoryClient.resolve(any())).thenThrow(feignFailure(503, ""));

		assertThrows(BusinessRuleException.class, () -> service.save(request("Groceries", from, null), true));
		verify(taxConfigurationService, never()).createTaxConfiguration(any());
	}

	@Test
	void invalidInputIsRejectedBeforeAnythingIsCreatedInS3() {
		assertThrows(BusinessRuleException.class, () -> service.save(request("   ", from, null), true));
		assertThrows(BusinessRuleException.class, () -> service.save(request("Groceries", from, from.minusDays(1)), true));
		assertThrows(BusinessRuleException.class, () -> service.save(new TaxConfigurationCategoryRequest("Groceries", null, stateId,
				new BigDecimal("-1"), new BigDecimal("2"), from, null, true), true));
		assertThrows(BusinessRuleException.class, () -> service.save(new TaxConfigurationCategoryRequest("Groceries", null, stateId,
				new BigDecimal("2"), null, from, null, true), true));
		verify(categoryClient, never()).resolve(any());
	}
}
