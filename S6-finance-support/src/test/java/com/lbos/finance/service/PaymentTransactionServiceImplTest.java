package com.lbos.finance.service;

import com.lbos.finance.dto.PaymentTransactionRequest;
import com.lbos.finance.entity.PaymentTransaction;
import com.lbos.finance.exception.BusinessRuleException;
import com.lbos.finance.exception.ResourceNotFoundException;
import com.lbos.finance.integration.client.IdentityServiceClient;
import com.lbos.finance.integration.client.CustomerServiceClient;
import com.lbos.finance.integration.client.OrderServiceClient;
import com.lbos.finance.integration.dto.CustomerProfileResponse;
import com.lbos.finance.integration.dto.OrderResponse;
import com.lbos.finance.integration.dto.UserAccountResponse;
import com.lbos.finance.repository.PaymentTransactionRepository;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentTransactionServiceImplTest {

	@Mock
	private PaymentTransactionRepository paymentTransactionRepository;
	@Mock
	private OrderServiceClient orderServiceClient;
	@Mock
	private IdentityServiceClient identityServiceClient;
	@Mock
	private CustomerServiceClient customerServiceClient;

	@InjectMocks
	private PaymentTransactionServiceImpl service;

	private static final Long ORDER_ID = 4001L;

	private UUID customerProfileId;
	private UUID userAccountId;

	@BeforeEach
	void setUp() {
		customerProfileId = UUID.randomUUID();
		userAccountId = UUID.randomUUID();
	}

	private OrderResponse order(String orderStatus, String paymentMethod, String paymentStatus, BigDecimal total) {
		return new OrderResponse(ORDER_ID, "ORD-4001", customerProfileId, "STANDARD", LocalDateTime.now(),
				new BigDecimal("900.00"), new BigDecimal("100.00"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, total, orderStatus, paymentMethod,
				paymentStatus, "TXN-REF-1", null, "12 Main Road, South Zone, Chennai");
	}

	private CustomerProfileResponse profile(String profileStatus) {
		return new CustomerProfileResponse(customerProfileId, userAccountId, profileStatus, new BigDecimal("25.00"));
	}

	private UserAccountResponse account(String accountStatus) {
		return new UserAccountResponse(userAccountId, "buyer@example.com", "9999999999", "Asha", "Rao", "CUSTOMER",
				accountStatus);
	}

	private void stubValidChain(String paymentMethod, String paymentStatus) {
		when(orderServiceClient.getOrderById(ORDER_ID))
				.thenReturn(order("CONFIRMED", paymentMethod, paymentStatus, new BigDecimal("1000.00")));
		when(customerServiceClient.getCustomerProfile(customerProfileId)).thenReturn(profile("ACTIVE"));
		when(identityServiceClient.getUserAccount(userAccountId)).thenReturn(account("ACTIVE"));
	}

	private PaymentTransaction pending(UUID id) {
		PaymentTransaction tx = new PaymentTransaction();
		tx.setPaymentTransactionId(id);
		tx.setAmount(new BigDecimal("1000.00"));
		tx.setPaymentStatus("PENDING");
		tx.setEscrowStatus("NOT_HELD");
		return tx;
	}

	@Test
	void createBuildsPendingTransactionFromTheOrderTotal() {
		stubValidChain("UPI", "UNPAID");
		when(paymentTransactionRepository.save(any(PaymentTransaction.class))).thenAnswer(invocation -> invocation.getArgument(0));

		PaymentTransaction result = service.createPaymentTransaction(new PaymentTransactionRequest(ORDER_ID, "UPI"));

		ArgumentCaptor<PaymentTransaction> captor = ArgumentCaptor.forClass(PaymentTransaction.class);
		verify(paymentTransactionRepository).save(captor.capture());
		PaymentTransaction saved = captor.getValue();
		assertEquals(ORDER_ID, saved.getOrderId());
		assertEquals("UPI", saved.getPaymentMethod());
		assertEquals(new BigDecimal("1000.00"), saved.getAmount());
		assertEquals("PENDING", saved.getPaymentStatus());
		assertEquals("NOT_HELD", saved.getEscrowStatus());
		assertEquals("INR", saved.getCurrencyCode());
		assertEquals("PENDING", result.getPaymentStatus());
	}

	@Test
	void createIsCaseInsensitiveAboutThePaymentMethodMatch() {
		stubValidChain("UPI", "UNPAID");
		when(paymentTransactionRepository.save(any(PaymentTransaction.class))).thenAnswer(invocation -> invocation.getArgument(0));

		PaymentTransaction result = service.createPaymentTransaction(new PaymentTransactionRequest(ORDER_ID, "upi"));

		assertEquals("upi", result.getPaymentMethod());
	}

	@Test
	void createRejectsAnOrderThatIsAlreadyPaid() {
		stubValidChain("UPI", "PAID");

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createPaymentTransaction(new PaymentTransactionRequest(ORDER_ID, "UPI")));

		assertEquals("The order has already been paid", ex.getMessage());
		verify(paymentTransactionRepository, never()).save(any(PaymentTransaction.class));
	}

	@Test
	void createRejectsAPaymentMethodThatDoesNotMatchTheOrder() {
		stubValidChain("UPI", "UNPAID");

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createPaymentTransaction(new PaymentTransactionRequest(ORDER_ID, "CARD")));

		assertEquals("Payment method does not match the order", ex.getMessage());
		verify(paymentTransactionRepository, never()).save(any(PaymentTransaction.class));
	}

	@Test
	void createRejectsASecondLivePaymentForTheSameOrder() {
		stubValidChain("UPI", "UNPAID");
		when(paymentTransactionRepository.existsByOrderIdAndPaymentStatusNot(ORDER_ID, "FAILED")).thenReturn(true);

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createPaymentTransaction(new PaymentTransactionRequest(ORDER_ID, "UPI")));

		assertEquals("A payment transaction already exists for order " + ORDER_ID, ex.getMessage());
		verify(paymentTransactionRepository, never()).save(any(PaymentTransaction.class));
	}

	@Test
	void createAllowsARetryAfterAPreviousAttemptFailed() {
		stubValidChain("UPI", "UNPAID");
		when(paymentTransactionRepository.existsByOrderIdAndPaymentStatusNot(ORDER_ID, "FAILED")).thenReturn(false);
		when(paymentTransactionRepository.save(any(PaymentTransaction.class))).thenAnswer(invocation -> invocation.getArgument(0));

		PaymentTransaction result = service.createPaymentTransaction(new PaymentTransactionRequest(ORDER_ID, "UPI"));

		assertEquals("PENDING", result.getPaymentStatus());
	}

	@Test
	void createRejectsAnOrderWithAZeroTotalAmount() {
		when(orderServiceClient.getOrderById(ORDER_ID))
				.thenReturn(order("CONFIRMED", "UPI", "UNPAID", BigDecimal.ZERO));
		when(customerServiceClient.getCustomerProfile(customerProfileId)).thenReturn(profile("ACTIVE"));
		when(identityServiceClient.getUserAccount(userAccountId)).thenReturn(account("ACTIVE"));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createPaymentTransaction(new PaymentTransactionRequest(ORDER_ID, "UPI")));

		assertEquals("Order total amount must be greater than zero to create a payment transaction", ex.getMessage());
		verify(paymentTransactionRepository, never()).save(any(PaymentTransaction.class));
	}

	@Test
	void createRejectsAnInactiveCustomerProfile() {
		when(orderServiceClient.getOrderById(ORDER_ID))
				.thenReturn(order("CONFIRMED", "UPI", "UNPAID", new BigDecimal("1000.00")));
		when(customerServiceClient.getCustomerProfile(customerProfileId)).thenReturn(profile("SUSPENDED"));
		when(identityServiceClient.getUserAccount(userAccountId)).thenReturn(account("ACTIVE"));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createPaymentTransaction(new PaymentTransactionRequest(ORDER_ID, "UPI")));

		assertEquals("Customer profile is not active", ex.getMessage());
	}

	@Test
	void createRejectsAnInactiveUserAccount() {
		when(orderServiceClient.getOrderById(ORDER_ID))
				.thenReturn(order("CONFIRMED", "UPI", "UNPAID", new BigDecimal("1000.00")));
		when(customerServiceClient.getCustomerProfile(customerProfileId)).thenReturn(profile("ACTIVE"));
		when(identityServiceClient.getUserAccount(userAccountId)).thenReturn(account("LOCKED"));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createPaymentTransaction(new PaymentTransactionRequest(ORDER_ID, "UPI")));

		assertEquals("Customer account is not active", ex.getMessage());
	}

	@Test
	void getAllReturnsEverythingTheRepositoryHolds() {
		PaymentTransaction transaction = new PaymentTransaction();
		transaction.setPaymentTransactionId(UUID.randomUUID());
		when(paymentTransactionRepository.findAll()).thenReturn(List.of(transaction));

		assertEquals(1, service.getAllPaymentTransactions().size());
	}

	@Test
	void getByIdThrowsResourceNotFoundWhenAbsent() {
		UUID id = UUID.randomUUID();
		when(paymentTransactionRepository.findById(id)).thenReturn(Optional.empty());

		ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class,
				() -> service.getPaymentTransactionById(id));

		assertEquals("Payment transaction not found: " + id, ex.getMessage());
	}

	@Test
	void captureMovesAPendingTransactionToSuccessAndHeldEscrow() {
		UUID id = UUID.randomUUID();
		PaymentTransaction existing = pending(id);
		when(paymentTransactionRepository.findById(id)).thenReturn(Optional.of(existing));
		when(paymentTransactionRepository.save(any(PaymentTransaction.class))).thenAnswer(invocation -> invocation.getArgument(0));

		PaymentTransaction result = service.capture(id);

		assertEquals("SUCCESS", result.getPaymentStatus());
		assertEquals("HELD", result.getEscrowStatus());
	}

	@Test
	void captureRejectsATransactionThatIsNotPending() {
		UUID id = UUID.randomUUID();
		PaymentTransaction existing = pending(id);
		existing.setPaymentStatus("SUCCESS");
		when(paymentTransactionRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class, () -> service.capture(id));

		verify(paymentTransactionRepository, never()).save(any(PaymentTransaction.class));
	}

	@Test
	void releaseEscrowRequiresSuccessAndHeld() {
		UUID id = UUID.randomUUID();
		PaymentTransaction existing = pending(id);
		when(paymentTransactionRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class, () -> service.releaseEscrow(id));

		verify(paymentTransactionRepository, never()).save(any(PaymentTransaction.class));
	}

	@Test
	void releaseEscrowMovesHeldEscrowToReleased() {
		UUID id = UUID.randomUUID();
		PaymentTransaction existing = pending(id);
		existing.setPaymentStatus("SUCCESS");
		existing.setEscrowStatus("HELD");
		when(paymentTransactionRepository.findById(id)).thenReturn(Optional.of(existing));
		when(paymentTransactionRepository.save(any(PaymentTransaction.class))).thenAnswer(invocation -> invocation.getArgument(0));

		PaymentTransaction result = service.releaseEscrow(id);

		assertEquals("RELEASED", result.getEscrowStatus());
	}

	@Test
	void failPaymentRejectsATransactionThatIsNotPending() {
		UUID id = UUID.randomUUID();
		PaymentTransaction existing = pending(id);
		existing.setPaymentStatus("SUCCESS");
		when(paymentTransactionRepository.findById(id)).thenReturn(Optional.of(existing));

		assertThrows(BusinessRuleException.class, () -> service.failPayment(id, "gateway declined"));
	}

	@Test
	void failPaymentMovesAPendingTransactionToFailed() {
		UUID id = UUID.randomUUID();
		PaymentTransaction existing = pending(id);
		when(paymentTransactionRepository.findById(id)).thenReturn(Optional.of(existing));
		when(paymentTransactionRepository.save(any(PaymentTransaction.class))).thenAnswer(invocation -> invocation.getArgument(0));

		PaymentTransaction result = service.failPayment(id, "gateway declined");

		assertEquals("FAILED", result.getPaymentStatus());
	}
}
