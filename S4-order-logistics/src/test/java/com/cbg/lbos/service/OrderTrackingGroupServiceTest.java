package com.cbg.lbos.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.cbg.lbos.client.DriverClient;
import com.cbg.lbos.client.FleetOwnerClient;
import com.cbg.lbos.client.RetailerClient;
import com.cbg.lbos.client.UserAccountClient;
import com.cbg.lbos.client.VehicleClient;
import com.cbg.lbos.client.dto.DriverSummary;
import com.cbg.lbos.client.dto.FleetOwnerSummary;
import com.cbg.lbos.client.dto.RetailerSummary;
import com.cbg.lbos.client.dto.UserContactSummary;
import com.cbg.lbos.client.dto.VehicleSummary;
import com.cbg.lbos.dto.OrderTrackingDto;
import com.cbg.lbos.dto.OrderTrackingGroupDto;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.entity.OrderItem;
import com.cbg.lbos.entity.Trip;
import com.cbg.lbos.repository.OrderItemRepository;
import com.cbg.lbos.repository.OrderRepository;
import com.cbg.lbos.repository.TripRepository;

@ExtendWith(MockitoExtension.class)
class OrderTrackingGroupServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private OrderItemRepository orderItemRepository;
    @Mock private TripRepository tripRepository;
    @Mock private OrderService orderService;
    @Mock private RetailerClient retailerClient;
    @Mock private DriverClient driverClient;
    @Mock private VehicleClient vehicleClient;
    @Mock private FleetOwnerClient fleetOwnerClient;
    @Mock private UserAccountClient userAccountClient;

    private OrderTrackingGroupService service;
    private final UUID customer = UUID.randomUUID();
    // 30 s of margin: the sibling orders are dated a few ms AFTER this, so without it a fast run could floor to 24 minutes
    private final LocalDateTime placedAt = LocalDateTime.now().minusMinutes(25).minusSeconds(30);

    @BeforeEach
    void setUp() {
        service = new OrderTrackingGroupService(orderRepository, orderItemRepository, tripRepository, orderService,
                retailerClient, driverClient, vehicleClient, fleetOwnerClient, userAccountClient);
    }

    private Order order(long id, String status, String address) {
        Order order = new Order();
        order.setId(id);
        order.setOrderNumber("ORD-1-" + id);
        order.setCustomerProfileId(customer);
        order.setOrderType("RETAIL");
        order.setOrderDate(placedAt.plusNanos(id * 1_000_000));
        order.setOrderStatus(status);
        order.setDeliveryAddress(address);
        order.setPaymentMethod("COD");
        return order;
    }

    private OrderTrackingDto tracking(Order order, String haltedState) {
        return new OrderTrackingDto(order.getId(), order.getOrderNumber(), order.getOrderStatus(), "{}",
                LocalDateTime.now(), "PENDING", "Stage of " + order.getId(), null, haltedState);
    }

    private void shop(Order order, String businessName) {
        UUID retailerId = UUID.randomUUID();
        OrderItem item = new OrderItem();
        item.setRetailerId(retailerId);
        when(orderItemRepository.findByOrder_Id(order.getId())).thenReturn(List.of(item));
        when(retailerClient.getRetailer(retailerId))
                .thenReturn(new RetailerSummary(retailerId, UUID.randomUUID(), businessName, UUID.randomUUID()));
    }

    @Test
    void ordersFromTheSameCheckoutAreReturnedTogetherEachWithItsOwnStatusAndShopName() {
        Order s1 = order(101, "IN_TRANSIT", "12 Main St");
        Order s2 = order(102, "VEHICLE_ASSIGNED", "12 Main St");
        when(orderRepository.findById(102L)).thenReturn(Optional.of(s2));
        when(orderRepository.findByCustomerProfileIdAndOrderTypeAndOrderDateBetweenOrderByIdAsc(any(), any(), any(), any()))
                .thenReturn(List.of(s1, s2));
        when(orderService.getTracking(101L)).thenReturn(tracking(s1, null));
        when(orderService.getTracking(102L)).thenReturn(tracking(s2, null));
        when(tripRepository.findByOrder_Id(anyLong())).thenReturn(Optional.empty());
        shop(s1, "Fresh Mart");
        shop(s2, "Green Grocery");

        OrderTrackingGroupDto group = service.getGroup(102L);

        assertEquals(2, group.shops().size());
        assertEquals("Fresh Mart", group.shops().get(0).shopName());
        assertEquals("IN_TRANSIT", group.shops().get(0).tracking().orderStatus());
        assertEquals("Green Grocery", group.shops().get(1).shopName());
        assertEquals("VEHICLE_ASSIGNED", group.shops().get(1).tracking().orderStatus());
    }

    @Test
    void anOrderToADifferentAddressIsNotGrouped() {
        Order mine = order(101, "NEW", "12 Main St");
        Order other = order(102, "NEW", "99 Other Rd");
        when(orderRepository.findById(101L)).thenReturn(Optional.of(mine));
        when(orderRepository.findByCustomerProfileIdAndOrderTypeAndOrderDateBetweenOrderByIdAsc(any(), any(), any(), any()))
                .thenReturn(List.of(mine, other));
        when(orderService.getTracking(101L)).thenReturn(tracking(mine, null));
        when(tripRepository.findByOrder_Id(101L)).thenReturn(Optional.empty());
        shop(mine, "Fresh Mart");

        assertEquals(1, service.getGroup(101L).shops().size());
    }

    @Test
    void driverDetailsAppearOnlyOnceATripExistsAndNeverExposeIds() {
        Order assigned = order(101, "VEHICLE_ASSIGNED", "12 Main St");
        Order waiting = order(102, "FINDING_DELIVERY_PARTNER", "12 Main St");
        when(orderRepository.findById(101L)).thenReturn(Optional.of(assigned));
        when(orderRepository.findByCustomerProfileIdAndOrderTypeAndOrderDateBetweenOrderByIdAsc(any(), any(), any(), any()))
                .thenReturn(List.of(assigned, waiting));
        when(orderService.getTracking(101L)).thenReturn(tracking(assigned, null));
        when(orderService.getTracking(102L)).thenReturn(tracking(waiting, null));
        shop(assigned, "Fresh Mart");
        shop(waiting, "Green Grocery");

        Trip trip = new Trip();
        trip.setId(UUID.randomUUID());
        trip.setDriverId(UUID.randomUUID());
        trip.setVehicleId(UUID.randomUUID());
        trip.setFleetOwnerId(UUID.randomUUID());
        when(tripRepository.findByOrder_Id(101L)).thenReturn(Optional.of(trip));
        when(tripRepository.findByOrder_Id(102L)).thenReturn(Optional.empty());
        UUID driverAccount = UUID.randomUUID();
        when(driverClient.getDriver(trip.getDriverId())).thenReturn(new DriverSummary(
                trip.getDriverId(), trip.getFleetOwnerId(), driverAccount, null, null, "DL1", null, "ACTIVE", null));
        when(userAccountClient.getUserContact(driverAccount))
                .thenReturn(new UserContactSummary(driverAccount, "Ravi", "Kumar", "9876543210"));
        when(vehicleClient.getVehicle(trip.getVehicleId())).thenReturn(new VehicleSummary(
                trip.getVehicleId(), trip.getFleetOwnerId(), null, "KA-01-AB-1234", "BIKE", null, null, null, null, "ACTIVE"));
        when(fleetOwnerClient.getFleetOwner(trip.getFleetOwnerId())).thenReturn(new FleetOwnerSummary(
                trip.getFleetOwnerId(), UUID.randomUUID(), "Swift Fleet", "VERIFIED", "ACTIVE", "VERIFIED"));

        OrderTrackingGroupDto group = service.getGroup(101L);

        var delivery = group.shops().get(0).delivery();
        assertNotNull(delivery);
        assertEquals("Swift Fleet", delivery.fleetOwnerBusinessName());
        assertEquals("Ravi Kumar", delivery.driverName());
        assertEquals("KA-01-AB-1234", delivery.vehicleNumber());
        assertEquals("9876543210", delivery.phoneNumber());
        assertNull(group.shops().get(1).delivery(), "no driver details before a driver is assigned");
    }

    @Test
    void etaCountsDownFromTheRetailEstimateAndDisappearsWhenDeliveredOrHalted() {
        Order inProgress = order(101, "IN_TRANSIT", "12 Main St");
        when(orderRepository.findById(101L)).thenReturn(Optional.of(inProgress));
        when(orderRepository.findByCustomerProfileIdAndOrderTypeAndOrderDateBetweenOrderByIdAsc(any(), any(), any(), any()))
                .thenReturn(List.of(inProgress));
        when(orderService.getTracking(101L)).thenReturn(tracking(inProgress, null));
        when(tripRepository.findByOrder_Id(101L)).thenReturn(Optional.empty());
        shop(inProgress, "Fresh Mart");

        assertEquals("Within 35 minutes", service.getGroup(101L).shops().get(0).etaText());

        inProgress.setOrderStatus("DELIVERED");
        assertNull(service.getGroup(101L).shops().get(0).etaText());
    }
}
