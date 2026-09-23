package com.cbg.lbos.service;

import com.cbg.lbos.client.CustomerClient;
import com.cbg.lbos.client.InventoryClient;
import com.cbg.lbos.client.NotificationClient;
import com.cbg.lbos.client.dto.CustomerSummary;
import com.cbg.lbos.client.dto.NotificationCreateRequest;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.entity.Trip;
import com.cbg.lbos.repository.OrderItemRepository;
import com.cbg.lbos.repository.OrderRepository;
import com.cbg.lbos.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers the partner-suspension fan-out S2 calls into: cancelling a suspended retailer's or
 * fleet owner's in-flight orders, never charging the customer a cancellation fee for it, and
 * leaving already-terminal orders untouched.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OrderServicePartnerSuspensionTest {

    private static final UUID RETAILER_ID = UUID.randomUUID();
    private static final UUID FLEET_OWNER_ID = UUID.randomUUID();
    private static final UUID CUSTOMER_PROFILE_ID = UUID.randomUUID();

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private OrderItemRepository orderItemRepository;
    @Mock
    private TripRepository tripRepository;
    @Mock
    private InventoryClient inventoryClient;
    @Mock
    private CustomerClient customerClient;
    @Mock
    private NotificationClient notificationClient;

    @InjectMocks
    private OrderService orderService;

    private Order order(Long id, String status) {
        Order order = new Order();
        order.setId(id);
        order.setOrderNumber("ORD-" + id);
        order.setOrderStatus(status);
        order.setCustomerProfileId(CUSTOMER_PROFILE_ID);
        order.setTotalAmount(new BigDecimal("1000.00"));
        return order;
    }

    @Test
    void suspendingARetailerCancelsItsInFlightOrdersWithoutACancellationFee() {
        Order inTransit = order(1L, "IN_TRANSIT");
        Order delivered = order(2L, "DELIVERED");
        when(orderItemRepository.findDistinctOrderIdsByRetailerId(RETAILER_ID)).thenReturn(List.of(1L, 2L));
        when(orderRepository.findAllById(List.of(1L, 2L))).thenReturn(List.of(inTransit, delivered));
        when(orderItemRepository.findByOrder_Id(1L)).thenReturn(List.of());
        when(customerClient.getCustomer(CUSTOMER_PROFILE_ID))
                .thenReturn(new CustomerSummary(CUSTOMER_PROFILE_ID, UUID.randomUUID(), "ACTIVE"));

        List<Long> cancelled = orderService.cancelActiveOrdersForSuspendedRetailer(RETAILER_ID, "Licence revoked");

        assertEquals(List.of(1L), cancelled);
        assertEquals("CANCELLED", inTransit.getOrderStatus());
        assertEquals("Licence revoked", inTransit.getCancellationReason());
        // IN_TRANSIT would normally forfeit half the order value - never when the platform
        // itself suspended the partner.
        assertEquals(0, BigDecimal.ZERO.compareTo(inTransit.getCancellationFeeAmount()));
        assertEquals("DELIVERED", delivered.getOrderStatus());
        verify(orderRepository).save(inTransit);
        verify(orderRepository, never()).save(delivered);
        verify(notificationClient).create(any(NotificationCreateRequest.class));
    }

    @Test
    void suspendingARetailerRecordsADefaultReasonWhenNoneIsSupplied() {
        Order waiting = order(3L, "WAITING_FOR_RETAILER");
        when(orderItemRepository.findDistinctOrderIdsByRetailerId(RETAILER_ID)).thenReturn(List.of(3L));
        when(orderRepository.findAllById(List.of(3L))).thenReturn(List.of(waiting));
        when(orderItemRepository.findByOrder_Id(3L)).thenReturn(List.of());
        when(customerClient.getCustomer(CUSTOMER_PROFILE_ID))
                .thenReturn(new CustomerSummary(CUSTOMER_PROFILE_ID, UUID.randomUUID(), "ACTIVE"));

        orderService.cancelActiveOrdersForSuspendedRetailer(RETAILER_ID, "  ");

        assertEquals("Retailer suspended by Operations Manager", waiting.getCancellationReason());
    }

    @Test
    void suspendingAFleetOwnerCancelsTheOrdersBehindItsTrips() {
        Order assigned = order(4L, "VEHICLE_ASSIGNED");
        Order alreadyCancelled = order(5L, "CANCELLED");
        Trip firstTrip = new Trip();
        firstTrip.setOrder(assigned);
        Trip secondTrip = new Trip();
        secondTrip.setOrder(alreadyCancelled);
        when(tripRepository.findByFleetOwnerId(FLEET_OWNER_ID)).thenReturn(List.of(firstTrip, secondTrip));
        when(orderItemRepository.findByOrder_Id(4L)).thenReturn(List.of());
        when(customerClient.getCustomer(CUSTOMER_PROFILE_ID))
                .thenReturn(new CustomerSummary(CUSTOMER_PROFILE_ID, UUID.randomUUID(), "ACTIVE"));

        List<Long> cancelled = orderService.cancelActiveOrdersForSuspendedFleetOwner(FLEET_OWNER_ID, null);

        assertEquals(List.of(4L), cancelled);
        assertEquals("CANCELLED", assigned.getOrderStatus());
        assertEquals("Fleet owner suspended by Operations Manager", assigned.getCancellationReason());
        assertTrue(assigned.getCancelledDatetime() != null);
        verify(orderRepository, never()).save(alreadyCancelled);
    }
}
