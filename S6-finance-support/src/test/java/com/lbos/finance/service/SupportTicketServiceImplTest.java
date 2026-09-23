package com.lbos.finance.service;

import com.lbos.finance.dto.SupportTicketMessageRequest;
import com.lbos.finance.dto.SupportTicketRequest;
import com.lbos.finance.dto.SupportTicketUpdateRequest;
import com.lbos.finance.entity.SupportTicket;
import com.lbos.finance.entity.SupportTicketMessage;
import com.lbos.finance.exception.BusinessRuleException;
import com.lbos.finance.exception.ForbiddenActionException;
import com.lbos.finance.exception.ResourceNotFoundException;
import com.lbos.finance.integration.client.IdentityServiceClient;
import com.lbos.finance.integration.client.CustomerServiceClient;
import com.lbos.finance.integration.client.OrderServiceClient;
import com.lbos.finance.integration.dto.CustomerProfileResponse;
import com.lbos.finance.integration.dto.OrderResponse;
import com.lbos.finance.integration.dto.UserAccountResponse;
import com.lbos.finance.repository.SupportTicketMessageRepository;
import com.lbos.finance.repository.SupportTicketRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SupportTicketServiceImplTest {

	@Mock
	private SupportTicketRepository supportTicketRepository;
	@Mock
	private SupportTicketMessageRepository messageRepository;
	@Mock
	private IdentityServiceClient identityServiceClient;
	@Mock
	private CustomerServiceClient customerServiceClient;
	@Mock
	private OrderServiceClient orderServiceClient;

	@InjectMocks
	private SupportTicketServiceImpl service;

	private static final Long ORDER_ID = 8200L;

	private UUID customerProfileId;
	private UUID raisedByAccountId;

	@BeforeEach
	void setUp() {
		customerProfileId = UUID.randomUUID();
		raisedByAccountId = UUID.randomUUID();
	}

	private CustomerProfileResponse profile() {
		return new CustomerProfileResponse(customerProfileId, raisedByAccountId, "ACTIVE", new BigDecimal("10.00"));
	}

	private UserAccountResponse account(String accountStatus) {
		return new UserAccountResponse(raisedByAccountId, "support@example.com", "8888888888", "Nina", "Iyer",
				"CUSTOMER", accountStatus);
	}

	private OrderResponse order(UUID owningCustomerProfileId) {
		return new OrderResponse(ORDER_ID, "ORD-8200", owningCustomerProfileId, "STANDARD", LocalDateTime.now(),
				new BigDecimal("500.00"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, new BigDecimal("500.00"), "DELIVERED",
				"UPI", "PAID", "TXN-8200", null, "12 Main Road, South Zone, Chennai");
	}

	private SupportTicketRequest request(Long orderId, String ticketNumber) {
		return new SupportTicketRequest(customerProfileId, orderId, raisedByAccountId, "CUSTOMER", "ORDER_ISSUE",
				"ITEM_DAMAGED", ticketNumber, "Item arrived broken", "The box was crushed in transit", "HIGH");
	}

	private SupportTicket open(UUID id) {
		SupportTicket ticket = new SupportTicket();
		ticket.setCustomerTicketId(id);
		ticket.setTicketNumber("TKT-001");
		ticket.setSubject("Item arrived broken");
		ticket.setPriority("HIGH");
		ticket.setTicketStatus("OPEN");
		ticket.setRaisedByAccountId(raisedByAccountId);
		return ticket;
	}

	@Test
	void createOpensATicketForAnOrderThatBelongsToTheCustomer() {
		when(customerServiceClient.getCustomerProfile(customerProfileId)).thenReturn(profile());
		when(identityServiceClient.getUserAccount(raisedByAccountId)).thenReturn(account("ACTIVE"));
		when(orderServiceClient.getOrderById(ORDER_ID)).thenReturn(order(customerProfileId));
		when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> invocation.getArgument(0));

		SupportTicket result = service.createSupportTicket(request(ORDER_ID, "TKT-001"));

		ArgumentCaptor<SupportTicket> captor = ArgumentCaptor.forClass(SupportTicket.class);
		verify(supportTicketRepository).save(captor.capture());
		SupportTicket saved = captor.getValue();
		assertEquals(customerProfileId, saved.getCustomerProfileId());
		assertEquals(ORDER_ID, saved.getOrderId());
		assertEquals(raisedByAccountId, saved.getRaisedByAccountId());
		assertEquals("CUSTOMER", saved.getRaisedByRole());
		assertEquals("ORDER_ISSUE", saved.getTicketCategory());
		assertEquals("ITEM_DAMAGED", saved.getTicketSubCategory());
		assertEquals("TKT-001", saved.getTicketNumber());
		assertEquals("HIGH", saved.getPriority());
		assertEquals("OPEN", saved.getTicketStatus());
		assertNotNull(saved.getRaisedAt());
		assertEquals("OPEN", result.getTicketStatus());
	}

	@Test
	void createSkipsTheOrderOwnershipCheckWhenNoOrderIsSupplied() {
		when(customerServiceClient.getCustomerProfile(customerProfileId)).thenReturn(profile());
		when(identityServiceClient.getUserAccount(raisedByAccountId)).thenReturn(account("ACTIVE"));
		when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> invocation.getArgument(0));

		SupportTicket result = service.createSupportTicket(request(null, "TKT-002"));

		assertNull(result.getOrderId());
		assertEquals("OPEN", result.getTicketStatus());
		verify(orderServiceClient, never()).getOrderById(anyLong());
	}

	@Test
	void createRejectsAnOrderRaisedAgainstAnotherCustomer() {
		when(customerServiceClient.getCustomerProfile(customerProfileId)).thenReturn(profile());
		when(identityServiceClient.getUserAccount(raisedByAccountId)).thenReturn(account("ACTIVE"));
		when(orderServiceClient.getOrderById(ORDER_ID)).thenReturn(order(UUID.randomUUID()));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createSupportTicket(request(ORDER_ID, "TKT-003")));

		assertEquals("Order does not belong to customer", ex.getMessage());
		verify(supportTicketRepository, never()).save(any(SupportTicket.class));
	}

	@Test
	void createRejectsAnInactiveRaisingAccount() {
		when(identityServiceClient.getUserAccount(raisedByAccountId)).thenReturn(account("SUSPENDED"));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createSupportTicket(request(null, "TKT-004")));

		assertEquals("Raising account is inactive", ex.getMessage());
		verify(supportTicketRepository, never()).save(any(SupportTicket.class));
	}

	@Test
	void createRejectsAnUnknownRaisedByRole() {
		// Role/category are validated before any lookup, so no client stubs are needed here.
		SupportTicketRequest badRole = new SupportTicketRequest(customerProfileId, null, raisedByAccountId,
				"MYSTERY_ROLE", "ORDER_ISSUE", "ITEM_DAMAGED", "TKT-005", "s", "d", "HIGH");

		assertThrows(BusinessRuleException.class, () -> service.createSupportTicket(badRole));
		verify(supportTicketRepository, never()).save(any(SupportTicket.class));
	}

	@Test
	void createRejectsACategoryNotValidForTheRaisersRole() {
		// SETTLEMENT_DELAYED is a RETAILER subcategory, invalid for a CUSTOMER-raised ticket.
		SupportTicketRequest badCategory = new SupportTicketRequest(customerProfileId, null, raisedByAccountId,
				"CUSTOMER", "PAYOUT_SETTLEMENT", "SETTLEMENT_DELAYED", "TKT-006", "s", "d", "HIGH");

		assertThrows(BusinessRuleException.class, () -> service.createSupportTicket(badCategory));
		verify(supportTicketRepository, never()).save(any(SupportTicket.class));
	}

	@Test
	void createForARetailerHasNoCustomerProfileAndSkipsCustomerLookup() {
		UUID retailerAccountId = UUID.randomUUID();
		when(identityServiceClient.getUserAccount(retailerAccountId)).thenReturn(
				new UserAccountResponse(retailerAccountId, "r@example.com", "9999999999", "R", "One", "RETAILER", "ACTIVE"));
		when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> invocation.getArgument(0));

		SupportTicketRequest retailerRequest = new SupportTicketRequest(null, null, retailerAccountId, "RETAILER",
				"PAYOUT_SETTLEMENT", "SETTLEMENT_DELAYED", "TKT-007", "Settlement delayed", "Still not paid", "MEDIUM");

		SupportTicket result = service.createSupportTicket(retailerRequest);

		assertNull(result.getCustomerProfileId());
		assertEquals("RETAILER", result.getRaisedByRole());
		verify(customerServiceClient, never()).getCustomerProfile(any());
	}

	@Test
	void getAllReturnsEverythingTheRepositoryHolds() {
		SupportTicket ticket = new SupportTicket();
		ticket.setCustomerTicketId(UUID.randomUUID());
		when(supportTicketRepository.findAll()).thenReturn(List.of(ticket));

		assertEquals(1, service.getAllSupportTickets().size());
	}

	@Test
	void getByIdThrowsResourceNotFoundWhenAbsent() {
		UUID id = UUID.randomUUID();
		when(supportTicketRepository.findById(id)).thenReturn(Optional.empty());

		ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class,
				() -> service.getSupportTicketById(id));

		assertEquals("SupportTicket not found: " + id, ex.getMessage());
	}

	@Test
	void updateOnlyChangesDescriptiveFieldsAndKeepsStatus() {
		UUID id = UUID.randomUUID();
		SupportTicket existing = open(id);
		existing.setTicketStatus("IN_PROGRESS");
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));
		when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> invocation.getArgument(0));

		SupportTicket result = service.updateSupportTicket(id, new SupportTicketUpdateRequest("new subject", "new description", "LOW"));

		assertEquals("new subject", result.getSubject());
		assertEquals("LOW", result.getPriority());
		assertEquals("IN_PROGRESS", result.getTicketStatus());
	}

	@Test
	void updateRejectsAClosedTicket() {
		UUID id = UUID.randomUUID();
		SupportTicket existing = open(id);
		existing.setTicketStatus("CLOSED");
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class,
				() -> service.updateSupportTicket(id, new SupportTicketUpdateRequest("x", "y", "LOW")));

		verify(supportTicketRepository, never()).save(any(SupportTicket.class));
	}

	@Test
	void assignMovesAnOpenTicketToInProgress() {
		UUID id = UUID.randomUUID();
		UUID supportAccountId = UUID.randomUUID();
		SupportTicket existing = open(id);
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));
		when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> invocation.getArgument(0));

		SupportTicket result = service.assignTicket(id, supportAccountId);

		assertEquals("IN_PROGRESS", result.getTicketStatus());
		assertEquals(supportAccountId, result.getAssignedSupportAccountId());
	}

	@Test
	void resolveRequiresInProgressFirst() {
		UUID id = UUID.randomUUID();
		SupportTicket existing = open(id);
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class, () -> service.resolveTicket(id));
	}

	@Test
	void resolveMovesAnInProgressTicketToResolvedAndStampsResolvedAt() {
		UUID id = UUID.randomUUID();
		SupportTicket existing = open(id);
		existing.setTicketStatus("IN_PROGRESS");
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));
		when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> invocation.getArgument(0));

		SupportTicket result = service.resolveTicket(id);

		assertEquals("RESOLVED", result.getTicketStatus());
		assertNotNull(result.getResolvedAt());
	}

	@Test
	void closeRequiresResolvedFirst() {
		UUID id = UUID.randomUUID();
		SupportTicket existing = open(id);
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class, () -> service.closeTicket(id));
	}

	@Test
	void closeMovesAResolvedTicketToClosed() {
		UUID id = UUID.randomUUID();
		SupportTicket existing = open(id);
		existing.setTicketStatus("RESOLVED");
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));
		when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> invocation.getArgument(0));

		SupportTicket result = service.closeTicket(id);

		assertEquals("CLOSED", result.getTicketStatus());
	}

	@Test
	void escalateRequiresInProgressFirst() {
		UUID id = UUID.randomUUID();
		SupportTicket existing = open(id);
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class,
				() -> service.escalateTicket(id, "OPERATIONS_MANAGER", null, null, "Needs zone-level review", UUID.randomUUID()));
	}

	@Test
	void escalateRejectsAnUnknownTargetRole() {
		// toRole is validated before the ticket is even looked up, so no repository stub is needed.
		UUID id = UUID.randomUUID();

		assertThrows(BusinessRuleException.class,
				() -> service.escalateTicket(id, "RETAILER", null, null, "reason", UUID.randomUUID()));
	}

	@Test
	void escalateSetsMetadataKeepsStatusAndLogsAnInternalNote() {
		UUID id = UUID.randomUUID();
		UUID escalatedBy = UUID.randomUUID();
		SupportTicket existing = open(id);
		existing.setTicketStatus("IN_PROGRESS");
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));
		when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> invocation.getArgument(0));

		SupportTicket result = service.escalateTicket(id, "OPERATIONS_MANAGER", null, null, "Needs zone-level review", escalatedBy);

		assertEquals("IN_PROGRESS", result.getTicketStatus());
		assertEquals("OPERATIONS_MANAGER", result.getEscalatedToRole());
		assertEquals(escalatedBy, result.getEscalatedByAccountId());
		assertEquals("Needs zone-level review", result.getEscalationReason());
		assertNotNull(result.getEscalatedAt());

		ArgumentCaptor<SupportTicketMessage> noteCaptor = ArgumentCaptor.forClass(SupportTicketMessage.class);
		verify(messageRepository).save(noteCaptor.capture());
		assertEquals(id, noteCaptor.getValue().getCustomerTicketId());
		assertTrue(noteCaptor.getValue().isInternalNote());
	}

	@Test
	void deleteRemovesAStillOpenTicket() {
		UUID id = UUID.randomUUID();
		SupportTicket existing = open(id);
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));

		service.deleteSupportTicket(id);

		verify(supportTicketRepository).delete(existing);
	}

	@Test
	void deleteRejectsATicketThatIsAlreadyBeingWorked() {
		UUID id = UUID.randomUUID();
		SupportTicket existing = open(id);
		existing.setTicketStatus("IN_PROGRESS");
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class, () -> service.deleteSupportTicket(id));

		verify(supportTicketRepository, never()).delete(any(SupportTicket.class));
	}

	@Test
	void deleteThrowsWhenTheTicketIsMissing() {
		UUID id = UUID.randomUUID();
		when(supportTicketRepository.findById(id)).thenReturn(Optional.empty());

		assertThrows(ResourceNotFoundException.class, () -> service.deleteSupportTicket(id));
		verify(supportTicketRepository, never()).delete(any(SupportTicket.class));
	}

	@Test
	void addMessageAllowsTheRaiserToPostANonInternalMessage() {
		UUID id = UUID.randomUUID();
		SupportTicket existing = open(id);
		existing.setTicketStatus("IN_PROGRESS");
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));
		when(messageRepository.save(any(SupportTicketMessage.class))).thenAnswer(invocation -> invocation.getArgument(0));

		SupportTicketMessage result = service.addMessage(id, raisedByAccountId, "CUSTOMER",
				new SupportTicketMessageRequest("Any update?", true));

		assertEquals("Any update?", result.getMessage());
		// A non-staff sender can never force an internal note, regardless of what they asked.
		assertFalse(result.isInternalNote());
	}

	@Test
	void addMessageAllowsStaffToPostAnInternalNote() {
		UUID id = UUID.randomUUID();
		SupportTicket existing = open(id);
		existing.setTicketStatus("IN_PROGRESS");
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));
		when(messageRepository.save(any(SupportTicketMessage.class))).thenAnswer(invocation -> invocation.getArgument(0));

		SupportTicketMessage result = service.addMessage(id, UUID.randomUUID(), "SUPPORT_STAFF",
				new SupportTicketMessageRequest("Checked with warehouse", true));

		assertTrue(result.isInternalNote());
	}

	@Test
	void addMessageRejectsSomeoneWhoIsNeitherTheRaiserNorStaff() {
		UUID id = UUID.randomUUID();
		SupportTicket existing = open(id);
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(ForbiddenActionException.class, () -> service.addMessage(id, UUID.randomUUID(), "CUSTOMER",
				new SupportTicketMessageRequest("Let me in", false)));
		verify(messageRepository, never()).save(any(SupportTicketMessage.class));
	}

	@Test
	void addMessageRejectsAClosedTicket() {
		UUID id = UUID.randomUUID();
		SupportTicket existing = open(id);
		existing.setTicketStatus("CLOSED");
		when(supportTicketRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class, () -> service.addMessage(id, raisedByAccountId, "CUSTOMER",
				new SupportTicketMessageRequest("still there?", false)));
	}

	@Test
	void getMessagesHidesInternalNotesFromANonStaffViewer() {
		UUID id = UUID.randomUUID();
		SupportTicketMessage visible = new SupportTicketMessage();
		visible.setInternalNote(false);
		SupportTicketMessage internal = new SupportTicketMessage();
		internal.setInternalNote(true);
		when(messageRepository.findByCustomerTicketIdOrderBySentAtAsc(id)).thenReturn(List.of(visible, internal));

		List<SupportTicketMessage> forRaiser = service.getMessages(id, false);
		List<SupportTicketMessage> forStaff = service.getMessages(id, true);

		assertEquals(1, forRaiser.size());
		assertEquals(2, forStaff.size());
	}
}
