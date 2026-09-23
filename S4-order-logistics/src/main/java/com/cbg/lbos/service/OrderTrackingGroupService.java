package com.cbg.lbos.service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

import org.springframework.stereotype.Service;

import com.cbg.lbos.client.DriverClient;
import com.cbg.lbos.client.FleetOwnerClient;
import com.cbg.lbos.client.RetailerClient;
import com.cbg.lbos.client.UserAccountClient;
import com.cbg.lbos.client.VehicleClient;
import com.cbg.lbos.controller.InternalOrderLogisticsController;
import com.cbg.lbos.dto.OrderTrackingDto;
import com.cbg.lbos.dto.OrderTrackingGroupDto;
import com.cbg.lbos.dto.OrderTrackingGroupDto.DeliveryInfoDto;
import com.cbg.lbos.dto.OrderTrackingGroupDto.ShopTrackingDto;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.entity.Trip;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.repository.OrderItemRepository;
import com.cbg.lbos.repository.OrderRepository;
import com.cbg.lbos.repository.TripRepository;

/**
 * Customer-side tracking for a checkout that produced several shop-specific orders.
 *
 * <p>The order architecture is unchanged: every shop keeps its own order, status and trip. There is
 * no stored checkout id, so "orders from the same checkout" is derived from what checkout already
 * writes: the frontend creates every shop's order in the same instant for the same customer, with
 * the same delivery address and payment method. Orders matching on all of those (created within
 * {@link #SAME_CHECKOUT_WINDOW}) belong together.
 *
 * <p>Per-order tracking is delegated to {@link OrderService#getTracking(Long)}; this class only
 * adds the shop name, the assigned driver/vehicle (once a trip exists) and the ETA, and resolves
 * those display-only lookups through short-lived caches so a 5-second poll doesn't repeat the
 * same Feign calls.
 */
@Service
public class OrderTrackingGroupService {

    /** Orders of one checkout are created within a few milliseconds of each other. */
    private static final Duration SAME_CHECKOUT_WINDOW = Duration.ofSeconds(2);
    private static final Duration LOOKUP_TTL = Duration.ofMinutes(5);
    private static final int MAX_CACHED_LOOKUPS = 1_000;

    private static final Set<String> ETA_NOT_APPLICABLE =
            Set.of("DELIVERED", "CANCELLED", "RETAILER_REJECTED", "SHOP_UNAVAILABLE");

    private record Cached(Object value, long expiresAtNanos) {
    }

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final TripRepository tripRepository;
    private final OrderService orderService;
    private final RetailerClient retailerClient;
    private final DriverClient driverClient;
    private final VehicleClient vehicleClient;
    private final FleetOwnerClient fleetOwnerClient;
    private final UserAccountClient userAccountClient;

    private final Map<String, Cached> lookups = new ConcurrentHashMap<>();

    public OrderTrackingGroupService(OrderRepository orderRepository, OrderItemRepository orderItemRepository,
            TripRepository tripRepository, OrderService orderService, RetailerClient retailerClient,
            DriverClient driverClient, VehicleClient vehicleClient, FleetOwnerClient fleetOwnerClient,
            UserAccountClient userAccountClient) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.tripRepository = tripRepository;
        this.orderService = orderService;
        this.retailerClient = retailerClient;
        this.driverClient = driverClient;
        this.vehicleClient = vehicleClient;
        this.fleetOwnerClient = fleetOwnerClient;
        this.userAccountClient = userAccountClient;
    }

    public OrderTrackingGroupDto getGroup(Long orderId) {
        Order anchor = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
        List<Order> orders = "RETAIL".equalsIgnoreCase(anchor.getOrderType()) ? siblingsOf(anchor) : List.of(anchor);
        return new OrderTrackingGroupDto(orders.stream().map(this::toShopTracking).toList());
    }

    private List<Order> siblingsOf(Order anchor) {
        LocalDateTime from = anchor.getOrderDate().minus(SAME_CHECKOUT_WINDOW);
        LocalDateTime to = anchor.getOrderDate().plus(SAME_CHECKOUT_WINDOW);
        List<Order> siblings = orderRepository
                .findByCustomerProfileIdAndOrderTypeAndOrderDateBetweenOrderByIdAsc(
                        anchor.getCustomerProfileId(), anchor.getOrderType(), from, to)
                .stream()
                .filter(order -> Objects.equals(order.getDeliveryAddress(), anchor.getDeliveryAddress())
                        && Objects.equals(order.getPaymentMethod(), anchor.getPaymentMethod()))
                .toList();
        return siblings.stream().anyMatch(order -> order.getId().equals(anchor.getId())) ? siblings : List.of(anchor);
    }

    private ShopTrackingDto toShopTracking(Order order) {
        OrderTrackingDto tracking = orderService.getTracking(order.getId());
        boolean halted = tracking.haltedState() != null;
        Trip trip = halted ? null : tripRepository.findByOrder_Id(order.getId()).orElse(null);
        return new ShopTrackingDto(order.getId(), order.getOrderNumber(), shopNameOf(order), tracking,
                trip == null ? null : deliveryInfoOf(trip), etaTextOf(order));
    }

    private String shopNameOf(Order order) {
        UUID retailerId = orderItemRepository.findByOrder_Id(order.getId()).stream()
                .map(item -> item.getRetailerId())
                .filter(Objects::nonNull)
                .findFirst().orElse(null);
        if (retailerId == null) {
            return null;
        }
        return cached("shop|" + retailerId, () -> retailerClient.getRetailer(retailerId).businessName());
    }

    /** Only built once a fleet owner has assigned a driver (a trip exists) - never before. */
    private DeliveryInfoDto deliveryInfoOf(Trip trip) {
        String key = "delivery|" + trip.getId() + "|" + trip.getDriverId() + "|" + trip.getVehicleId();
        return cached(key, () -> {
            String fleetOwner = quietly(() -> fleetOwnerClient.getFleetOwner(trip.getFleetOwnerId()).businessName());
            String vehicle = quietly(() -> vehicleClient.getVehicle(trip.getVehicleId()).registrationNumber());
            var contact = quietly(() -> userAccountClient
                    .getUserContact(driverClient.getDriver(trip.getDriverId()).userAccountId()));
            String driverName = contact == null ? ""
                    : (nullToEmpty(contact.firstName()) + " " + nullToEmpty(contact.lastName())).trim();
            return new DeliveryInfoDto(fleetOwner, driverName.isEmpty() ? null : driverName, vehicle,
                    contact == null ? null : contact.phoneNumber());
        });
    }

    /**
     * Counts down to the retail delivery estimate the customer was shown at checkout
     * ("30-60 minutes", see InternalOrderLogisticsController) measured from when the order was
     * placed - the project's existing retail ETA, not a new calculation.
     */
    private String etaTextOf(Order order) {
        if (ETA_NOT_APPLICABLE.contains(order.getOrderStatus()) || !"RETAIL".equalsIgnoreCase(order.getOrderType())) {
            return null;
        }
        long minutesLeft = InternalOrderLogisticsController.RETAIL_DELIVERY_ESTIMATE_MAX_MINUTES
                - Duration.between(order.getOrderDate(), LocalDateTime.now()).toMinutes();
        if (minutesLeft <= 0) {
            return "Arriving shortly";
        }
        return "Within " + minutesLeft + (minutesLeft == 1 ? " minute" : " minutes");
    }

    @SuppressWarnings("unchecked")
    private <T> T cached(String key, Supplier<T> loader) {
        long now = System.nanoTime();
        Cached hit = lookups.get(key);
        if (hit != null && now < hit.expiresAtNanos()) {
            return (T) hit.value();
        }
        T value = quietly(loader);
        if (value != null) {
            if (lookups.size() >= MAX_CACHED_LOOKUPS) {
                lookups.clear();
            }
            lookups.put(key, new Cached(value, now + LOOKUP_TTL.toNanos()));
        }
        return value;
    }

    /** Display-only enrichment: a failed lookup leaves that one field empty, never fails tracking. */
    private static <T> T quietly(Supplier<T> lookup) {
        try {
            return lookup.get();
        } catch (RuntimeException failure) {
            return null;
        }
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
