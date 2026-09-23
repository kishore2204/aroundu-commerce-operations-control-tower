package com.cbg.lbos.service;

import com.cbg.lbos.client.InventoryClient;
import com.cbg.lbos.client.ProductClient;
import com.cbg.lbos.client.RetailerClient;
import com.cbg.lbos.client.dto.ApiResponseEnvelope;
import com.cbg.lbos.client.dto.ProductSummary;
import com.cbg.lbos.dto.OrderItemDto;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.entity.OrderItem;
import com.cbg.lbos.exception.InsufficientStockException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.repository.OrderItemRepository;
import com.cbg.lbos.repository.OrderRepository;
import feign.FeignException;
import feign.Request;
import feign.RequestTemplate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderItemServiceTest {

    private static final Long ORDER_ID = 10L;
    private static final Long PRODUCT_ID = 55L;
    private static final UUID RETAILER_ID = UUID.randomUUID();

    @Mock
    private OrderItemRepository orderItemRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private ProductClient productClient;

    /*
     * OrderItemService.toDto() enriches every line item with its retailer from S2
     * (fetchRetailerSummaryQuietly) - without this mock @InjectMocks passes null for the
     * constructor's RetailerClient argument and every read path NPEs.
     */
    @Mock
    private RetailerClient retailerClient;

    @Mock
    private InventoryClient inventoryClient;

    @Mock
    private OrderService orderService;

    @InjectMocks
    private OrderItemService orderItemService;

    private Order existingOrder() {
        Order order = new Order();
        order.setId(ORDER_ID);
        // NEW is an editable status - requireEditableOrder() rejects create/update/delete once
        // the order has moved past NEW/BOOKING_CONFIRMED (see OrderItemService).
        order.setOrderStatus("NEW");
        return order;
    }

    private OrderItemDto validDto() {
        OrderItemDto dto = new OrderItemDto();
        dto.setOrderId(ORDER_ID);
        dto.setRetailerId(RETAILER_ID);
        dto.setProductId(PRODUCT_ID);
        dto.setSkuSnapshot("CLIENT-SUPPLIED-SKU");
        dto.setProductNameSnapshot("Client supplied name");
        dto.setQuantity(3);
        dto.setUnitPrice(new BigDecimal("120.00"));
        dto.setDiscountAmount(new BigDecimal("20.00"));
        dto.setLineTotal(new BigDecimal("340.00"));
        return dto;
    }

    private ProductSummary product() {
        return new ProductSummary(
                PRODUCT_ID,
                "Basmati Rice 5kg",
                "SKU-RICE-5KG",
                4L,
                "Groceries",
                RETAILER_ID,
                new BigDecimal("450.00"),
                80,
                "ACTIVE",
                "IN_STOCK",
                "Premium long grain rice");
    }

    private ApiResponseEnvelope<ProductSummary> envelope(ProductSummary payload) {
        return new ApiResponseEnvelope<>(
                OffsetDateTime.now(), "corr-1", "OK", payload);
    }

    private FeignException notFound() {
        Request request = Request.create(
                Request.HttpMethod.GET,
                "/api/v1/products/" + PRODUCT_ID,
                new HashMap<>(),
                null,
                StandardCharsets.UTF_8,
                new RequestTemplate());
        return FeignException.errorStatus(
                "ProductClient#getProduct(Long)",
                feign.Response.builder()
                        .status(404)
                        .reason("Not Found")
                        .request(request)
                        .headers(new HashMap<>())
                        .build());
    }

    @Test
    void createSnapshotsSkuAndNameFromTheProductServiceNotFromTheRequest() {
        when(orderRepository.findById(ORDER_ID))
                .thenReturn(Optional.of(existingOrder()));
        when(productClient.getProduct(PRODUCT_ID)).thenReturn(envelope(product()));
        when(orderItemRepository.save(any(OrderItem.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        OrderItemDto result = orderItemService.create(validDto());

        assertEquals("SKU-RICE-5KG", result.getSkuSnapshot());
        assertEquals("Basmati Rice 5kg", result.getProductNameSnapshot());
        assertEquals(RETAILER_ID, result.getRetailerId());
        assertEquals(PRODUCT_ID, result.getProductId());
        assertEquals(ORDER_ID, result.getOrderId());
    }

    @Test
    void createIgnoresAClientSuppliedUnitPriceAndAlwaysUsesTheCatalogPrice() {
        when(orderRepository.findById(ORDER_ID))
                .thenReturn(Optional.of(existingOrder()));
        when(productClient.getProduct(PRODUCT_ID)).thenReturn(envelope(product()));
        when(orderItemRepository.save(any(OrderItem.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // validDto() supplies unitPrice=120.00; the catalog price is 450.00.
        OrderItemDto result = orderItemService.create(validDto());

        assertEquals(new BigDecimal("450.00"), result.getUnitPrice());
    }

    @Test
    void createComputesLineTotalFromCatalogPriceQuantityAndDiscountRegardlessOfClientInput() {
        when(orderRepository.findById(ORDER_ID))
                .thenReturn(Optional.of(existingOrder()));
        when(productClient.getProduct(PRODUCT_ID)).thenReturn(envelope(product()));
        when(orderItemRepository.save(any(OrderItem.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // quantity=3, catalog price=450.00, discount=20.00 -> 1350.00 - 20.00 = 1330.00,
        // not the client-supplied lineTotal of 340.00 from validDto().
        OrderItemDto result = orderItemService.create(validDto());

        assertEquals(new BigDecimal("1330.00"), result.getLineTotal());
    }

    @Test
    void createRejectsADiscountThatExceedsTheLinesGrossTotal() {
        when(orderRepository.findById(ORDER_ID))
                .thenReturn(Optional.of(existingOrder()));
        when(productClient.getProduct(PRODUCT_ID)).thenReturn(envelope(product()));

        OrderItemDto dto = validDto();
        dto.setDiscountAmount(new BigDecimal("2000.00"));

        assertThrows(IllegalArgumentException.class, () -> orderItemService.create(dto));

        verify(orderItemRepository, never()).save(any(OrderItem.class));
    }

    @Test
    void createThrowsWhenTheLocalOrderDoesNotExist() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.empty());

        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> orderItemService.create(validDto()));

        assertEquals("Order not found with ID: 10", exception.getMessage());
        verify(orderItemRepository, never()).save(any(OrderItem.class));
    }

    @Test
    void createTranslatesAProductServiceNotFoundIntoResourceNotFound() {
        when(orderRepository.findById(ORDER_ID))
                .thenReturn(Optional.of(existingOrder()));
        when(productClient.getProduct(PRODUCT_ID)).thenThrow(notFound());

        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> orderItemService.create(validDto()));

        assertEquals("Product not found with ID: 55", exception.getMessage());
        verify(orderItemRepository, never()).save(any(OrderItem.class));
    }

    @Test
    void createTreatsAnEmptyEnvelopePayloadAsProductNotFound() {
        when(orderRepository.findById(ORDER_ID))
                .thenReturn(Optional.of(existingOrder()));
        when(productClient.getProduct(PRODUCT_ID)).thenReturn(envelope(null));

        assertThrows(ResourceNotFoundException.class,
                () -> orderItemService.create(validDto()));
    }

    @Test
    void updateReSnapshotsTheProductData() {
        OrderItem existing = new OrderItem();
        existing.setId(9L);
        existing.setOrder(existingOrder());
        existing.setSkuSnapshot("STALE-SKU");
        existing.setProductNameSnapshot("Stale name");
        /*
         * A persisted line item always has a product and a quantity, and update() diffs the
         * stored pair against the incoming one (adjustStockForQuantityChange). Same product and
         * same quantity as validDto() keeps this focused on the re-snapshot, with no stock delta.
         */
        existing.setProductId(PRODUCT_ID);
        existing.setQuantity(3);

        when(orderItemRepository.findById(9L)).thenReturn(Optional.of(existing));
        when(orderRepository.findById(ORDER_ID))
                .thenReturn(Optional.of(existingOrder()));
        when(productClient.getProduct(PRODUCT_ID)).thenReturn(envelope(product()));
        when(orderItemRepository.save(any(OrderItem.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        OrderItemDto result = orderItemService.update(9L, validDto());

        assertEquals("SKU-RICE-5KG", result.getSkuSnapshot());
        assertEquals("Basmati Rice 5kg", result.getProductNameSnapshot());
    }

    @Test
    void getByIdThrowsWhenTheItemIsMissing() {
        when(orderItemRepository.findById(404L)).thenReturn(Optional.empty());

        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> orderItemService.getById(404L));

        assertEquals("Order item not found with ID: 404", exception.getMessage());
    }

    @Test
    void deleteRemovesAnExistingItem() {
        OrderItem item = new OrderItem();
        item.setId(2L);
        item.setOrder(existingOrder());
        when(orderItemRepository.findById(2L)).thenReturn(Optional.of(item));

        orderItemService.delete(2L);

        verify(orderItemRepository).delete(item);
        verify(orderService).recalculateTotals(ORDER_ID);
    }

    @Test
    void createTriggersAnOrderTotalsRecalculation() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(existingOrder()));
        when(productClient.getProduct(PRODUCT_ID)).thenReturn(envelope(product()));
        when(orderItemRepository.save(any(OrderItem.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        orderItemService.create(validDto());

        verify(orderService).recalculateTotals(ORDER_ID);
    }

    @Test
    void createDeductsStockInS3ForTheOrderedQuantity() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(existingOrder()));
        when(productClient.getProduct(PRODUCT_ID)).thenReturn(envelope(product()));
        when(orderItemRepository.save(any(OrderItem.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        orderItemService.create(validDto());

        verify(inventoryClient).deductStock(
                eq(PRODUCT_ID), eq(new InventoryClient.StockMutationRequest(3)));
    }

    @Test
    void createTranslatesAnS3StockRejectionIntoInsufficientStockException() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(existingOrder()));
        when(productClient.getProduct(PRODUCT_ID)).thenReturn(envelope(product()));
        when(inventoryClient.deductStock(eq(PRODUCT_ID), any())).thenThrow(notFound());

        assertThrows(InsufficientStockException.class, () -> orderItemService.create(validDto()));

        verify(orderItemRepository, never()).save(any(OrderItem.class));
    }

    @Test
    void createRejectsAnItemOnAnOrderThatIsNoLongerEditable() {
        Order shipped = existingOrder();
        shipped.setOrderStatus("IN_TRANSIT");
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(shipped));

        assertThrows(IllegalArgumentException.class, () -> orderItemService.create(validDto()));

        verify(orderItemRepository, never()).save(any(OrderItem.class));
    }

    @Test
    void deleteRejectsAnItemOnAnOrderThatIsNoLongerEditable() {
        Order delivered = existingOrder();
        delivered.setOrderStatus("DELIVERED");
        OrderItem item = new OrderItem();
        item.setId(2L);
        item.setOrder(delivered);
        when(orderItemRepository.findById(2L)).thenReturn(Optional.of(item));

        assertThrows(IllegalArgumentException.class, () -> orderItemService.delete(2L));

        verify(orderItemRepository, never()).delete(any(OrderItem.class));
    }

    // ---- the order list reads the lines of many orders at once

    private OrderItem lineOf(Order order, long id, String name) {
        OrderItem item = new OrderItem();
        item.setId(id);
        item.setOrder(order);
        item.setProductId(PRODUCT_ID);
        item.setRetailerId(RETAILER_ID);
        item.setProductNameSnapshot(name);
        item.setQuantity(2);
        return item;
    }

    @Test
    void theLinesOfSeveralOrdersAreReadInOneQueryWithoutCallingOtherServices() {
        Order first = existingOrder();
        Order second = new Order();
        second.setId(ORDER_ID + 1);
        when(orderItemRepository.findByOrder_IdIn(java.util.List.of(ORDER_ID, ORDER_ID + 1)))
                .thenReturn(java.util.List.of(lineOf(first, 1L, "Tomatoes"), lineOf(second, 2L, "Milk")));

        java.util.List<OrderItemDto> result = orderItemService.getByOrderIds(java.util.List.of(ORDER_ID, ORDER_ID + 1));

        assertEquals(2, result.size());
        assertEquals(ORDER_ID, result.get(0).getOrderId());
        assertEquals("Tomatoes", result.get(0).getProductNameSnapshot());
        assertEquals(ORDER_ID + 1, result.get(1).getOrderId());
        verify(orderItemRepository, org.mockito.Mockito.times(1)).findByOrder_IdIn(any());
        org.mockito.Mockito.verifyNoInteractions(productClient, retailerClient);
    }

    @Test
    void noOrderIdsMeansNoQuery() {
        assertEquals(0, orderItemService.getByOrderIds(java.util.List.of()).size());
        assertEquals(0, orderItemService.getByOrderIds(null).size());
        verify(orderItemRepository, never()).findByOrder_IdIn(any());
    }
}
