package com.cbg.lbos.controller;

import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.dto.FleetExpenseDto;
import com.cbg.lbos.entity.ExpenseApprovalStatus;
import com.cbg.lbos.entity.ExpenseType;
import com.cbg.lbos.service.FleetExpenseService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Covers the GET /api/expenses listing, including the optional fleetOwnerId
 * query-parameter filter. Uses a standalone MockMvc setup so the real
 * query-parameter binding and handler mapping are exercised.
 */
@ExtendWith(MockitoExtension.class)
class FleetExpenseControllerTest {

	@Mock
	private FleetExpenseService expenseService;

	@Mock
	private S2PartnerClient partnerClient;

	private MockMvc mockMvc;

	private UUID fleetOwnerId;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.standaloneSetup(new FleetExpenseController(expenseService, partnerClient)).build();
		fleetOwnerId = UUID.randomUUID();
	}

	private FleetExpenseDto expenseFor(UUID ownerId) {
		FleetExpenseDto dto = new FleetExpenseDto();
		dto.setFleetExpenseId(UUID.randomUUID());
		dto.setFleetOwnerId(ownerId);
		dto.setExpenseType(ExpenseType.FUEL);
		dto.setAmount(new BigDecimal("250.00"));
		dto.setExpenseDate(LocalDate.now().minusDays(2));
		dto.setApprovalStatus(ExpenseApprovalStatus.PENDING);
		return dto;
	}

	@Test
	void listWithoutFleetOwnerIdReturnsEveryExpense() throws Exception {
		when(expenseService.getAll()).thenReturn(List.of(expenseFor(fleetOwnerId), expenseFor(UUID.randomUUID())));

		mockMvc.perform(get("/api/expenses")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));

		verify(expenseService).getAll();
		verify(expenseService, never()).getByFleetOwner(fleetOwnerId);
	}

	@Test
	void listWithFleetOwnerIdDelegatesToTheScopedLookup() throws Exception {
		when(expenseService.getByFleetOwner(fleetOwnerId)).thenReturn(List.of(expenseFor(fleetOwnerId)));

		mockMvc.perform(get("/api/expenses").param("fleetOwnerId", fleetOwnerId.toString()))
				.andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].fleetOwnerId").value(fleetOwnerId.toString()));

		verify(expenseService).getByFleetOwner(fleetOwnerId);
		verify(expenseService, never()).getAll();
	}

	@Test
	void approveUsesTheAuthenticatedCallerAsApproverNotAQueryParameter() throws Exception {
		UUID expenseId = UUID.randomUUID();
		UUID authenticatedAccountId = UUID.randomUUID();
		when(expenseService.approve(expenseId, authenticatedAccountId)).thenReturn(expenseFor(fleetOwnerId));

		mockMvc.perform(patch("/api/expenses/{id}/approve", expenseId)
						.principal(new UsernamePasswordAuthenticationToken(authenticatedAccountId.toString(), null, List.of())))
				.andExpect(status().isOk());

		verify(expenseService).approve(eq(expenseId), eq(authenticatedAccountId));
	}

	@Test
	void rejectUsesTheAuthenticatedCallerAsApproverNotAQueryParameter() throws Exception {
		UUID expenseId = UUID.randomUUID();
		UUID authenticatedAccountId = UUID.randomUUID();
		when(expenseService.reject(expenseId, authenticatedAccountId)).thenReturn(expenseFor(fleetOwnerId));

		mockMvc.perform(patch("/api/expenses/{id}/reject", expenseId)
						.principal(new UsernamePasswordAuthenticationToken(authenticatedAccountId.toString(), null, List.of())))
				.andExpect(status().isOk());

		verify(expenseService).reject(eq(expenseId), eq(authenticatedAccountId));
	}
}
