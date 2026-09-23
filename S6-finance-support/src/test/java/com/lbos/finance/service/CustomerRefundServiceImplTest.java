package com.lbos.finance.service;

import com.lbos.finance.dto.CustomerRefundRequest;
import com.lbos.finance.dto.CustomerRefundUpdateRequest;
import com.lbos.finance.entity.CustomerRefund;
import com.lbos.finance.entity.PaymentTransaction;
import com.lbos.finance.entity.SupportTicket;
import com.lbos.finance.exception.BusinessRuleException;
import com.lbos.finance.exception.ResourceNotFoundException;
import com.lbos.finance.integration.client.CatalogServiceClient;
import com.lbos.finance.integration.client.IdentityServiceClient;
import com.lbos.finance.integration.client.LogisticsServiceClient;
import com.lbos.finance.integration.client.OperationsServiceClient;
import com.lbos.finance.integration.client.OrderServiceClient;
import com.lbos.finance.integration.dto.OrderItemResponse;
import com.lbos.finance.integration.dto.OrderResponse;
import com.lbos.finance.integration.dto.ProductCategoryResponse;
import com.lbos.finance.integration.dto.ProductResponse;
import com.lbos.finance.integration.dto.TripResponse;
import com.lbos.finance.repository.CustomerRefundRepository;
import com.lbos.finance.repository.PaymentTransactionRepository;
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
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerRefundServiceImplTest {

	@Mock
	private CustomerRefundRepository customerRefundRepository;
	@Mock
	private PaymentTransactionRepository paymentTransactionRepository;
	@Mock
	private SupportTicketRepository supportTicketRepository;
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

	@InjectMocks
	private CustomerRefundServiceImpl service;

	private static final Long ORDER_ID = 8200L;
	private static final Long ORDER_ITEM_ID = 91L;
	private static final Long PRODUCT_ID = 55L;
	private static final Long CATEGORY_ID = 7L;

	private UUID paymentTransactionId;
	private UUID customerTicketId;

	@BeforeEach
	void setUp() {
		paymentTransactionId = UUID.randomUUID();
		customerTicketId = UUID.randomUUID();
		SupportTicket ticket = new SupportTicket();
		ticket.setCustomerTicketId(customerTicketId);
		ticket.setRaisedByRole("CUSTOMER");
		ticket.setTicketCategory("ORDER_ISSUE");
		ticket.setTicketSubCategory("ITEM_DAMAGED");
		ticket.setTicketStatus("IN_PROGRESS");
		ticket.setOrderId(ORDER_ID);
		lenient().when(supportTicketRepository.findById(customerTicketId)).thenReturn(Optional.of(ticket));
		lenient().when(paymentTransactionRepository.findByOrderId(ORDER_ID)).thenReturn(List.of(paymentTransaction()));
		lenient().when(customerRefundRepository.sumNonRejectedRefundAmountForItem(paymentTransactionId, ORDER_ITEM_ID)).thenReturn(BigDecimal.ZERO);
	}

	private CustomerRefundRequest request() {
		return new CustomerRefundRequest(customerTicketId, paymentTransactionId, ORDER_ITEM_ID, "RF-1001",
				new BigDecimal("249.99"), "Damaged on arrival");
	}

	private PaymentTransaction paymentTransaction() {
		PaymentTransaction pt = new PaymentTransaction();
		pt.setPaymentTransactionId(paymentTransactionId);
		pt.setOrderId(ORDER_ID);
		pt.setPaymentStatus("SUCCESS");
		pt.setEscrowStatus("RELEASED");
		pt.setAmount(new BigDecimal("249.99"));
		return pt;
	}

	private OrderResponse order(String orderStatus) {
		return new OrderResponse(ORDER_ID, "ORD-8200", UUID.randomUUID(), "STANDARD", LocalDateTime.now(),
				new BigDecimal("249.99"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, new BigDecimal("249.99"), orderStatus,
				"UPI", "PAID", "TXN-8200", OffsetDateTime.now(), "12 Main Road, South Zone, Chennai");
	}

	private OrderItemResponse orderItem(Long orderItemId) {
		return new OrderItemResponse(orderItemId, ORDER_ID, UUID.randomUUID(), PRODUCT_ID, "SKU-1", "Ceramic Mug", 1,
				new BigDecimal("249.99"), BigDecimal.ZERO, new BigDecimal("249.99"));
	}

	// Shared across tests that each exercise a different validation branch of
	// createCustomerRefund() - many of them intentionally reject before reaching every lookup
	// this stubs, so every stub here is lenient() rather than tied to one specific test's path.
	private void stubLookupChain(String orderStatus, String tripStatus) {
		lenient().when(paymentTransactionRepository.findById(paymentTransactionId)).thenReturn(Optional.of(paymentTransaction()));
		lenient().when(orderServiceClient.getOrderById(ORDER_ID)).thenReturn(order(orderStatus));
		lenient().when(orderServiceClient.getOrderItems(ORDER_ID)).thenReturn(List.of(orderItem(ORDER_ITEM_ID)));
		lenient().when(catalogServiceClient.getProduct(PRODUCT_ID)).thenReturn(new ProductResponse(PRODUCT_ID, CATEGORY_ID,
				UUID.randomUUID(), "SKU-1", "Ceramic Mug", new BigDecimal("249.99"), 12, "ACTIVE"));
		lenient().when(catalogServiceClient.getProductCategory(CATEGORY_ID))
				.thenReturn(new ProductCategoryResponse(CATEGORY_ID, "Kitchenware", "Kitchen goods", "ACTIVE"));
		lenient().when(logisticsServiceClient.getTripByOrderId(ORDER_ID)).thenReturn(new TripResponse(UUID.randomUUID(), ORDER_ID,
				UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), tripStatus, OffsetDateTime.now(), "POD-1"));
	}

	private CustomerRefund requested(UUID id, BigDecimal amount) {
		CustomerRefund refund = new CustomerRefund();
		refund.setCustomerRefundId(id);
		refund.setPaymentTransactionId(paymentTransactionId);
		refund.setRefundAmount(amount);
		refund.setRefundStatus("REQUESTED");
		refund.setReason("original reason");
		return refund;
	}

	@Test
	void createRequestsRefundForADeliveredOrderWithACompletedTrip() {
		stubLookupChain("DELIVERED", "COMPLETED");
		when(customerRefundRepository.save(any(CustomerRefund.class))).thenAnswer(invocation -> invocation.getArgument(0));

		CustomerRefund result = service.createCustomerRefund(request());

		ArgumentCaptor<CustomerRefund> captor = ArgumentCaptor.forClass(CustomerRefund.class);
		verify(customerRefundRepository).save(captor.capture());
		CustomerRefund saved = captor.getValue();
		assertEquals(customerTicketId, saved.getCustomerTicketId());
		assertEquals(paymentTransactionId, saved.getPaymentTransactionId());
		assertEquals(ORDER_ITEM_ID, saved.getOrderItemId());
		assertEquals("RF-1001", saved.getRefundReference());
		assertEquals(new BigDecimal("249.99"), saved.getRefundAmount());
		assertEquals("REQUESTED", saved.getRefundStatus());
		assertEquals("Damaged on arrival | Category: Kitchenware", saved.getReason());
		assertNotNull(saved.getRequestedAt());
		assertEquals("REQUESTED", result.getRefundStatus());
	}

	@Test
	void createRejectsARefundWhenThePaymentHasNotSucceeded() {
		PaymentTransaction pendingPayment = paymentTransaction();
		pendingPayment.setPaymentStatus("PENDING");
		when(paymentTransactionRepository.findByOrderId(ORDER_ID)).thenReturn(List.of(pendingPayment));
		when(orderServiceClient.getOrderById(ORDER_ID)).thenReturn(order("DELIVERED"));
		when(logisticsServiceClient.getTripByOrderId(ORDER_ID)).thenReturn(new TripResponse(UUID.randomUUID(), ORDER_ID,
				UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "COMPLETED", OffsetDateTime.now(), "POD-1"));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createCustomerRefund(request()));

		assertEquals("No successful payment transaction exists for this order", ex.getMessage());
		verify(customerRefundRepository, never()).save(any(CustomerRefund.class));
	}

	@Test
	void createThrowsWhenThePaymentTransactionIsMissing() {
		when(paymentTransactionRepository.findByOrderId(ORDER_ID)).thenReturn(List.of());
		when(orderServiceClient.getOrderById(ORDER_ID)).thenReturn(order("DELIVERED"));
		when(logisticsServiceClient.getTripByOrderId(ORDER_ID)).thenReturn(new TripResponse(UUID.randomUUID(), ORDER_ID,
				UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "COMPLETED", OffsetDateTime.now(), "POD-1"));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createCustomerRefund(request()));

		assertEquals("No successful payment transaction exists for this order", ex.getMessage());
		verify(customerRefundRepository, never()).save(any(CustomerRefund.class));
	}

	@Test
	void createThrowsWhenTheOrderItemIsNotPartOfTheOrder() {
		// Only getOrderItems() is actually consulted before the item-ownership check throws -
		// the rest are stubbed lenient() since exactly which upstream calls the real
		// implementation happens to make before that point isn't this test's concern.
		lenient().when(paymentTransactionRepository.findById(paymentTransactionId)).thenReturn(Optional.of(paymentTransaction()));
		lenient().when(orderServiceClient.getOrderById(ORDER_ID)).thenReturn(order("DELIVERED"));
		when(orderServiceClient.getOrderItems(ORDER_ID)).thenReturn(List.of(orderItem(999L)));

		lenient().when(logisticsServiceClient.getTripByOrderId(ORDER_ID)).thenReturn(new TripResponse(UUID.randomUUID(), ORDER_ID,
				UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "COMPLETED", OffsetDateTime.now(), "POD-1"));
		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createCustomerRefund(request()));

		assertEquals("The selected order item is not eligible for another refund", ex.getMessage());
		verify(customerRefundRepository, never()).save(any(CustomerRefund.class));
	}

	@Test
	void createRejectsAnOrderThatHasNotBeenDelivered() {
		stubLookupChain("SHIPPED", "COMPLETED");

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createCustomerRefund(request()));

		assertEquals("Only a delivered order is eligible for this refund workflow", ex.getMessage());
		verify(customerRefundRepository, never()).save(any(CustomerRefund.class));
	}

	@Test
	void createRejectsWhenTheDeliveryTripIsNotCompleted() {
		stubLookupChain("DELIVERED", "IN_TRANSIT");

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createCustomerRefund(request()));

		assertEquals("Delivery must be completed before a refund can be requested", ex.getMessage());
	}

	@Test
	void createRejectsARefundThatExceedsTheRemainingBalance() {
		stubLookupChain("DELIVERED", "COMPLETED");
		when(customerRefundRepository.sumNonRejectedRefundAmountForItem(paymentTransactionId, ORDER_ITEM_ID)).thenReturn(new BigDecimal("200.00"));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createCustomerRefund(request()));

		assertEquals("Refund amount 249.99 exceeds the remaining refundable amount of 49.99 for this item", ex.getMessage());
		verify(customerRefundRepository, never()).save(any(CustomerRefund.class));
	}

	@Test
	void getAllReturnsEverythingTheRepositoryHolds() {
		CustomerRefund refund = new CustomerRefund();
		refund.setCustomerRefundId(UUID.randomUUID());
		when(customerRefundRepository.findAll()).thenReturn(List.of(refund));

		assertEquals(1, service.getAllCustomerRefunds().size());
	}

	@Test
	void getByIdThrowsResourceNotFoundWhenAbsent() {
		UUID id = UUID.randomUUID();
		when(customerRefundRepository.findById(id)).thenReturn(Optional.empty());

		ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class,
				() -> service.getCustomerRefundById(id));

		assertEquals("CustomerRefund not found: " + id, ex.getMessage());
	}

	@Test
	void updateOnlyChangesDescriptiveFieldsWhileRequested() {
		UUID id = UUID.randomUUID();
		CustomerRefund existing = requested(id, new BigDecimal("249.99"));
		when(customerRefundRepository.findById(id)).thenReturn(Optional.of(existing));
		when(customerRefundRepository.save(any(CustomerRefund.class))).thenAnswer(invocation -> invocation.getArgument(0));

		CustomerRefund result = service.updateCustomerRefund(id, new CustomerRefundUpdateRequest("RF-NEW", "updated reason"));

		assertEquals("RF-NEW", result.getRefundReference());
		assertEquals("updated reason", result.getReason());
		assertEquals("REQUESTED", result.getRefundStatus());
		assertEquals(new BigDecimal("249.99"), result.getRefundAmount());
	}

	@Test
	void updateRejectsARefundThatHasAlreadyBeenDecided() {
		UUID id = UUID.randomUUID();
		CustomerRefund existing = requested(id, new BigDecimal("249.99"));
		existing.setRefundStatus("APPROVED");
		when(customerRefundRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class,
				() -> service.updateCustomerRefund(id, new CustomerRefundUpdateRequest("RF-NEW", "updated reason")));

		verify(customerRefundRepository, never()).save(any(CustomerRefund.class));
	}

	@Test
	void approveMovesARequestedRefundToApproved() {
		UUID id = UUID.randomUUID();
		CustomerRefund existing = requested(id, new BigDecimal("249.99"));
		when(customerRefundRepository.findById(id)).thenReturn(Optional.of(existing));
		when(customerRefundRepository.save(any(CustomerRefund.class))).thenAnswer(invocation -> invocation.getArgument(0));

		CustomerRefund result = service.approveRefund(id);

		assertEquals("APPROVED", result.getRefundStatus());
	}

	@Test
	void approveRejectsARefundThatIsNotRequested() {
		UUID id = UUID.randomUUID();
		CustomerRefund existing = requested(id, new BigDecimal("249.99"));
		existing.setRefundStatus("REJECTED");
		when(customerRefundRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class, () -> service.approveRefund(id));

		verify(customerRefundRepository, never()).save(any(CustomerRefund.class));
	}

	@Test
	void completeRequiresApprovedFirst() {
		UUID id = UUID.randomUUID();
		CustomerRefund existing = requested(id, new BigDecimal("249.99"));
		when(customerRefundRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class, () -> service.completeRefund(id));
	}

	@Test
	void completeMovesAnApprovedRefundToCompleted() {
		UUID id = UUID.randomUUID();
		CustomerRefund existing = requested(id, new BigDecimal("249.99"));
		existing.setRefundStatus("APPROVED");
		when(customerRefundRepository.findById(id)).thenReturn(Optional.of(existing));
		when(customerRefundRepository.save(any(CustomerRefund.class))).thenAnswer(invocation -> invocation.getArgument(0));

		CustomerRefund result = service.completeRefund(id);

		assertEquals("COMPLETED", result.getRefundStatus());
		assertNotNull(result.getProcessedAt());
	}

	@Test
	void deleteRemovesAStillRequestedRefund() {
		UUID id = UUID.randomUUID();
		CustomerRefund existing = requested(id, new BigDecimal("249.99"));
		when(customerRefundRepository.findById(id)).thenReturn(Optional.of(existing));

		service.deleteCustomerRefund(id);

		verify(customerRefundRepository).delete(existing);
	}

	@Test
	void deleteRejectsARefundThatHasAlreadyBeenDecided() {
		UUID id = UUID.randomUUID();
		CustomerRefund existing = requested(id, new BigDecimal("249.99"));
		existing.setRefundStatus("COMPLETED");
		when(customerRefundRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class, () -> service.deleteCustomerRefund(id));

		verify(customerRefundRepository, never()).delete(any(CustomerRefund.class));
	}
}
