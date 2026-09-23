package com.cbg.lbos.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import com.cbg.lbos.client.CustomerClient;
import com.cbg.lbos.client.DriverClient;
import com.cbg.lbos.client.FleetOwnerClient;
import com.cbg.lbos.client.InventoryClient;
import com.cbg.lbos.client.NotificationClient;
import com.cbg.lbos.client.RetailerClient;
import com.cbg.lbos.client.VehicleClient;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.repository.LogisticsBookingDetailRepository;
import com.cbg.lbos.repository.OrderItemRepository;
import com.cbg.lbos.repository.OrderRepository;
import com.cbg.lbos.repository.TripRepository;

/** A customer's order history is read one page (newest first) at a time for the lazy-loading "View all orders" list. */
@ExtendWith(MockitoExtension.class)
class OrderServiceMinePagedTest {
    @Mock private OrderRepository orderRepository;
    @Mock private OrderItemRepository orderItemRepository;
    @Mock private TripRepository tripRepository;
    @Mock private LogisticsBookingDetailRepository logisticsBookingDetailRepository;
    @Mock private InventoryClient inventoryClient;
    @Mock private RetailerClient retailerClient;
    @Mock private CustomerClient customerClient;
    @Mock private NotificationClient notificationClient;
    @Mock private VehicleClient vehicleClient;
    @Mock private DriverClient driverClient;
    @Mock private FleetOwnerClient fleetOwnerClient;
    @Mock private OrderWeightService orderWeightService;
    @InjectMocks private OrderService service;

    @Test
    void onePageOfTheCustomersOwnOrdersIsReadNewestFirst() {
        UUID customer = UUID.randomUUID();
        Pageable page = PageRequest.of(1, 10);
        Order order = new Order();
        order.setId(7L);
        order.setCustomerProfileId(customer);
        when(orderRepository.findByCustomerProfileIdOrderByOrderDateDesc(customer, page))
                .thenReturn(new PageImpl<>(List.of(order), page, 11));

        var result = service.getMineForCustomerPaged(customer, page);

        assertEquals(11, result.getTotalElements());
        assertEquals(2, result.getTotalPages());
        assertEquals(7L, result.getContent().get(0).getId());
        verify(orderRepository, never()).findByCustomerProfileId(customer);
    }
}
