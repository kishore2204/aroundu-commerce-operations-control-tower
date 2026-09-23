package com.lbos.finance.service;

import com.lbos.finance.dto.AuditLogRequest;
import com.lbos.finance.entity.AuditLog;
import com.lbos.finance.exception.ResourceNotFoundException;
import com.lbos.finance.integration.client.IdentityServiceClient;
import com.lbos.finance.integration.dto.UserAccountResponse;
import com.lbos.finance.repository.AuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditLogServiceImplTest {

	@Mock
	private AuditLogRepository auditLogRepository;
	@Mock
	private IdentityServiceClient identityServiceClient;

	@InjectMocks
	private AuditLogServiceImpl service;

	private UUID userAccountId;

	@BeforeEach
	void setUp() {
		userAccountId = UUID.randomUUID();
	}

	private UserAccountResponse account(String accountStatus) {
		return new UserAccountResponse(userAccountId, "auditor@example.com", "9000011111", "Asha", "Rao", "ADMIN",
				accountStatus);
	}

	private AuditLogRequest request(UUID accountId, String action) {
		return new AuditLogRequest(accountId, action, "PAYMENTS", "{\"status\":\"PENDING\"}",
				"{\"status\":\"SUCCESS\"}", "10.20.30.40");
	}

	@Test
	void createWritesASystemLogWithoutContactingIdentityWhenNoAccountIsSupplied() {
		when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

		OffsetDateTime beforeCall = OffsetDateTime.now();
		AuditLog result = service.createAuditLog(request(null, "PAYMENT_STATUS_CHANGED"));

		ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
		verify(auditLogRepository).save(captor.capture());
		AuditLog saved = captor.getValue();
		assertNull(saved.getUserAccountId());
		assertEquals("PAYMENT_STATUS_CHANGED", saved.getAction());
		assertEquals("PAYMENTS", saved.getSourceModule());
		assertEquals("{\"status\":\"PENDING\"}", saved.getOldValues());
		assertEquals("{\"status\":\"SUCCESS\"}", saved.getNewValues());
		assertEquals("10.20.30.40", saved.getIpAddress());
		assertNotNull(saved.getPerformedAt());
		assertTrue(!saved.getPerformedAt().isBefore(beforeCall));
		assertNull(result.getUserAccountId());
		// No account id means the existence lookup is skipped entirely.
		verifyNoInteractions(identityServiceClient);
	}

	@Test
	void createLooksUpTheAccountOnlyForExistenceAndIgnoresItsStatus() {
		// Unlike every other S6 service, AuditLogServiceImpl discards the response and never
		// checks accountStatus, so even a SUSPENDED account is logged successfully.
		when(identityServiceClient.getUserAccount(userAccountId)).thenReturn(account("SUSPENDED"));
		when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

		AuditLog result = service.createAuditLog(request(userAccountId, "INVOICE_VOIDED"));

		verify(identityServiceClient).getUserAccount(userAccountId);
		assertEquals(userAccountId, result.getUserAccountId());
		assertEquals("INVOICE_VOIDED", result.getAction());
		assertNotNull(result.getPerformedAt());
		verify(auditLogRepository).save(any(AuditLog.class));
	}

	@Test
	void getAllReturnsEverythingTheRepositoryHolds() {
		AuditLog auditLog = new AuditLog();
		auditLog.setAuditLogId(UUID.randomUUID());
		when(auditLogRepository.findAll()).thenReturn(List.of(auditLog));

		assertEquals(1, service.getAllAuditLogs().size());
	}

	@Test
	void getByIdThrowsResourceNotFoundWhenAbsent() {
		UUID id = UUID.randomUUID();
		when(auditLogRepository.findById(id)).thenReturn(Optional.empty());

		ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class, () -> service.getAuditLogById(id));

		assertEquals("AuditLog not found: " + id, ex.getMessage());
	}
}
