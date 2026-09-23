package com.cbg.lbos.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;
import java.util.List;
import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.cbg.lbos.dto.ReviewEligibilityResponse;
import com.cbg.lbos.dto.client.ServiceabilityRequest;
import com.cbg.lbos.dto.client.ServiceabilityResponse;
import com.cbg.lbos.client.ProductClient;
import com.cbg.lbos.client.dto.ApiResponseEnvelope;
import com.cbg.lbos.client.dto.ProductSummary;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.entity.OrderItem;
import com.cbg.lbos.entity.Trip;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.repository.OrderItemRepository;
import com.cbg.lbos.repository.OrderRepository;
import com.cbg.lbos.repository.TripRepository;

@ExtendWith(MockitoExtension.class)
class InternalOrderLogisticsControllerTest {

    private static final Long ORDER_ID = 42L;
    private static final Long PRODUCT_ID = 7L;
    private static final UUID CUSTOMER_PROFILE_ID = UUID.randomUUID();

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private OrderItemRepository orderItemRepository;
    @Mock
    private TripRepository tripRepository;
    @Mock
    private ProductClient productClient;

    @InjectMocks
    private InternalOrderLogisticsController internalOrderLogisticsController;

    private Order order(String status, UUID customerProfileId) {
        Order order = new Order();
        order.setId(ORDER_ID);
        order.setOrderStatus(status);
        order.setCustomerProfileId(customerProfileId);
        return order;
    }


    @Test
    void serviceabilityReturnsRetailDeliveryChargeWhenProductsAreActiveAndInStock() {
        Long productId = 9L;
        UUID addressId = UUID.randomUUID();
        UUID cityId = UUID.randomUUID();
        UUID zoneId = UUID.randomUUID();

        ProductSummary product = new ProductSummary(
                productId, "Cement Bag", "CEM-001", 1L, "Building",
                UUID.randomUUID(), new BigDecimal("450.00"), 20,
                "ACTIVE", "IN_STOCK", "Demo product");

        when(productClient.getProductsByIds(List.of(productId)))
                .thenReturn(new ApiResponseEnvelope<>(null, "test", "Products found", List.of(product)));

        ServiceabilityResponse response = internalOrderLogisticsController.serviceability(
                new ServiceabilityRequest(
                        CUSTOMER_PROFILE_ID, addressId, cityId, zoneId, List.of(productId)))
                .getBody();

        assertTrue(response.serviceable());
        assertEquals(new BigDecimal("49.00"), response.deliveryCharge());
        assertEquals("30-60 minutes", response.estimate());
    }

    /**
     * A multi-line cart must still cost exactly ONE productClient call, not one per line - the
     * exact N-sequential-Feign-calls pattern a live network trace measured as the dominant cost
     * of /checkout/prepare (~340ms for just 2 lines) before getProductsByIds() existed.
     */
    @Test
    void multipleLinesStillCostOneProductLookupCall() {
        Long productId1 = 9L;
        Long productId2 = 10L;
        ProductSummary product1 = new ProductSummary(
                productId1, "Cement Bag", "CEM-001", 1L, "Building",
                UUID.randomUUID(), new BigDecimal("450.00"), 20, "ACTIVE", "IN_STOCK", "Demo product");
        ProductSummary product2 = new ProductSummary(
                productId2, "Sand Bag", "SAND-001", 1L, "Building",
                UUID.randomUUID(), new BigDecimal("120.00"), 5, "ACTIVE", "IN_STOCK", "Demo product");

        when(productClient.getProductsByIds(List.of(productId1, productId2)))
                .thenReturn(new ApiResponseEnvelope<>(null, "test", "Products found", List.of(product1, product2)));

        ServiceabilityResponse response = internalOrderLogisticsController.serviceability(
                new ServiceabilityRequest(
                        CUSTOMER_PROFILE_ID, UUID.randomUUID(), UUID.randomUUID(),
                        UUID.randomUUID(), List.of(productId1, productId2)))
                .getBody();

        assertTrue(response.serviceable());
        assertEquals(2, response.lines().size());
        verify(productClient, times(1)).getProductsByIds(List.of(productId1, productId2));
        verify(productClient, never()).getProduct(org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void serviceabilityRejectsOutOfStockProduct() {
        Long productId = 9L;
        ProductSummary product = new ProductSummary(
                productId, "Cement Bag", "CEM-001", 1L, "Building",
                UUID.randomUUID(), new BigDecimal("450.00"), 0,
                "ACTIVE", "OUT_OF_STOCK", "Demo product");

        when(productClient.getProductsByIds(List.of(productId)))
                .thenReturn(new ApiResponseEnvelope<>(null, "test", "Products found", List.of(product)));

        ServiceabilityResponse response = internalOrderLogisticsController.serviceability(
                new ServiceabilityRequest(
                        CUSTOMER_PROFILE_ID, UUID.randomUUID(), UUID.randomUUID(),
                        UUID.randomUUID(), List.of(productId)))
                .getBody();

        assertFalse(response.serviceable());
        assertEquals("PRODUCT_OUT_OF_STOCK", response.reasonCode());
    }

    @Test
    void eligibleWhenOrderDeliveredOwnedByCallerAndContainsProduct() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order("DELIVERED", CUSTOMER_PROFILE_ID)));
        when(orderItemRepository.existsByOrder_IdAndProductId(ORDER_ID, PRODUCT_ID)).thenReturn(true);

        ReviewEligibilityResponse response = internalOrderLogisticsController
                .reviewEligibility(ORDER_ID, CUSTOMER_PROFILE_ID, PRODUCT_ID).getBody();

        assertTrue(response.eligible());
        assertEquals(ORDER_ID, response.orderId());
        assertEquals(PRODUCT_ID, response.productId());
    }

    @Test
    void ineligibleWhenCallerDoesNotOwnOrder() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order("DELIVERED", UUID.randomUUID())));

        ReviewEligibilityResponse response = internalOrderLogisticsController
                .reviewEligibility(ORDER_ID, CUSTOMER_PROFILE_ID, PRODUCT_ID).getBody();

        assertFalse(response.eligible());
        assertEquals("NOT_ORDER_OWNER", response.reasonCode());
    }

    @Test
    void ineligibleWhenOrderNotDelivered() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order("IN_TRANSIT", CUSTOMER_PROFILE_ID)));

        ReviewEligibilityResponse response = internalOrderLogisticsController
                .reviewEligibility(ORDER_ID, CUSTOMER_PROFILE_ID, PRODUCT_ID).getBody();

        assertFalse(response.eligible());
        assertEquals("ORDER_NOT_DELIVERED", response.reasonCode());
    }

    @Test
    void ineligibleWhenProductNotInOrder() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order("DELIVERED", CUSTOMER_PROFILE_ID)));
        when(orderItemRepository.existsByOrder_IdAndProductId(ORDER_ID, PRODUCT_ID)).thenReturn(false);

        ReviewEligibilityResponse response = internalOrderLogisticsController
                .reviewEligibility(ORDER_ID, CUSTOMER_PROFILE_ID, PRODUCT_ID).getBody();

        assertFalse(response.eligible());
        assertEquals("PRODUCT_NOT_IN_ORDER", response.reasonCode());
    }

    @Test
    void notFoundWhenOrderDoesNotExist() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> internalOrderLogisticsController.reviewEligibility(ORDER_ID, CUSTOMER_PROFILE_ID, PRODUCT_ID));
    }

    // ---------- getOrder / getOrderItems / getTripByOrder (consumed by S6) ----------

    @Test
    void getOrderReturnsTheOrderMappedToS6sExpectedFieldNames() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order("IN_TRANSIT", CUSTOMER_PROFILE_ID)));

        var response = internalOrderLogisticsController.getOrder(ORDER_ID);

        assertEquals(ORDER_ID, response.orderId());
        assertEquals(CUSTOMER_PROFILE_ID, response.customerProfileId());
        assertEquals("IN_TRANSIT", response.orderStatus());
    }

    @Test
    void getOrderOmitsDeliveredAtWhenTheOrderIsNotDelivered() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order("IN_TRANSIT", CUSTOMER_PROFILE_ID)));

        assertEquals(null, internalOrderLogisticsController.getOrder(ORDER_ID).deliveredAt());
    }

    @Test
    void getOrderThrowsWhenTheOrderIsMissing() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> internalOrderLogisticsController.getOrder(ORDER_ID));
    }

    @Test
    void getOrderItemsReturnsEveryItemMappedToS6sExpectedFieldNames() {
        Order order = order("IN_TRANSIT", CUSTOMER_PROFILE_ID);
        OrderItem item = new OrderItem();
        item.setId(101L);
        item.setOrder(order);
        item.setRetailerId(UUID.randomUUID());
        item.setProductId(PRODUCT_ID);
        item.setSkuSnapshot("SKU-1");
        item.setProductNameSnapshot("Widget");
        item.setQuantity(3);
        item.setUnitPrice(new BigDecimal("10.00"));
        item.setDiscountAmount(BigDecimal.ZERO);
        item.setLineTotal(new BigDecimal("30.00"));

        when(orderRepository.existsById(ORDER_ID)).thenReturn(true);
        when(orderItemRepository.findByOrder_Id(ORDER_ID)).thenReturn(List.of(item));

        var response = internalOrderLogisticsController.getOrderItems(ORDER_ID);

        assertEquals(1, response.size());
        assertEquals(101L, response.get(0).orderItemId());
        assertEquals(ORDER_ID, response.get(0).orderId());
        assertEquals(PRODUCT_ID, response.get(0).productId());
        assertEquals(new BigDecimal("30.00"), response.get(0).lineTotal());
    }

    @Test
    void getOrderItemsThrowsWhenTheOrderIsMissing() {
        when(orderRepository.existsById(ORDER_ID)).thenReturn(false);

        assertThrows(ResourceNotFoundException.class, () -> internalOrderLogisticsController.getOrderItems(ORDER_ID));
    }

    @Test
    void getTripByOrderReturnsTheTripMappedToS6sExpectedFieldNames() {
        UUID tripId = UUID.randomUUID();
        UUID vehicleId = UUID.randomUUID();
        UUID driverId = UUID.randomUUID();
        UUID fleetOwnerId = UUID.randomUUID();
        Trip trip = new Trip();
        trip.setId(tripId);
        trip.setVehicleId(vehicleId);
        trip.setDriverId(driverId);
        trip.setFleetOwnerId(fleetOwnerId);
        trip.setTripStatus("COMPLETED");
        trip.setProofOfDelivery("signed-pod.pdf");
        when(tripRepository.findByOrder_Id(ORDER_ID)).thenReturn(Optional.of(trip));

        var response = internalOrderLogisticsController.getTripByOrder(ORDER_ID);

        assertEquals(tripId, response.tripId());
        assertEquals(ORDER_ID, response.orderId());
        assertEquals(vehicleId, response.vehicleId());
        assertEquals(driverId, response.driverId());
        assertEquals(fleetOwnerId, response.fleetOwnerId());
        assertEquals("COMPLETED", response.tripStatus());
        assertEquals("signed-pod.pdf", response.proofOfDelivery());
    }

    @Test
    void getTripByOrderThrowsWhenNoTripExistsForTheOrder() {
        when(tripRepository.findByOrder_Id(ORDER_ID)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> internalOrderLogisticsController.getTripByOrder(ORDER_ID));
    }
}
