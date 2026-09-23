package com.cbg.lbos.service;

import com.cbg.lbos.client.InventoryClient;
import com.cbg.lbos.dto.OrderDto;
import com.cbg.lbos.dto.OrderTrackingDto;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.entity.OrderItem;
import com.cbg.lbos.exception.DuplicateResourceException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.repository.OrderItemRepository;
import com.cbg.lbos.repository.OrderRepository;
import com.cbg.lbos.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    private static final UUID CUSTOMER_PROFILE_ID = UUID.randomUUID();

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private OrderItemRepository orderItemRepository;
    /*
     * The order's Trip drives both the cancellation fee and the tracking view's SLA status
     * (computeSlaStatus) - without this mock @InjectMocks passes null for the constructor's
     * TripRepository argument and getTracking() NPEs.
     */
    @Mock
    private TripRepository tripRepository;
    @Mock
    private InventoryClient inventoryClient;

    @InjectMocks
    private OrderService orderService;

    private OrderDto validDto() {
        OrderDto dto = new OrderDto();
        dto.setOrderNumber("ORD-1001");
        dto.setCustomerProfileId(CUSTOMER_PROFILE_ID);
        dto.setOrderType("RETAIL");
        dto.setSubtotalAmount(new BigDecimal("500.00"));
        dto.setDeliveryCharge(new BigDecimal("50.00"));
        dto.setDiscountAmount(new BigDecimal("25.00"));
        dto.setTotalAmount(new BigDecimal("525.00"));
        dto.setOrderStatus("NEW");
        dto.setStatusHistoryJson("[]");
        dto.setOrderTrackingJson("[]");
        dto.setPaymentMethod("UPI");
        dto.setPaymentStatus("PENDING");
        return dto;
    }

    @Test
    void createStoresCustomerProfileIdAsScalarWithoutAnyCrossServiceJoin() {
        when(orderRepository.existsByOrderNumber("ORD-1001")).thenReturn(false);
        when(orderRepository.save(any(Order.class)))
                .thenAnswer(invocation -> {
                    Order saved = invocation.getArgument(0);
                    saved.setId(7L);
                    return saved;
                });

        OrderDto result = orderService.create(validDto());

        assertEquals(Long.valueOf(7L), result.getId());
        assertEquals(CUSTOMER_PROFILE_ID, result.getCustomerProfileId());
        assertEquals("ORD-1001", result.getOrderNumber());
        assertEquals(new BigDecimal("525.00"), result.getTotalAmount());
    }

    @Test
    void createDefaultsOrderDateWhenTheRequestOmitsIt() {
        when(orderRepository.existsByOrderNumber(anyString())).thenReturn(false);
        when(orderRepository.save(any(Order.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        OrderDto dto = validDto();
        dto.setOrderDate(null);

        OrderDto result = orderService.create(dto);

        assertNotNull(result.getOrderDate());
        assertNotNull(result.getUpdatedDatetime());
    }

    @Test
    void createKeepsAnExplicitlySuppliedOrderDate() {
        LocalDateTime orderDate = LocalDateTime.of(2026, 1, 15, 10, 30);
        when(orderRepository.existsByOrderNumber(anyString())).thenReturn(false);
        when(orderRepository.save(any(Order.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        OrderDto dto = validDto();
        dto.setOrderDate(orderDate);

        assertEquals(orderDate, orderService.create(dto).getOrderDate());
    }

    @Test
    void createRejectsADuplicateOrderNumber() {
        when(orderRepository.existsByOrderNumber("ORD-1001")).thenReturn(true);

        DuplicateResourceException exception = assertThrows(
                DuplicateResourceException.class,
                () -> orderService.create(validDto()));

        assertEquals("Order number already exists: ORD-1001", exception.getMessage());
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void getByIdThrowsWhenTheOrderIsMissing() {
        when(orderRepository.findById(99L)).thenReturn(Optional.empty());

        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> orderService.getById(99L));

        assertEquals("Order not found with ID: 99", exception.getMessage());
    }

    @Test
    void getByIdMapsTheStoredScalarCustomerProfileIdOntoTheDto() {
        Order order = new Order();
        order.setId(3L);
        order.setOrderNumber("ORD-3");
        order.setCustomerProfileId(CUSTOMER_PROFILE_ID);
        when(orderRepository.findById(3L)).thenReturn(Optional.of(order));

        assertEquals(CUSTOMER_PROFILE_ID, orderService.getById(3L).getCustomerProfileId());
    }

    @Test
    void updateOverwritesTheOrderAndRefreshesUpdatedDatetime() {
        Order existing = new Order();
        existing.setId(5L);
        existing.setOrderNumber("OLD");
        existing.setCustomerProfileId(UUID.randomUUID());
        // A stored order always has a status, and update() validates the requested transition
        // against it. NEW -> NEW (validDto()'s status) is the no-op case, so this test stays
        // about the field overwrite rather than the status machine.
        existing.setOrderStatus("NEW");
        when(orderRepository.findById(5L)).thenReturn(Optional.of(existing));
        when(orderRepository.save(any(Order.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        OrderDto result = orderService.update(5L, validDto());

        assertEquals("ORD-1001", result.getOrderNumber());
        assertEquals(CUSTOMER_PROFILE_ID, result.getCustomerProfileId());
        assertNotNull(result.getUpdatedDatetime());
    }

    @Test
    void updateThrowsWhenTheOrderIsMissing() {
        when(orderRepository.findById(404L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> orderService.update(404L, validDto()));
    }

    @Test
    void deleteRemovesAnExistingOrder() {
        Order order = new Order();
        order.setId(8L);
        when(orderRepository.findById(8L)).thenReturn(Optional.of(order));

        orderService.delete(8L);

        verify(orderRepository).delete(order);
    }

    @Test
    void deleteThrowsWhenTheOrderIsMissing() {
        when(orderRepository.findById(8L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> orderService.delete(8L));
        verify(orderRepository, never()).delete(any(Order.class));
    }

    // ---------- TRACKING-ONLY VIEW ----------

    @Test
    void getTrackingReturnsOnlyTheTrackingFieldsOfTheOrder() {
        LocalDateTime updatedAt = LocalDateTime.of(2026, 3, 2, 9, 15);
        Order order = new Order();
        order.setId(11L);
        order.setOrderNumber("ORD-1101");
        order.setOrderStatus("IN_TRANSIT");
        order.setOrderTrackingJson("[{\"stage\":\"PICKED_UP\"}]");
        order.setUpdatedDatetime(updatedAt);
        order.setCustomerProfileId(CUSTOMER_PROFILE_ID);
        when(orderRepository.findById(11L)).thenReturn(Optional.of(order));

        OrderTrackingDto result = orderService.getTracking(11L);

        assertEquals(Long.valueOf(11L), result.orderId());
        assertEquals("ORD-1101", result.orderNumber());
        assertEquals("IN_TRANSIT", result.orderStatus());
        assertEquals("[{\"stage\":\"PICKED_UP\"}]", result.orderTrackingJson());
        assertEquals(updatedAt, result.updatedDatetime());
    }

    @Test
    void getTrackingThrowsWhenTheOrderIsMissing() {
        when(orderRepository.findById(404L)).thenReturn(Optional.empty());

        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> orderService.getTracking(404L));

        assertEquals("Order not found with ID: 404", exception.getMessage());
    }

    @Test
    void recalculateTotalsSumsLineItemsAndAddsDeliveryChargeMinusDiscount() {
        Order order = new Order();
        order.setId(5L);
        order.setDeliveryCharge(new BigDecimal("50.00"));
        order.setDiscountAmount(new BigDecimal("25.00"));
        when(orderRepository.findById(5L)).thenReturn(Optional.of(order));
        OrderItem item1 = new OrderItem();
        item1.setLineTotal(new BigDecimal("300.00"));
        OrderItem item2 = new OrderItem();
        item2.setLineTotal(new BigDecimal("200.00"));
        when(orderItemRepository.findByOrder_Id(5L)).thenReturn(List.of(item1, item2));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        orderService.recalculateTotals(5L);

        assertEquals(new BigDecimal("500.00"), order.getSubtotalAmount());
        assertEquals(new BigDecimal("525.00"), order.getTotalAmount());
        verify(orderRepository).save(order);
    }

    @Test
    void recalculateTotalsTreatsAnOrderWithNoItemsAsZeroSubtotal() {
        Order order = new Order();
        order.setId(6L);
        when(orderRepository.findById(6L)).thenReturn(Optional.of(order));
        when(orderItemRepository.findByOrder_Id(6L)).thenReturn(List.of());
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        orderService.recalculateTotals(6L);

        assertEquals(0, order.getSubtotalAmount().compareTo(BigDecimal.ZERO));
        assertEquals(0, order.getTotalAmount().compareTo(BigDecimal.ZERO));
    }

    @Test
    void getAllMapsEveryOrder() {
        Order first = new Order();
        first.setId(1L);
        first.setCustomerProfileId(CUSTOMER_PROFILE_ID);
        Order second = new Order();
        second.setId(2L);
        second.setCustomerProfileId(CUSTOMER_PROFILE_ID);
        when(orderRepository.findAll()).thenReturn(List.of(first, second));

        List<OrderDto> result = orderService.getAll();

        assertEquals(2, result.size());
        assertEquals(Long.valueOf(1L), result.get(0).getId());
        assertEquals(Long.valueOf(2L), result.get(1).getId());
    }
}
