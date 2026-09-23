package com.lbos.finance.service;

import com.lbos.finance.dto.NotificationRequest;
import com.lbos.finance.entity.Notification;
import com.lbos.finance.exception.BusinessRuleException;
import com.lbos.finance.exception.ResourceNotFoundException;
import com.lbos.finance.integration.client.CatalogServiceClient;
import com.lbos.finance.integration.client.IdentityServiceClient;
import com.lbos.finance.integration.client.LogisticsServiceClient;
import com.lbos.finance.integration.client.OperationsServiceClient;
import com.lbos.finance.integration.client.OrderServiceClient;
import com.lbos.finance.integration.dto.UserAccountResponse;
import com.lbos.finance.repository.NotificationRepository;
import com.lbos.finance.repository.PaymentTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceImplTest {

	@Mock
	private NotificationRepository notificationRepository;
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

	@InjectMocks
	private NotificationServiceImpl service;

	private UUID userAccountId;

	@BeforeEach
	void setUp() {
		userAccountId = UUID.randomUUID();
	}

	private UserAccountResponse account(String accountStatus) {
		return new UserAccountResponse(userAccountId, "alerts@example.com", "9999900000", "Ravi", "Menon", "CUSTOMER",
				accountStatus);
	}

	private NotificationRequest request(String title, String message) {
		return new NotificationRequest(userAccountId, "CUSTOMER", "PAYMENT_SUCCESS", "PAYMENT", "TXN-7700", title,
				message);
	}

	@Test
	void createStoresAnUnreadNotificationForAnActiveRecipient() {
		when(identityServiceClient.getUserAccount(userAccountId)).thenReturn(account("ACTIVE"));
		when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));

		LocalDateTime beforeCall = LocalDateTime.now();
		Notification result = service.createNotification(request("Payment received", "We received your payment."));

		ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
		verify(notificationRepository).save(captor.capture());
		Notification saved = captor.getValue();
		assertEquals(userAccountId, saved.getUserAccountId());
		assertEquals("CUSTOMER", saved.getRole());
		assertEquals("PAYMENT_SUCCESS", saved.getNotificationType());
		assertEquals("PAYMENT", saved.getReferenceType());
		assertEquals("TXN-7700", saved.getReferenceId());
		assertEquals("Payment received", saved.getTitle());
		assertEquals("We received your payment.", saved.getMessage());
		assertFalse(saved.isRead());
		assertNotNull(saved.getSentAt());
		assertFalse(saved.getSentAt().isBefore(beforeCall));
		assertFalse(result.isRead());
	}

	@Test
	void createRejectsAnInactiveRecipientAccount() {
		when(identityServiceClient.getUserAccount(userAccountId)).thenReturn(account("SUSPENDED"));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.createNotification(request("Payment received", "We received your payment.")));

		assertEquals("Notification recipient is inactive", ex.getMessage());
		verify(notificationRepository, never()).save(any(Notification.class));
	}

	@Test
	void getAllReturnsEverythingTheRepositoryHolds() {
		Notification notification = new Notification();
		notification.setNotificationId(1L);
		when(notificationRepository.findAll()).thenReturn(List.of(notification));

		assertEquals(1, service.getAllNotifications().size());
	}

	@Test
	void getByIdThrowsResourceNotFoundWhenAbsent() {
		when(notificationRepository.findById(42L)).thenReturn(Optional.empty());

		ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class,
				() -> service.getNotificationById(42L));

		assertEquals("Notification not found: 42", ex.getMessage());
	}

	@Test
	void updateCopiesTheRemappedValuesOntoTheExistingRowAndKeepsItsId() {
		Notification existing = new Notification();
		existing.setNotificationId(7L);
		existing.setTitle("old title");
		existing.setMessage("old message");
		existing.setNotificationType("REFUND_INITIATED");
		existing.setRead(true);
		existing.setSentAt(LocalDateTime.of(2020, 1, 1, 0, 0));

		when(notificationRepository.findById(7L)).thenReturn(Optional.of(existing));
		when(identityServiceClient.getUserAccount(userAccountId)).thenReturn(account("ACTIVE"));
		when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));

		Notification result = service.updateNotification(7L, request("new title", "new message"));

		assertEquals(Long.valueOf(7L), result.getNotificationId());
		assertEquals("new title", result.getTitle());
		assertEquals("new message", result.getMessage());
		assertEquals("PAYMENT_SUCCESS", result.getNotificationType());
		assertEquals(userAccountId, result.getUserAccountId());
		// The reflection copy overwrites every non-@Id field, so the read flag and sentAt are reset.
		assertFalse(result.isRead());
		assertTrue(result.getSentAt().isAfter(LocalDateTime.of(2020, 1, 1, 0, 0)));
		verify(notificationRepository).save(existing);
		// The mutation landed on the loaded row itself, not on a detached copy.
		assertEquals("new title", existing.getTitle());
	}

	@Test
	void updateReRunsTheRecipientStatusRuleAndRefusesAnInactiveAccount() {
		Notification existing = new Notification();
		existing.setNotificationId(8L);
		existing.setTitle("old title");
		when(notificationRepository.findById(8L)).thenReturn(Optional.of(existing));
		when(identityServiceClient.getUserAccount(userAccountId)).thenReturn(account("LOCKED"));

		BusinessRuleException ex = assertThrows(BusinessRuleException.class,
				() -> service.updateNotification(8L, request("new title", "new message")));

		assertEquals("Notification recipient is inactive", ex.getMessage());
		assertEquals("old title", existing.getTitle());
		verify(notificationRepository, never()).save(any(Notification.class));
	}

	@Test
	void markReadFlipsTheFlagOnTheLoadedNotificationAndSavesIt() {
		Notification existing = new Notification();
		existing.setNotificationId(11L);
		existing.setTitle("Payment received");
		existing.setRead(false);
		when(notificationRepository.findById(11L)).thenReturn(Optional.of(existing));
		when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));

		Notification result = service.markNotificationRead(11L);

		assertTrue(result.isRead());
		assertEquals(Long.valueOf(11L), result.getNotificationId());
		// Only the read flag moves: no remapping, no sentAt reset.
		assertEquals("Payment received", result.getTitle());
		verify(notificationRepository).save(existing);
		assertTrue(existing.isRead());
	}

	@Test
	void markReadThrowsResourceNotFoundWhenTheNotificationIsMissing() {
		when(notificationRepository.findById(404L)).thenReturn(Optional.empty());

		ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class,
				() -> service.markNotificationRead(404L));

		assertEquals("Notification not found: 404", ex.getMessage());
		verify(notificationRepository, never()).save(any(Notification.class));
	}

	@Test
	void markAllReadFlipsEveryNotificationBelongingToTheRecipient() {
		Notification unread = new Notification();
		unread.setNotificationId(21L);
		unread.setUserAccountId(userAccountId);
		unread.setRead(false);
		Notification alreadyRead = new Notification();
		alreadyRead.setNotificationId(22L);
		alreadyRead.setUserAccountId(userAccountId);
		alreadyRead.setRead(true);
		when(notificationRepository.findByUserAccountId(userAccountId)).thenReturn(List.of(unread, alreadyRead));
		when(notificationRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

		List<Notification> result = service.markAllNotificationsRead(userAccountId);

		assertEquals(2, result.size());
		assertTrue(unread.isRead());
		assertTrue(alreadyRead.isRead());
		// Scoped to the one recipient, not a table-wide scan.
		verify(notificationRepository).findByUserAccountId(userAccountId);
		verify(notificationRepository, never()).findAll();
		verify(notificationRepository).saveAll(List.of(unread, alreadyRead));
	}

	@Test
	void markAllReadIsANoOpWhenTheRecipientHasNoNotifications() {
		when(notificationRepository.findByUserAccountId(userAccountId)).thenReturn(List.of());
		when(notificationRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

		assertTrue(service.markAllNotificationsRead(userAccountId).isEmpty());
	}

	@Test
	void deleteRemovesTheLoadedNotification() {
		Notification existing = new Notification();
		existing.setNotificationId(9L);
		when(notificationRepository.findById(9L)).thenReturn(Optional.of(existing));

		service.deleteNotification(9L);

		verify(notificationRepository).delete(existing);
	}

	@Test
	void deleteThrowsWhenTheNotificationIsMissing() {
		when(notificationRepository.findById(10L)).thenReturn(Optional.empty());

		assertThrows(ResourceNotFoundException.class, () -> service.deleteNotification(10L));
		verify(notificationRepository, never()).delete(any(Notification.class));
	}
}
