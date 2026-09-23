package com.cbg.lbos.service;

import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.dto.FleetExpenseDto;
import com.cbg.lbos.dto.FleetOwnerValidationDto;
import com.cbg.lbos.entity.ExpenseApprovalStatus;
import com.cbg.lbos.entity.ExpenseType;
import com.cbg.lbos.entity.FleetExpense;
import com.cbg.lbos.repository.FleetExpenseRepository;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetExpenseServiceImplTest {

	@Mock
	private FleetExpenseRepository expenseRepository;
	@Mock
	private S2PartnerClient s2PartnerClient;

	@InjectMocks
	private FleetExpenseServiceImpl service;

	private UUID fleetOwnerId;
	private UUID createdBy;

	@BeforeEach
	void setUp() {
		fleetOwnerId = UUID.randomUUID();
		createdBy = UUID.randomUUID();
	}

	private FleetExpenseDto requestDto(BigDecimal amount, LocalDate expenseDate) {
		FleetExpenseDto dto = new FleetExpenseDto();
		dto.setFleetOwnerId(fleetOwnerId);
		dto.setVehicleId(UUID.randomUUID());
		dto.setDriverId(UUID.randomUUID());
		dto.setCreatedByAccountId(createdBy);
		dto.setExpenseType(ExpenseType.FUEL);
		dto.setAmount(amount);
		dto.setExpenseDate(expenseDate);
		return dto;
	}

	/*
	 * The service checks ownerStatus (the fleet owner account's active/suspended state), not
	 * profileStatus (S2's KYC/verification outcome) - S2 seeds profileStatus=VERIFIED,
	 * ownerStatus=ACTIVE for the demo fleet owner, confirmed live against
	 * /internal/v1/fleet-owners/{id}/validation.
	 */
	private FleetOwnerValidationDto owner(String ownerStatus) {
		FleetOwnerValidationDto validation = new FleetOwnerValidationDto();
		validation.setFleetOwnerId(fleetOwnerId);
		validation.setProfileStatus("VERIFIED");
		validation.setOwnerStatus(ownerStatus);
		validation.setVerificationStatus("VERIFIED");
		return validation;
	}

	private FleetExpense pendingExpense(UUID id) {
		FleetExpense expense = new FleetExpense();
		expense.setFleetExpenseId(id);
		expense.setFleetOwnerId(fleetOwnerId);
		expense.setCreatedByAccountId(createdBy);
		expense.setAmount(new BigDecimal("1200.50"));
		expense.setExpenseDate(LocalDate.now().minusDays(1));
		expense.setExpenseType(ExpenseType.FUEL);
		expense.setApprovalStatus(ExpenseApprovalStatus.PENDING);
		return expense;
	}

	@Test
	void createSavesExpenseAsPendingWhenFleetOwnerIsActive() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("ACTIVE"));
		when(expenseRepository.save(any(FleetExpense.class))).thenAnswer(invocation -> invocation.getArgument(0));

		LocalDate today = LocalDate.now();
		FleetExpenseDto result = service.create(requestDto(new BigDecimal("999.99"), today), createdBy);

		ArgumentCaptor<FleetExpense> captor = ArgumentCaptor.forClass(FleetExpense.class);
		verify(expenseRepository).save(captor.capture());
		FleetExpense saved = captor.getValue();
		assertEquals(ExpenseApprovalStatus.PENDING, saved.getApprovalStatus());
		assertEquals(new BigDecimal("999.99"), saved.getAmount());
		assertEquals(today, saved.getExpenseDate());
		assertEquals(ExpenseType.FUEL, saved.getExpenseType());
		assertEquals(ExpenseApprovalStatus.PENDING, result.getApprovalStatus());
		assertEquals(createdBy, saved.getCreatedByAccountId());
	}

	@Test
	void createIgnoresClientSuppliedCreatedByAccountIdAndUsesTheAuthenticatedCaller() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("ACTIVE"));
		when(expenseRepository.save(any(FleetExpense.class))).thenAnswer(invocation -> invocation.getArgument(0));

		FleetExpenseDto dto = requestDto(new BigDecimal("10.00"), LocalDate.now());
		dto.setCreatedByAccountId(UUID.randomUUID());
		UUID actualCaller = UUID.randomUUID();

		FleetExpenseDto result = service.create(dto, actualCaller);

		assertEquals(actualCaller, result.getCreatedByAccountId());
	}

	@Test
	void createRejectsWhenFleetOwnerIsNotActiveInS2() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("SUSPENDED"));

		RuntimeException ex = assertThrows(RuntimeException.class,
				() -> service.create(requestDto(new BigDecimal("10.00"), LocalDate.now()), createdBy));

		assertEquals("Fleet owner inactive in S2", ex.getMessage());
		verify(expenseRepository, never()).save(any(FleetExpense.class));
	}

	@Test
	void createRejectsZeroAmount() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("ACTIVE"));

		RuntimeException ex = assertThrows(RuntimeException.class,
				() -> service.create(requestDto(BigDecimal.ZERO, LocalDate.now()), createdBy));

		assertEquals("Invalid expense", ex.getMessage());
		verify(expenseRepository, never()).save(any(FleetExpense.class));
	}

	@Test
	void createRejectsNegativeAmount() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("ACTIVE"));

		assertThrows(RuntimeException.class,
				() -> service.create(requestDto(new BigDecimal("-1.00"), LocalDate.now()), createdBy));
		verify(expenseRepository, never()).save(any(FleetExpense.class));
	}

	@Test
	void createRejectsMissingAmount() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("ACTIVE"));

		assertThrows(RuntimeException.class, () -> service.create(requestDto(null, LocalDate.now()), createdBy));
	}


	@Test
	void createRejectsAmountAboveTenThousand() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("ACTIVE"));

		RuntimeException ex = assertThrows(RuntimeException.class,
				() -> service.create(requestDto(new BigDecimal("10000.01"), LocalDate.now()), createdBy));

		assertEquals("A single expense cannot exceed ₹10,000", ex.getMessage());
		verify(expenseRepository, never()).save(any(FleetExpense.class));
	}

	@Test
	void createRejectsFutureExpenseDate() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("ACTIVE"));

		RuntimeException ex = assertThrows(RuntimeException.class,
				() -> service.create(requestDto(new BigDecimal("50.00"), LocalDate.now().plusDays(1)), createdBy));

		assertEquals("Invalid expense", ex.getMessage());
		verify(expenseRepository, never()).save(any(FleetExpense.class));
	}

	@Test
	void createRejectsMissingExpenseDateAsAValidationError() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("ACTIVE"));

		RuntimeException ex = assertThrows(RuntimeException.class,
				() -> service.create(requestDto(new BigDecimal("50.00"), null), createdBy));

		assertEquals("Invalid expense", ex.getMessage());
		verify(expenseRepository, never()).save(any(FleetExpense.class));
	}

	@Test
	void approveMovesPendingExpenseToApprovedAndRecordsApprover() {
		UUID id = UUID.randomUUID();
		UUID approver = UUID.randomUUID();
		FleetExpense existing = pendingExpense(id);
		when(expenseRepository.findById(id)).thenReturn(Optional.of(existing));
		when(expenseRepository.save(any(FleetExpense.class))).thenAnswer(invocation -> invocation.getArgument(0));

		FleetExpenseDto result = service.approve(id, approver);

		assertEquals(ExpenseApprovalStatus.APPROVED, result.getApprovalStatus());
		assertEquals(approver, result.getApprovedByAccountId());
		assertEquals(ExpenseApprovalStatus.APPROVED, existing.getApprovalStatus());
		verify(expenseRepository).save(existing);
	}

	@Test
	void approveRejectsSelfApprovalByTheCreator() {
		UUID id = UUID.randomUUID();
		FleetExpense existing = pendingExpense(id);
		when(expenseRepository.findById(id)).thenReturn(Optional.of(existing));

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.approve(id, createdBy));

		assertEquals("You recorded this expense yourself, so it has to be approved by someone else (for example an Operations Manager)", ex.getMessage());
		assertEquals(ExpenseApprovalStatus.PENDING, existing.getApprovalStatus());
		verify(expenseRepository, never()).save(any(FleetExpense.class));
	}

	@Test
	void approveRejectsAnExpenseThatIsNoLongerPending() {
		UUID id = UUID.randomUUID();
		FleetExpense existing = pendingExpense(id);
		existing.setApprovalStatus(ExpenseApprovalStatus.APPROVED);
		when(expenseRepository.findById(id)).thenReturn(Optional.of(existing));

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.approve(id, UUID.randomUUID()));

		assertEquals("Only a pending expense can be approved - this one is already approved", ex.getMessage());
		verify(expenseRepository, never()).save(any(FleetExpense.class));
	}

	@Test
	void approveThrowsWhenExpenseIsMissing() {
		UUID id = UUID.randomUUID();
		when(expenseRepository.findById(id)).thenReturn(Optional.empty());

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.approve(id, UUID.randomUUID()));

		assertEquals("Expense not found", ex.getMessage());
	}

	@Test
	void rejectMovesPendingExpenseToRejected() {
		UUID id = UUID.randomUUID();
		UUID rejecter = UUID.randomUUID();
		FleetExpense existing = pendingExpense(id);
		when(expenseRepository.findById(id)).thenReturn(Optional.of(existing));
		when(expenseRepository.save(any(FleetExpense.class))).thenAnswer(invocation -> invocation.getArgument(0));

		FleetExpenseDto result = service.reject(id, rejecter);

		assertEquals(ExpenseApprovalStatus.REJECTED, result.getApprovalStatus());
		// Known limitation: the entity has no rejectedByAccountId column, so the
		// rejecting account is recorded in approvedByAccountId.
		assertEquals(rejecter, result.getApprovedByAccountId());
		verify(expenseRepository).save(existing);
	}

	@Test
	void rejectIsAllowedForTheCreatorSinceOnlyApprovalForbidsSelfAction() {
		UUID id = UUID.randomUUID();
		FleetExpense existing = pendingExpense(id);
		when(expenseRepository.findById(id)).thenReturn(Optional.of(existing));
		when(expenseRepository.save(any(FleetExpense.class))).thenAnswer(invocation -> invocation.getArgument(0));

		FleetExpenseDto result = service.reject(id, createdBy);

		assertEquals(ExpenseApprovalStatus.REJECTED, result.getApprovalStatus());
	}

	@Test
	void rejectRejectsAnExpenseThatIsAlreadyRejected() {
		UUID id = UUID.randomUUID();
		FleetExpense existing = pendingExpense(id);
		existing.setApprovalStatus(ExpenseApprovalStatus.REJECTED);
		when(expenseRepository.findById(id)).thenReturn(Optional.of(existing));

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.reject(id, UUID.randomUUID()));

		assertEquals("Expense is already rejected", ex.getMessage());
		verify(expenseRepository, never()).save(any(FleetExpense.class));
	}

	@Test
	void rejectCanCorrectAnAccidentallyApprovedExpense() {
		UUID id = UUID.randomUUID();
		UUID rejecter = UUID.randomUUID();
		FleetExpense existing = pendingExpense(id);
		existing.setApprovalStatus(ExpenseApprovalStatus.APPROVED);
		when(expenseRepository.findById(id)).thenReturn(Optional.of(existing));
		when(expenseRepository.save(any(FleetExpense.class))).thenAnswer(invocation -> invocation.getArgument(0));

		FleetExpenseDto result = service.reject(id, rejecter);

		assertEquals(ExpenseApprovalStatus.REJECTED, result.getApprovalStatus());
		assertEquals(rejecter, result.getApprovedByAccountId());
		verify(expenseRepository).save(existing);
	}

	@Test
	void getThrowsWhenExpenseIsMissing() {
		UUID id = UUID.randomUUID();
		when(expenseRepository.findById(id)).thenReturn(Optional.empty());

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.get(id));

		assertEquals("Expense not found", ex.getMessage());
	}

	@Test
	void getAllMapsEveryExpense() {
		when(expenseRepository.findAll()).thenReturn(List.of(pendingExpense(UUID.randomUUID())));

		List<FleetExpenseDto> result = service.getAll();

		assertEquals(1, result.size());
		assertEquals(ExpenseApprovalStatus.PENDING, result.get(0).getApprovalStatus());
	}

	@Test
	void getByFleetOwnerReturnsOnlyThatOwnersExpensesFromTheScopedQuery() {
		FleetExpense owned = pendingExpense(UUID.randomUUID());
		when(expenseRepository.findByFleetOwnerId(fleetOwnerId)).thenReturn(List.of(owned));

		List<FleetExpenseDto> result = service.getByFleetOwner(fleetOwnerId);

		assertEquals(1, result.size());
		assertEquals(fleetOwnerId, result.get(0).getFleetOwnerId());
		assertEquals(owned.getFleetExpenseId(), result.get(0).getFleetExpenseId());
		verify(expenseRepository).findByFleetOwnerId(fleetOwnerId);
		verify(expenseRepository, never()).findAll();
	}

	@Test
	void getByFleetOwnerReturnsEmptyListWhenOwnerHasNoExpenses() {
		UUID otherOwnerId = UUID.randomUUID();
		when(expenseRepository.findByFleetOwnerId(otherOwnerId)).thenReturn(List.of());

		List<FleetExpenseDto> result = service.getByFleetOwner(otherOwnerId);

		assertEquals(0, result.size());
		verify(expenseRepository, never()).findAll();
	}

	@Test
	void deleteRemovesTheLoadedExpense() {
		UUID id = UUID.randomUUID();
		FleetExpense existing = pendingExpense(id);
		when(expenseRepository.findById(id)).thenReturn(Optional.of(existing));

		service.delete(id);

		verify(expenseRepository).delete(existing);
	}
}
