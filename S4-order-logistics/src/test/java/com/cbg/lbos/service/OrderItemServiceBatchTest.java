package com.cbg.lbos.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.cbg.lbos.client.InventoryClient;
import com.cbg.lbos.client.ProductClient;
import com.cbg.lbos.client.RetailerClient;
import com.cbg.lbos.client.dto.ApiResponseEnvelope;
import com.cbg.lbos.client.dto.ProductSummary;
import com.cbg.lbos.dto.OrderItemDto;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.entity.OrderItem;
import com.cbg.lbos.exception.InsufficientStockException;
import com.cbg.lbos.repository.OrderItemRepository;
import com.cbg.lbos.repository.OrderRepository;

/**
 * Checkout used to POST every line of an order separately and at the same time; each one recalculated the order's totals from
 * the lines it could see. createBatch() takes all lines of one order in one transaction and recalculates once.
 */
@ExtendWith(MockitoExtension.class)
class OrderItemServiceBatchTest {
    private static final Long ORDER_ID = 10L;
    private static final UUID RETAILER_ID = UUID.randomUUID();

    @Mock private OrderItemRepository orderItemRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private ProductClient productClient;
    @Mock private RetailerClient retailerClient;
    @Mock private InventoryClient inventoryClient;
    @Mock private OrderService orderService;
    @InjectMocks private OrderItemService service;

    private OrderItemDto line(long productId, int quantity) {
        OrderItemDto dto = new OrderItemDto();
        dto.setOrderId(ORDER_ID);
        dto.setRetailerId(RETAILER_ID);
        dto.setProductId(productId);
        dto.setQuantity(quantity);
        return dto;
    }

    private void productsExist(long... ids) {
        Order order = new Order();
        order.setId(ORDER_ID);
        order.setOrderStatus("NEW");
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
        when(productClient.getProductsByIds(any())).thenReturn(new ApiResponseEnvelope<>(OffsetDateTime.now(), "c", "OK",
                java.util.Arrays.stream(ids).mapToObj(this::summary).toList()));
    }

    private ProductSummary summary(long id) {
        return new ProductSummary(id, "Product " + id, "SKU-" + id, 1L, "Cat", RETAILER_ID, new BigDecimal("50.00"), 100,
                "ACTIVE", "IN_STOCK", "desc");
    }

    @Test
    void allLinesAreSavedTogetherAndTheOrderTotalsAreRecalculatedExactlyOnce() {
        productsExist(1L, 2L);
        when(orderItemRepository.saveAll(any())).thenAnswer(call -> call.getArgument(0));

        List<OrderItemDto> saved = service.createBatch(List.of(line(1L, 2), line(2L, 1)));

        assertEquals(2, saved.size());
        verify(inventoryClient, times(2)).deductStock(anyLong(), any());
        verify(orderItemRepository, times(1)).saveAll(any());
        verify(orderService, times(1)).recalculateTotals(ORDER_ID);
        // the products of the whole batch are read with ONE call, not one per line
        verify(productClient, times(1)).getProductsByIds(any());
        verify(productClient, never()).getProduct(anyLong());
    }

    @Test
    void aProductTheBatchReadDidNotReturnFallsBackToTheSingleRead() {
        Order order = new Order();
        order.setId(ORDER_ID);
        order.setOrderStatus("NEW");
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
        when(productClient.getProductsByIds(any())).thenReturn(new ApiResponseEnvelope<>(OffsetDateTime.now(), "c", "OK", List.of(summary(1L))));
        when(productClient.getProduct(2L)).thenReturn(new ApiResponseEnvelope<>(OffsetDateTime.now(), "c", "OK", summary(2L)));
        when(orderItemRepository.saveAll(any())).thenAnswer(call -> call.getArgument(0));

        assertEquals(2, service.createBatch(List.of(line(1L, 1), line(2L, 1))).size());

        verify(productClient, never()).getProduct(1L);
        verify(productClient, times(1)).getProduct(2L);
    }

    @Test
    void ifALaterLineCannotBeReservedTheStockAlreadyTakenIsGivenBackAndNothingIsSaved() {
        productsExist(1L, 2L);
        // lenient: strict stubs would otherwise flag the (intended) deductStock(1L) call as a stubbing-argument mismatch
        org.mockito.Mockito.lenient().when(inventoryClient.deductStock(eq(1L), any())).thenReturn(null);
        org.mockito.Mockito.lenient().doThrow(new RuntimeException("no stock")).when(inventoryClient).deductStock(eq(2L), any());
        // a non-Feign failure is not translated by deductStock(), so it propagates as-is - the give-back must still happen

        assertThrows(RuntimeException.class, () -> service.createBatch(List.of(line(1L, 2), line(2L, 1))));

        verify(inventoryClient).restoreStock(eq(1L), any());
        verify(orderItemRepository, never()).saveAll(any());
        verify(orderService, never()).recalculateTotals(any());
    }

    private feign.FeignException s3Answers(int status) {
        feign.Request request = feign.Request.create(feign.Request.HttpMethod.POST, "/internal/v1/products/2/deduct-stock",
                new java.util.HashMap<>(), null, java.nio.charset.StandardCharsets.UTF_8, new feign.RequestTemplate());
        return feign.FeignException.errorStatus("InventoryClient#deductStock",
                feign.Response.builder().status(status).reason("x").request(request).headers(new java.util.HashMap<>()).build());
    }

    @Test
    void aRealShortageNamesTheProductNotItsInternalId() {
        productsExist(1L, 2L);
        org.mockito.Mockito.lenient().when(inventoryClient.deductStock(eq(1L), any())).thenReturn(null);
        org.mockito.Mockito.lenient().doThrow(s3Answers(422)).when(inventoryClient).deductStock(eq(2L), any());

        InsufficientStockException failure = assertThrows(InsufficientStockException.class,
                () -> service.createBatch(List.of(line(1L, 1), line(2L, 3))));

        assertEquals("Not enough stock of Product 2 for 3 unit(s). Please reduce the quantity or remove it from your cart.", failure.getMessage());
        verify(inventoryClient).restoreStock(eq(1L), any());
    }

    @Test
    void aFailureThatIsNotAStockShortageIsNotReportedAsOne() {
        productsExist(1L, 2L);
        org.mockito.Mockito.lenient().when(inventoryClient.deductStock(eq(1L), any())).thenReturn(null);
        org.mockito.Mockito.lenient().doThrow(s3Answers(503)).when(inventoryClient).deductStock(eq(2L), any());

        InsufficientStockException failure = assertThrows(InsufficientStockException.class,
                () -> service.createBatch(List.of(line(1L, 1), line(2L, 1))));

        assertEquals("Could not reserve Product 2 right now. Please try again in a moment.", failure.getMessage());
    }

    @Test
    void aProductThatNoLongerExistsAsksTheCustomerToRemoveIt() {
        productsExist(1L, 2L);
        org.mockito.Mockito.lenient().when(inventoryClient.deductStock(eq(1L), any())).thenReturn(null);
        org.mockito.Mockito.lenient().doThrow(s3Answers(404)).when(inventoryClient).deductStock(eq(2L), any());

        InsufficientStockException failure = assertThrows(InsufficientStockException.class,
                () -> service.createBatch(List.of(line(1L, 1), line(2L, 1))));

        assertEquals("Product 2 is no longer available. Please remove it from your cart.", failure.getMessage());
    }

    @Test
    void linesOfDifferentOrdersAreRejected() {
        OrderItemDto other = line(2L, 1);
        other.setOrderId(99L);

        assertThrows(IllegalArgumentException.class, () -> service.createBatch(List.of(line(1L, 1), other)));
        verify(inventoryClient, never()).deductStock(anyLong(), any());
    }

    @Test
    void anEmptyBatchIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.createBatch(List.of()));
    }
}
