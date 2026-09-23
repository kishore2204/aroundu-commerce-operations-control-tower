package com.lbos.finance.service;

import com.lbos.finance.dto.SettlementRequest;
import com.lbos.finance.dto.SettlementUpdateRequest;
import com.lbos.finance.entity.PaymentTransaction;
import com.lbos.finance.entity.Settlement;
import com.lbos.finance.exception.BusinessRuleException;
import com.lbos.finance.exception.ResourceNotFoundException;
import com.lbos.finance.integration.client.CatalogServiceClient;
import com.lbos.finance.integration.client.IdentityServiceClient;
import com.lbos.finance.integration.client.LogisticsServiceClient;
import com.lbos.finance.integration.client.OperationsServiceClient;
import com.lbos.finance.integration.client.OrderServiceClient;
import com.lbos.finance.integration.client.PartnerServiceClient;
import com.lbos.finance.integration.dto.OperationsManagerResponse;
import com.lbos.finance.repository.PaymentTransactionRepository;
import com.lbos.finance.repository.SettlementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SettlementServiceImplTest {

	@Mock
	private SettlementRepository settlementRepository;
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
	private PartnerServiceClient partnerServiceClient;

	@InjectMocks
	private SettlementServiceImpl service;

	private UUID paymentTransactionId;
	private UUID operationsManagerId;

	@BeforeEach
	void setUp() {
		paymentTransactionId = UUID.randomUUID();
		operationsManagerId = UUID.randomUUID();
		lenient().when(settlementRepository.existsByPaymentTransactionId(paymentTransactionId)).thenReturn(false);
	}

	private PaymentTransaction payment(String paymentStatus, String escrowStatus) {
		PaymentTransaction paymentTransaction = new PaymentTransaction();
		paymentTransaction.setPaymentTransactionId(paymentTransactionId);
		paymentTransaction.setOrderId(9100L);
		paymentTransaction.setPaymentStatus(paymentStatus);
		paymentTransaction.setEscrowStatus(escrowStatus);
		paymentTransaction.setAmount(new BigDecimal("5000.00"));
		return paymentTransaction;
	}

	private OperationsManagerResponse manager(String assignmentStatus) {
		return new OperationsManagerResponse(operationsManagerId, UUID.randomUUID(), UUID.randomUUID(),
				assignmentStatus);
	}

	private SettlementRequest request(UUID managerId) {
		return new SettlementRequest(managerId, paymentTransactionId, "STL-2026-01", new BigDecimal("5000.00"),
				new BigDecimal("125.50"), LocalDate.of(2026, 4, 1));
	}

	private Settlement pending(UUID id) {
		Settlement settlement = new Settlement();
		settlement.setSettlementId(id);
		settlement.setPaymentTransactionId(paymentTransactionId);
		settlement.setSettlementReference("OLD-STL");
		settlement.setGrossAmount(new BigDecimal("5000.00"));
		settlement.setFeeAmount(new BigDecimal("125.50"));
		settlement.setNetAmount(new BigDecimal("4874.50"));
		settlement.setSettlementStatus("PENDING");
		return settlement;
	}

	@Test
	void createComputesNetAmountAsGrossMinusFee() {
		when(paymentTransactionRepository.findById(paymentTransactionId))
				.thenReturn(Optional.of(payment("SUCCESS", "RELEASED")));
		when(operationsServiceClient.getOperationsManager(operationsManagerId)).thenReturn(manager("ACTIVE"));
		when(settlementRepository.save(any(Settlement.class))).thenAnswer(invocation -> invocation.getArgument(0));

		Settlement result = service.createSettlement(request(operationsManagerId));

		ArgumentCaptor<Settlement> captor = ArgumentCaptor.forClass(Settlement.class);
		verify(settlementRepository).save(captor.capture());
		Settlement saved = captor.getValue();
		assertEquals(operationsManagerId, saved.getOperationsManagerId());
		assertEquals(paymentTransactionId, saved.getPaymentTransactionId());
		assertEquals("STL-2026-01", saved.getSettlementReference());
		assertEquals(new BigDecimal("5000.00"), saved.getGrossAmount());
		assertEquals(new BigDecimal("125.50"), saved.getFeeAmount());
		assertEquals(new BigDecimal("4874.50"), saved.getNetAmount());
		assertEquals("PENDING", saved.getSettlementStatus());
		assertEquals(LocalDate.of(2026, 4, 1), saved.getSettlementDate());
		assertTrue(saved.getCreatedAt() != null);
		assertEquals("PENDING", result.getSettlementStatus());
	}

	@Test
	void createSkipsTheOperationsManagerLookupWhenNoManagerIsSupplied() {
		when(paymentTransactionRepository.findById(paymentTransactionId))
				.thenReturn(Optional.of(payment("SUCCESS", "RELEASED")));
		when(settlementRepository.save(any(Settlement.class))).thenAnswer(invocation -> invocation.getArgument(0));

		Settlement result = service.createSettlement(request(null));

		assertNull(result.getOperationsManagerId());
		assertEquals(new BigDecimal("4874.50"), result.getNetAmount());
		verifyNoInteractions(operationsServiceClient);
	}

	@Test
	void createRejectsAPaymentThatHasNotSucceeded() {
		when(paymentTransactionRepository.findById(paymentTransactionId))
				.thenReturn(Optional.of(payment("PENDING", "RELEASED")));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createSettlement(request(null)));

		assertEquals("Settlement requires successful payment and released escrow", ex.getMessage());
		verify(settlementRepository, never()).save(any(Settlement.class));
	}

	@Test
	void createRejectsEscrowThatHasNotBeenReleased() {
		when(paymentTransactionRepository.findById(paymentTransactionId))
				.thenReturn(Optional.of(payment("SUCCESS", "HELD")));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createSettlement(request(null)));

		assertEquals("Settlement requires successful payment and released escrow", ex.getMessage());
	}

	@Test
	void createRejectsAnInactiveOperationsManagerBeforeCheckingThePayment() {
		when(paymentTransactionRepository.findById(paymentTransactionId))
				.thenReturn(Optional.of(payment("PENDING", "HELD")));
		when(operationsServiceClient.getOperationsManager(operationsManagerId)).thenReturn(manager("SUSPENDED"));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createSettlement(request(operationsManagerId)));

		assertEquals("Operations manager is not active", ex.getMessage());
		verify(settlementRepository, never()).save(any(Settlement.class));
	}

	@Test
	void createThrowsWhenThePaymentTransactionIsMissing() {
		when(paymentTransactionRepository.findById(paymentTransactionId)).thenReturn(Optional.empty());

		ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class,
				() -> service.createSettlement(request(null)));

		assertEquals("Payment transaction not found", ex.getMessage());
	}

	@Test
	void createRejectsASecondSettlementForTheSamePaymentTransaction() {
		when(paymentTransactionRepository.findById(paymentTransactionId))
				.thenReturn(Optional.of(payment("SUCCESS", "RELEASED")));
		when(settlementRepository.existsByPaymentTransactionId(paymentTransactionId)).thenReturn(true);

		assertThrows(BusinessRuleException.class, () -> service.createSettlement(request(null)));

		verify(settlementRepository, never()).save(any(Settlement.class));
	}

	@Test
	void createRejectsAGrossAmountExceedingThePaymentAmount() {
		when(paymentTransactionRepository.findById(paymentTransactionId))
				.thenReturn(Optional.of(payment("SUCCESS", "RELEASED")));
		SettlementRequest oversized = new SettlementRequest(null, paymentTransactionId, "STL-1",
				new BigDecimal("6000.00"), new BigDecimal("10.00"), LocalDate.now());

		assertThrows(BusinessRuleException.class, () -> service.createSettlement(oversized));

		verify(settlementRepository, never()).save(any(Settlement.class));
	}

	@Test
	void createRejectsAFeeAmountExceedingTheGrossAmount() {
		when(paymentTransactionRepository.findById(paymentTransactionId))
				.thenReturn(Optional.of(payment("SUCCESS", "RELEASED")));
		SettlementRequest badFee = new SettlementRequest(null, paymentTransactionId, "STL-1",
				new BigDecimal("100.00"), new BigDecimal("200.00"), LocalDate.now());

		assertThrows(BusinessRuleException.class, () -> service.createSettlement(badFee));

		verify(settlementRepository, never()).save(any(Settlement.class));
	}

	@Test
	void getAllReturnsEverythingTheRepositoryHolds() {
		Settlement settlement = new Settlement();
		settlement.setSettlementId(UUID.randomUUID());
		when(settlementRepository.findAll()).thenReturn(List.of(settlement));

		assertEquals(1, service.getAllSettlements().size());
	}

	@Test
	void getByIdThrowsResourceNotFoundWhenAbsent() {
		UUID id = UUID.randomUUID();
		when(settlementRepository.findById(id)).thenReturn(Optional.empty());

		ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class, () -> service.getSettlementById(id));

		assertEquals("Settlement not found: " + id, ex.getMessage());
	}

	@Test
	void updateOnlyChangesReferenceAndDateWhilePending() {
		UUID id = UUID.randomUUID();
		Settlement existing = pending(id);
		when(settlementRepository.findById(id)).thenReturn(Optional.of(existing));
		when(settlementRepository.save(any(Settlement.class))).thenAnswer(invocation -> invocation.getArgument(0));

		Settlement result = service.updateSettlement(id, new SettlementUpdateRequest("STL-NEW", LocalDate.of(2026, 5, 1)));

		assertEquals("STL-NEW", result.getSettlementReference());
		assertEquals(LocalDate.of(2026, 5, 1), result.getSettlementDate());
		assertEquals(new BigDecimal("5000.00"), result.getGrossAmount());
		assertEquals("PENDING", result.getSettlementStatus());
	}

	@Test
	void updateRejectsASettlementThatIsAlreadyCompleted() {
		UUID id = UUID.randomUUID();
		Settlement existing = pending(id);
		existing.setSettlementStatus("COMPLETED");
		existing.setCompletedAt(OffsetDateTime.now());
		when(settlementRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class,
				() -> service.updateSettlement(id, new SettlementUpdateRequest("STL-NEW", LocalDate.now())));

		verify(settlementRepository, never()).save(any(Settlement.class));
	}

	@Test
	void completeMovesAPendingSettlementToCompletedAndStampsCompletedAt() {
		UUID id = UUID.randomUUID();
		Settlement existing = pending(id);
		when(settlementRepository.findById(id)).thenReturn(Optional.of(existing));
		when(settlementRepository.save(any(Settlement.class))).thenAnswer(invocation -> invocation.getArgument(0));

		Settlement result = service.completeSettlement(id);

		assertEquals("COMPLETED", result.getSettlementStatus());
		assertNotNull(result.getCompletedAt());
	}

	@Test
	void completeRejectsASettlementThatIsNotPending() {
		UUID id = UUID.randomUUID();
		Settlement existing = pending(id);
		existing.setSettlementStatus("COMPLETED");
		when(settlementRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class, () -> service.completeSettlement(id));
	}

	@Test
	void deleteRemovesAStillPendingSettlement() {
		UUID id = UUID.randomUUID();
		Settlement existing = pending(id);
		when(settlementRepository.findById(id)).thenReturn(Optional.of(existing));

		service.deleteSettlement(id);

		verify(settlementRepository).delete(existing);
	}

	@Test
	void deleteRejectsASettlementThatIsAlreadyCompleted() {
		UUID id = UUID.randomUUID();
		Settlement existing = pending(id);
		existing.setSettlementStatus("COMPLETED");
		when(settlementRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class, () -> service.deleteSettlement(id));

		verify(settlementRepository, never()).delete(any(Settlement.class));
	}

	@Test
	void deleteThrowsWhenTheSettlementIsMissing() {
		UUID id = UUID.randomUUID();
		when(settlementRepository.findById(id)).thenReturn(Optional.empty());

		assertThrows(ResourceNotFoundException.class, () -> service.deleteSettlement(id));
		verify(settlementRepository, never()).delete(any(Settlement.class));
	}

	private Settlement payee(String type, UUID payeeId) {
		Settlement s = new Settlement();
		s.setPayeeType(type);
		s.setPayeeId(payeeId);
		return s;
	}

	@Test
	void getAllSettlementsShowsBusinessNamesInsteadOfPayeeIds() {
		UUID retailerId = UUID.randomUUID();
		UUID fleetOwnerId = UUID.randomUUID();
		UUID unknownRetailerId = UUID.randomUUID();
		when(settlementRepository.findAll()).thenReturn(List.of(
				payee("RETAILER", retailerId), payee("RETAILER", retailerId),
				payee("FLEET_OWNER", fleetOwnerId), payee("PLATFORM", null), payee(null, null),
				payee("RETAILER", unknownRetailerId)));
		when(partnerServiceClient.getRetailer(retailerId)).thenReturn(new PartnerServiceClient.RetailerSummary(retailerId, null, "Fresh Mart"));
		when(partnerServiceClient.getFleetOwner(fleetOwnerId)).thenReturn(new PartnerServiceClient.FleetOwnerSummary(fleetOwnerId, null, "Swift Fleet"));
		when(partnerServiceClient.getRetailer(unknownRetailerId)).thenThrow(new RuntimeException("not found"));

		List<Settlement> result = service.getAllSettlements();

		assertEquals("Fresh Mart", result.get(0).getPayeeName());
		assertEquals("Fresh Mart", result.get(1).getPayeeName());
		assertEquals("Swift Fleet", result.get(2).getPayeeName());
		assertEquals("AroundU Platform", result.get(3).getPayeeName());
		assertEquals("N/A", result.get(4).getPayeeName());
		assertEquals("N/A", result.get(5).getPayeeName());
		// each distinct payee is looked up once - duplicates do not cause extra calls
		verify(partnerServiceClient, org.mockito.Mockito.times(1)).getRetailer(retailerId);
	}
}
