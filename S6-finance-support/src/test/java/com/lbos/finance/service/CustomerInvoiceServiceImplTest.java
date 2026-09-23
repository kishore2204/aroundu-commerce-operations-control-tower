package com.lbos.finance.service;

import com.lbos.finance.dto.CustomerInvoiceRequest;
import com.lbos.finance.entity.CustomerInvoice;
import com.lbos.finance.exception.ResourceNotFoundException;
import com.lbos.finance.integration.client.CatalogServiceClient;
import com.lbos.finance.integration.client.IdentityServiceClient;
import com.lbos.finance.integration.client.LogisticsServiceClient;
import com.lbos.finance.integration.client.OperationsServiceClient;
import com.lbos.finance.integration.client.OrderServiceClient;
import com.lbos.finance.integration.dto.OrderItemResponse;
import com.lbos.finance.integration.dto.OrderResponse;
import com.lbos.finance.repository.CustomerInvoiceRepository;
import com.lbos.finance.repository.PaymentTransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerInvoiceServiceImplTest {

	@Mock
	private CustomerInvoiceRepository customerInvoiceRepository;
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
	private CustomerInvoiceServiceImpl service;

	private static final Long ORDER_ID = 7100L;

	private OrderResponse order() {
		return new OrderResponse(ORDER_ID, "ORD-7100", UUID.randomUUID(), "STANDARD", LocalDateTime.now(),
				new BigDecimal("300.75"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, new BigDecimal("300.75"), "DELIVERED",
				"UPI", "PAID", "TXN-7100", null, "12 Main Road, South Zone, Chennai");
	}

	private OrderItemResponse item(long orderItemId, String lineTotal) {
		return new OrderItemResponse(orderItemId, ORDER_ID, UUID.randomUUID(), 55L, "SKU-" + orderItemId, "Widget", 1,
				new BigDecimal(lineTotal), BigDecimal.ZERO, new BigDecimal(lineTotal));
	}

	private CustomerInvoiceRequest request(String invoiceNumber, String taxAmount) {
		return new CustomerInvoiceRequest(ORDER_ID, invoiceNumber, LocalDate.of(2026, 3, 14), new BigDecimal(taxAmount));
	}

	@Test
	void createComputesSubtotalFromOrderItemsAndIssuesTheInvoice() {
		when(orderServiceClient.getOrderById(ORDER_ID)).thenReturn(order());
		when(orderServiceClient.getOrderItems(ORDER_ID)).thenReturn(List.of(item(1L, "100.50"), item(2L, "200.25")));
		when(customerInvoiceRepository.save(any(CustomerInvoice.class))).thenAnswer(invocation -> invocation.getArgument(0));

		CustomerInvoice result = service.createCustomerInvoice(request("INV-001", "54.14"));

		ArgumentCaptor<CustomerInvoice> captor = ArgumentCaptor.forClass(CustomerInvoice.class);
		verify(customerInvoiceRepository).save(captor.capture());
		CustomerInvoice saved = captor.getValue();
		assertEquals(ORDER_ID, saved.getOrderId());
		assertEquals("INV-001", saved.getInvoiceNumber());
		assertEquals(LocalDate.of(2026, 3, 14), saved.getInvoiceDate());
		assertEquals(new BigDecimal("300.75"), saved.getSubtotalAmount());
		assertEquals(new BigDecimal("54.14"), saved.getTaxAmount());
		assertEquals(new BigDecimal("354.89"), saved.getTotalAmount());
		assertEquals("ISSUED", saved.getInvoiceStatus());
		assertEquals("ISSUED", result.getInvoiceStatus());
	}

	@Test
	void createTreatsAnOrderWithoutItemsAsAZeroSubtotal() {
		when(orderServiceClient.getOrderById(ORDER_ID)).thenReturn(order());
		when(orderServiceClient.getOrderItems(ORDER_ID)).thenReturn(List.of());
		when(customerInvoiceRepository.save(any(CustomerInvoice.class))).thenAnswer(invocation -> invocation.getArgument(0));

		CustomerInvoice result = service.createCustomerInvoice(request("INV-002", "0.00"));

		assertEquals(0, result.getSubtotalAmount().compareTo(BigDecimal.ZERO));
		assertEquals(0, result.getTotalAmount().compareTo(BigDecimal.ZERO));
	}

	@Test
	void createAbortsWhenTheOrderCannotBeResolved() {
		when(orderServiceClient.getOrderById(ORDER_ID))
				.thenThrow(new ResourceNotFoundException("Order not found: " + ORDER_ID));

		assertThrows(ResourceNotFoundException.class, () -> service.createCustomerInvoice(request("INV-003", "5.00")));

		verify(customerInvoiceRepository, never()).save(any(CustomerInvoice.class));
	}

	@Test
	void getAllReturnsEverythingTheRepositoryHolds() {
		CustomerInvoice invoice = new CustomerInvoice();
		invoice.setInvoiceId(UUID.randomUUID());
		when(customerInvoiceRepository.findAll()).thenReturn(List.of(invoice));

		assertEquals(1, service.getAllCustomerInvoices().size());
	}

	@Test
	void getByIdThrowsResourceNotFoundWhenAbsent() {
		UUID id = UUID.randomUUID();
		when(customerInvoiceRepository.findById(id)).thenReturn(Optional.empty());

		ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class,
				() -> service.getCustomerInvoiceById(id));

		assertEquals("CustomerInvoice not found: " + id, ex.getMessage());
	}

	@Test
	void updateCopiesTheRecalculatedValuesOntoTheExistingRowAndKeepsItsId() {
		UUID id = UUID.randomUUID();
		CustomerInvoice existing = new CustomerInvoice();
		existing.setInvoiceId(id);
		existing.setOrderId(1L);
		existing.setInvoiceNumber("OLD-INV");
		existing.setSubtotalAmount(new BigDecimal("1.00"));
		existing.setTaxAmount(new BigDecimal("0.10"));
		existing.setTotalAmount(new BigDecimal("1.10"));
		existing.setInvoiceStatus("DRAFT");

		when(customerInvoiceRepository.findById(id)).thenReturn(Optional.of(existing));
		when(orderServiceClient.getOrderById(ORDER_ID)).thenReturn(order());
		when(orderServiceClient.getOrderItems(ORDER_ID)).thenReturn(List.of(item(1L, "100.50"), item(2L, "200.25")));
		when(customerInvoiceRepository.save(any(CustomerInvoice.class))).thenAnswer(invocation -> invocation.getArgument(0));

		CustomerInvoice result = service.updateCustomerInvoice(id, request("NEW-INV", "54.14"));

		assertEquals(id, result.getInvoiceId());
		assertEquals("NEW-INV", result.getInvoiceNumber());
		assertEquals(ORDER_ID, result.getOrderId());
		assertEquals(new BigDecimal("300.75"), result.getSubtotalAmount());
		assertEquals(new BigDecimal("354.89"), result.getTotalAmount());
		assertEquals("ISSUED", result.getInvoiceStatus());
		verify(customerInvoiceRepository).save(existing);
	}

	@Test
	void updateReRunsTheOrderLookupAndAbortsWhenItFails() {
		UUID id = UUID.randomUUID();
		CustomerInvoice existing = new CustomerInvoice();
		existing.setInvoiceId(id);
		existing.setInvoiceNumber("OLD-INV");
		when(customerInvoiceRepository.findById(id)).thenReturn(Optional.of(existing));
		when(orderServiceClient.getOrderById(ORDER_ID))
				.thenThrow(new ResourceNotFoundException("Order not found: " + ORDER_ID));

		assertThrows(ResourceNotFoundException.class,
				() -> service.updateCustomerInvoice(id, request("NEW-INV", "1.00")));

		assertEquals("OLD-INV", existing.getInvoiceNumber());
		verify(orderServiceClient, times(1)).getOrderById(ORDER_ID);
		verify(customerInvoiceRepository, never()).save(any(CustomerInvoice.class));
	}

	@Test
	void deleteRemovesTheLoadedInvoice() {
		UUID id = UUID.randomUUID();
		CustomerInvoice existing = new CustomerInvoice();
		existing.setInvoiceId(id);
		when(customerInvoiceRepository.findById(id)).thenReturn(Optional.of(existing));

		service.deleteCustomerInvoice(id);

		verify(customerInvoiceRepository).delete(existing);
	}

	@Test
	void deleteThrowsWhenTheInvoiceIsMissing() {
		UUID id = UUID.randomUUID();
		when(customerInvoiceRepository.findById(id)).thenReturn(Optional.empty());

		assertThrows(ResourceNotFoundException.class, () -> service.deleteCustomerInvoice(id));
		verify(customerInvoiceRepository, never()).delete(any(CustomerInvoice.class));
	}
}
