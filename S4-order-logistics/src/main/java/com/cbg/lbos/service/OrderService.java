package com.cbg.lbos.service;

import com.cbg.lbos.client.CustomerClient;
import com.cbg.lbos.client.DriverClient;
import com.cbg.lbos.client.FleetOwnerClient;
import com.cbg.lbos.client.InventoryClient;
import com.cbg.lbos.client.NotificationClient;
import com.cbg.lbos.client.RetailerClient;
import com.cbg.lbos.client.VehicleClient;
import com.cbg.lbos.client.dto.CustomerSummary;
import com.cbg.lbos.client.dto.DriverSummary;
import com.cbg.lbos.client.dto.NotificationCreateRequest;
import com.cbg.lbos.client.dto.RetailerContextSummary;
import com.cbg.lbos.client.dto.VehicleSummary;
import com.cbg.lbos.dto.OrderDto;
import com.cbg.lbos.dto.OrderTrackingDto;
import com.cbg.lbos.dto.OrderTrackingDto.TrackingStepDto;
import com.cbg.lbos.entity.LogisticsBookingDetail;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.entity.OrderItem;
import com.cbg.lbos.entity.Trip;
import com.cbg.lbos.exception.DuplicateResourceException;
import com.cbg.lbos.exception.ForbiddenOperationException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.repository.LogisticsBookingDetailRepository;
import com.cbg.lbos.repository.OrderItemRepository;
import com.cbg.lbos.repository.OrderRepository;
import com.cbg.lbos.repository.TripRepository;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final TripRepository tripRepository;
    private final LogisticsBookingDetailRepository logisticsBookingDetailRepository;
    private final InventoryClient inventoryClient;
    private final RetailerClient retailerClient;
    private final CustomerClient customerClient;
    private final NotificationClient notificationClient;
    private final VehicleClient vehicleClient;
    private final DriverClient driverClient;
    private final FleetOwnerClient fleetOwnerClient;
    private final OrderWeightService orderWeightService;

    /** Search radius for the nearest-fleet-partner lookup in retailerAccept() below. */
    private static final double NEAREST_FLEET_SEARCH_RADIUS_KM = 25.0;

    public OrderService(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            TripRepository tripRepository,
            LogisticsBookingDetailRepository logisticsBookingDetailRepository,
            InventoryClient inventoryClient,
            RetailerClient retailerClient,
            CustomerClient customerClient,
            NotificationClient notificationClient,
            VehicleClient vehicleClient,
            DriverClient driverClient,
            FleetOwnerClient fleetOwnerClient,
            OrderWeightService orderWeightService) {
        this.orderWeightService = orderWeightService;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.tripRepository = tripRepository;
        this.logisticsBookingDetailRepository = logisticsBookingDetailRepository;
        this.inventoryClient = inventoryClient;
        this.retailerClient = retailerClient;
        this.customerClient = customerClient;
        this.notificationClient = notificationClient;
        this.vehicleClient = vehicleClient;
        this.driverClient = driverClient;
        this.fleetOwnerClient = fleetOwnerClient;
    }

    public OrderDto create(OrderDto dto) {
        if (orderRepository.existsByOrderNumber(dto.getOrderNumber())) {
            throw new DuplicateResourceException(
                    "Order number already exists: " + dto.getOrderNumber());
        }
        Order order = new Order();
        copyDtoToEntity(dto, order);
        /*
         * A brand-new order has no prior status to transition from, so the caller-supplied
         * status is taken as-is (OrderDto requires it to be non-blank). Status-transition
         * validation only applies from update() onward - see validateStatusTransition().
         */
        order.setOrderStatus(dto.getOrderStatus());
        return toDto(orderRepository.save(order));
    }

    @Transactional(readOnly = true)
    public OrderDto getById(Long id) {
        return toDto(findOrder(id));
    }

    /*
     * TRACKING-ONLY VIEW
     *
     * The customer tracking screen needs the tracking payload and nothing else,
     * so this returns a narrow projection built from fields the Order entity
     * already stores rather than the full OrderDto.
     */
    @Transactional(readOnly = true)
    public OrderTrackingDto getTracking(Long id) {
        Order order = findOrder(id);
        String haltedState = haltedStateOf(order.getOrderStatus());
        List<TrackingStepDto> steps = haltedState != null ? null : buildTrackingSteps(order);
        return new OrderTrackingDto(
                order.getId(),
                order.getOrderNumber(),
                order.getOrderStatus(),
                order.getOrderTrackingJson(),
                order.getUpdatedDatetime(),
                computeSlaStatus(order),
                displayStageOf(order),
                steps,
                haltedState);
    }

    @Transactional(readOnly = true)
    public List<OrderDto> getAll() {
        return orderRepository.findAll().stream().map(this::toDto).toList();
    }

    /**
     * The customer's own orders - closes the gap where the frontend previously had no way to
     * list a customer's order history except a per-browser localStorage cache (GET /api/orders
     * itself is staff-only). See OrderController.
     */
    @Transactional(readOnly = true)
    public List<OrderDto> getMineForCustomer(UUID customerProfileId) {
        return orderRepository.findByCustomerProfileId(customerProfileId).stream().map(this::toDto).toList();
    }

    /**
     * Same order history as getMineForCustomer(), one page at a time (newest first) - backs the
     * customer order-list screen's lazy-load-on-scroll, so a customer with a long order history
     * no longer has every order (and its item summary) fetched and rendered up front.
     */
    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<OrderDto> getMineForCustomerPaged(
            UUID customerProfileId, org.springframework.data.domain.Pageable pageable) {
        return orderRepository.findByCustomerProfileIdOrderByOrderDateDesc(customerProfileId, pageable).map(this::toDto);
    }

    /**
     * The retailer's own incoming orders - closes the "order visibility isn't available for
     * retailers yet" gap the frontend previously documented (GET /api/orders has no
     * retailerId filter and is staff-only). See OrderController and
     * RetailerOrderActionController.
     */
    @Transactional(readOnly = true)
    public List<OrderDto> getMineForRetailer(UUID retailerId) {
        List<Long> orderIds = orderItemRepository.findDistinctOrderIdsByRetailerId(retailerId);
        return orderRepository.findAllById(orderIds).stream().map(this::toDto).toList();
    }

    /**
     * Orders currently awaiting a delivery partner - the fleet owner's "browse and accept"
     * fallback view alongside the targeted notification findAndNotifyNearestFleetPartnerBestEffort()
     * already sends. Not scoped to a specific fleet owner (any available fleet owner may accept
     * any of these) - accepting is still the existing POST /api/trips (TripService.create()),
     * unchanged. Covers both order types waiting on a Trip: a RETAIL order sits at
     * FINDING_DELIVERY_PARTNER, a FLEET_SERVICE (logistics booking) order at BOOKING_CONFIRMED
     * (see TripService.validateOrderForTrip()) - querying only the first status meant a
     * confirmed logistics booking never showed up here at all, so no fleet owner could ever
     * accept it.
     */
    @Transactional(readOnly = true)
    public List<OrderDto> getPendingFleetAssignment() {
        List<Order> pending = orderRepository.findByOrderStatusIn(List.of("FINDING_DELIVERY_PARTNER", "BOOKING_CONFIRMED"));
        // Fleet managers see each order's total weight before assigning it (one item query for all orders).
        java.util.Map<Long, java.math.BigDecimal> weights =
                orderWeightService.totalWeightKgByOrderId(pending.stream().map(Order::getId).toList());
        return pending.stream().map(order -> {
            OrderDto dto = toDto(order);
            dto.setTotalWeightKg(weights.get(order.getId()));
            return dto;
        }).toList();
    }

    public OrderDto update(Long id, OrderDto dto) {
        Order order = findOrder(id);
        String currentStatus = order.getOrderStatus();
        String requestedStatus = dto.getOrderStatus();

        /*
         * A null/blank orderStatus on the incoming DTO means the caller is not changing
         * status - keep whatever the order already has, same posture as every other
         * unspecified field in copyDtoToEntity() below.
         */
        boolean changingStatus = requestedStatus != null && !requestedStatus.isBlank();
        String effectiveStatus = changingStatus ? requestedStatus.trim() : currentStatus;

        if (changingStatus) {
            validateStatusTransition(currentStatus, effectiveStatus);
        }

        /*
         * The transition/fee checks gate what copyDtoToEntity() below is allowed to write,
         * rather than validating after copyDtoToEntity() has already overwritten the status.
         */
        if ("CANCELLED".equals(effectiveStatus) && !"CANCELLED".equals(currentStatus)) {
            order.setCancellationFeeAmount(calculateCancellationFee(order, currentStatus));
            restoreStockForCancelledOrder(order);
        }

        copyDtoToEntity(dto, order);
        order.setOrderStatus(effectiveStatus);
        return toDto(orderRepository.save(order));
    }

    /**
     * Customer-facing cancellation - a thin, ownership-checked wrapper around the same
     * CANCELLED-transition logic update() already runs (fee calc + stock restore), without
     * requiring the customer to resubmit the entire order DTO the way PUT does. customerProfileId
     * is caller-supplied and checked against the order's own record, the same trust model
     * OrderItemService's Feign-derived ownership checks use elsewhere in this codebase - there is
     * no reverse "customer profile for this user account" lookup available from S4 the way
     * resolveActingRetailerId() has for retailers.
     */
    public OrderDto cancel(Long id, UUID customerProfileId, String reason) {
        Order order = findOrder(id);
        if (customerProfileId == null || !customerProfileId.equals(order.getCustomerProfileId())) {
            throw new ForbiddenOperationException("Order " + id + " does not belong to this customer");
        }
        String currentStatus = order.getOrderStatus();
        if (tripRepository.findByOrder_Id(order.getId()).isPresent()
                || "VEHICLE_ASSIGNED".equals(currentStatus)
                || "IN_TRANSIT".equals(currentStatus)
                || "DELIVERED".equals(currentStatus)) {
            throw new IllegalArgumentException(
                    "Order cannot be cancelled after a driver and vehicle have been assigned");
        }
        validateStatusTransition(currentStatus, "CANCELLED");

        order.setCancellationFeeAmount(calculateCancellationFee(order, currentStatus));
        restoreStockForCancelledOrder(order);
        order.setCancellationReason(reason);
        order.setCancelledDatetime(java.time.LocalDateTime.now());
        order.setOrderStatus("CANCELLED");
        return toDto(orderRepository.save(order));
    }

    public static final java.util.Set<String> TERMINAL_ORDER_STATUSES =
            java.util.Set.of("DELIVERED", "CANCELLED", "RETAILER_REJECTED", "SHOP_UNAVAILABLE");

    /**
     * Cancels every non-terminal order for a retailer that S2 has just suspended - called
     * service-to-service, not by any customer/staff-facing endpoint. The cancellation fee is
     * always waived (the customer did nothing wrong) and the customer is notified best-effort.
     *
     * @param retailerId the suspended retailer
     * @param reason a human-readable reason, or blank/null to use a default
     * @return the ids of the orders actually cancelled
     */
    public List<Long> cancelActiveOrdersForSuspendedRetailer(UUID retailerId, String reason) {
        List<Long> orderIds = orderItemRepository.findDistinctOrderIdsByRetailerId(retailerId);
        List<Order> orders = orderRepository.findAllById(orderIds);
        return cancelOrdersForSuspendedPartner(orders, reason, "Retailer suspended by Operations Manager");
    }

    /**
     * Cancels every non-terminal order behind a fleet owner's trips, once S2 has suspended that
     * fleet owner. See {@link #cancelActiveOrdersForSuspendedRetailer} for the fee/notification
     * behaviour - identical here.
     *
     * @param fleetOwnerId the suspended fleet owner
     * @param reason a human-readable reason, or blank/null to use a default
     * @return the ids of the orders actually cancelled
     */
    public List<Long> cancelActiveOrdersForSuspendedFleetOwner(UUID fleetOwnerId, String reason) {
        java.util.Map<Long, Order> byOrderId = new java.util.LinkedHashMap<>();
        for (Trip trip : tripRepository.findByFleetOwnerId(fleetOwnerId)) {
            Order order = trip.getOrder();
            if (order != null) {
                byOrderId.putIfAbsent(order.getId(), order);
            }
        }
        return cancelOrdersForSuspendedPartner(
                new ArrayList<>(byOrderId.values()), reason, "Fleet owner suspended by Operations Manager");
    }

    private List<Long> cancelOrdersForSuspendedPartner(List<Order> orders, String reason, String defaultReason) {
        String cancellationReason = (reason == null || reason.isBlank()) ? defaultReason : reason.trim();
        List<Long> cancelledIds = new ArrayList<>();
        for (Order order : orders) {
            if (TERMINAL_ORDER_STATUSES.contains(order.getOrderStatus())) {
                continue;
            }
            try {
                order.setCancellationFeeAmount(BigDecimal.ZERO);
                restoreStockForCancelledOrder(order);
                order.setCancellationReason(cancellationReason);
                order.setCancelledDatetime(java.time.LocalDateTime.now());
                order.setOrderStatus("CANCELLED");
                orderRepository.save(order);
                cancelledIds.add(order.getId());
                notifyCustomerBestEffort(order, "ORDER_CANCELLED", "Order cancelled",
                        "Your order " + order.getOrderNumber() + " was cancelled: " + cancellationReason);
            } catch (RuntimeException cancellationFailed) {
                log.warn("Could not cancel order {} for suspended partner: {}",
                        order.getId(), cancellationFailed.getMessage());
            }
        }
        return cancelledIds;
    }

    public void delete(Long id) {
        Order order = findOrder(id);
        orderRepository.delete(order);
    }

    /*
     * RETAIL FULFILMENT FLOW - see docs/application-workflow.md and OrderTrackingDto.
     *
     * submit()/retailerAccept()/retailerReject()/markPaymentConfirmed() are new, narrow
     * action methods rather than going through the generic update(Long, OrderDto) path:
     * each one only ever changes orderStatus (or, for markPaymentConfirmed, paymentStatus)
     * and fires exactly one best-effort notification, so a dedicated method avoids forcing
     * every caller to first assemble a full OrderDto just to flip one field.
     */

    /**
     * Moves a freshly-created order from NEW to WAITING_FOR_RETAILER and starts the
     * 10-minute retailer-response clock (RetailerResponseTimeoutJob polls on
     * updatedDatetime). Called once, right after every OrderItem has been added -
     * an explicit step rather than inferring "submitted" from the last addItem call,
     * which would be fragile if the caller crashed mid-loop.
     */
    public OrderDto submit(Long orderId) {
        Order order = findOrder(orderId);
        validateStatusTransition(order.getOrderStatus(), "WAITING_FOR_RETAILER");
        order.setOrderStatus("WAITING_FOR_RETAILER");
        order.setUpdatedDatetime(LocalDateTime.now());
        orderRepository.save(order);

        UUID retailerId = firstLineItemRetailerId(order);
        if (retailerId != null) {
            notifyRetailerBestEffort(retailerId, order, "ORDER_RECEIVED",
                    "New order received",
                    "You have a new order " + order.getOrderNumber() + " awaiting your response.");
        }
        return toDto(order);
    }

    /**
     * A retailer accepting an order they own. Ownership is resolved from the caller's own
     * JWT subject (S1 user account id), not a client-supplied retailerId, so one retailer
     * can never accept/reject another retailer's order by guessing an id.
     */
    public OrderDto retailerAccept(Long orderId, UUID actingUserAccountId) {
        Order order = findOrder(orderId);
        UUID retailerId = resolveActingRetailerId(actingUserAccountId);
        verifyRetailerOwnsOrder(order, retailerId);

        validateStatusTransition(order.getOrderStatus(), "RETAILER_ACCEPTED");
        order.setOrderStatus("RETAILER_ACCEPTED");
        order.setUpdatedDatetime(LocalDateTime.now());
        orderRepository.save(order);
        notifyCustomerBestEffort(order, "ORDER_ACCEPTED", "Order accepted",
                "The shop accepted your order " + order.getOrderNumber() + ".");

        /*
         * Immediately advance into the fleet-matching stage - a retailer-accepted retail order
         * always needs a delivery partner next. Kept as a single transaction with the accept
         * itself (both statuses are legal transitions from WAITING_FOR_RETAILER's successor, see
         * validateStatusTransition()) rather than a second round trip from the caller.
         */
        validateStatusTransition(order.getOrderStatus(), "FINDING_DELIVERY_PARTNER");
        order.setOrderStatus("FINDING_DELIVERY_PARTNER");
        order.setUpdatedDatetime(LocalDateTime.now());
        orderRepository.save(order);
        findAndNotifyNearestFleetPartnerBestEffort(order);

        return toDto(order);
    }

    /**
     * Finds the nearest available vehicle+driver to the order's delivery address (haversine
     * search on S5, see VehicleClient/DriverClient.nearestAvailable()) and notifies that
     * fleet owner - see the requirement "nearby Fleet Owner / Bike Owner is notified". Best
     * effort: if the order has no delivery coordinates, or S5 is unreachable, or no fleet
     * partner is found within range, the order simply stays at FINDING_DELIVERY_PARTNER
     * (a fleet owner can still browse GET /api/orders/pending-fleet-assignment and accept
     * manually - see OrderController) rather than failing the retailer-accept action itself.
     */
    private void findAndNotifyNearestFleetPartnerBestEffort(Order order) {
        BigDecimal lat = order.getDeliveryLatitude();
        BigDecimal lon = order.getDeliveryLongitude();
        if (lat == null || lon == null) {
            return;
        }
        try {
            List<VehicleSummary> vehicles = vehicleClient.nearestAvailable(lat, lon, NEAREST_FLEET_SEARCH_RADIUS_KM);
            List<DriverSummary> drivers = driverClient.nearestAvailable(lat, lon, NEAREST_FLEET_SEARCH_RADIUS_KM);
            UUID fleetOwnerId = !vehicles.isEmpty() ? vehicles.get(0).fleetOwnerId()
                    : !drivers.isEmpty() ? drivers.get(0).fleetOwnerId() : null;
            if (fleetOwnerId == null) {
                log.info("No available fleet partner found within {}km for order {}",
                        NEAREST_FLEET_SEARCH_RADIUS_KM, order.getId());
                return;
            }
            notifyFleetOwnerBestEffort(fleetOwnerId, order);
        } catch (FeignException exception) {
            log.warn("Fleet-partner search failed for order {}: {}", order.getId(), exception.getMessage());
        }
    }

    private void notifyFleetOwnerBestEffort(UUID fleetOwnerId, Order order) {
        try {
            UUID recipientUserAccountId = fleetOwnerClient.getFleetOwner(fleetOwnerId).userAccountId();
            notificationClient.create(new NotificationCreateRequest(
                    recipientUserAccountId, "FLEET_MANAGER", "DELIVERY_REQUEST",
                    "ORDER", String.valueOf(order.getId()), "New delivery request",
                    "Order " + order.getOrderNumber() + " is ready for pickup and needs a delivery partner."));
        } catch (FeignException exception) {
            log.warn("Failed to notify fleet owner {} about order {}: {}",
                    fleetOwnerId, order.getId(), exception.getMessage());
        }
    }

    /**
     * A retailer rejecting an order they own. Terminal for this order's own fulfilment
     * attempt - per the "never silently remove/reassign" requirement, the customer is
     * expected to find another shop and start a new order, not have this one revived.
     */
    public OrderDto retailerReject(Long orderId, UUID actingUserAccountId, String reason) {
        Order order = findOrder(orderId);
        UUID retailerId = resolveActingRetailerId(actingUserAccountId);
        verifyRetailerOwnsOrder(order, retailerId);

        validateStatusTransition(order.getOrderStatus(), "RETAILER_REJECTED");
        order.setOrderStatus("RETAILER_REJECTED");
        order.setCancellationReason(reason);
        order.setUpdatedDatetime(LocalDateTime.now());
        orderRepository.save(order);

        notifyCustomerBestEffort(order, "ORDER_REJECTED", "Order rejected",
                "Your order was rejected by the shop.");
        return toDto(order);
    }

    /**
     * Called back by S6 once a simulated payment capture succeeds (see
     * PaymentTransactionServiceImpl.capture()). paymentStatus and orderStatus are separate
     * axes - a payment being confirmed does not by itself advance the fulfilment stepper.
     */
    public OrderDto markPaymentConfirmed(Long orderId) {
        Order order = findOrder(orderId);
        order.setPaymentStatus("PAID");
        order.setUpdatedDatetime(LocalDateTime.now());
        orderRepository.save(order);
        return toDto(order);
    }

    private Order findOrder(Long id) {
        return orderRepository.findById(id).orElseThrow(() ->
                new ResourceNotFoundException("Order not found with ID: " + id));
    }

    /*
     * Recomputes subtotalAmount/totalAmount from the order's actual line items rather than
     * trusting whatever OrderDto.subtotalAmount/totalAmount a caller last sent - OrderItemService
     * calls this after every item create/update/delete, so an order's totals can never drift
     * from the sum of its own items regardless of what a client-supplied order-level DTO claims.
     * deliveryCharge/discountAmount/taxAmount/platformFeeAmount are left as already stored (set
     * by the checkout/logistics-booking/promotions flows respectively, not by this
     * recalculation) - taxAmount/platformFeeAmount were previously omitted from the totalAmount
     * formula entirely, so placing an order silently dropped both from the stored total even
     * though checkout had shown and charged for them (confirmed live: Order Details' "Total
     * paid" undercounted the actual amount by exactly tax + platform fee).
     */
    public void recalculateTotals(Long orderId) {
        Order order = findOrder(orderId);
        BigDecimal subtotal = orderItemRepository.findByOrder_Id(orderId).stream()
                .map(OrderItem::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal deliveryCharge = order.getDeliveryCharge() != null ? order.getDeliveryCharge() : BigDecimal.ZERO;
        BigDecimal discountAmount = order.getDiscountAmount() != null ? order.getDiscountAmount() : BigDecimal.ZERO;
        BigDecimal taxAmount = order.getTaxAmount() != null ? order.getTaxAmount() : BigDecimal.ZERO;
        BigDecimal platformFeeAmount = order.getPlatformFeeAmount() != null ? order.getPlatformFeeAmount() : BigDecimal.ZERO;
        order.setSubtotalAmount(subtotal);
        order.setTotalAmount(subtotal.add(deliveryCharge).add(taxAmount).add(platformFeeAmount).subtract(discountAmount));
        orderRepository.save(order);
    }

    private void copyDtoToEntity(OrderDto dto, Order order) {
        order.setOrderNumber(dto.getOrderNumber());
        /*
         * customer_profile lives in S3. S4 stores the scalar FK as supplied,
         * exactly as S3 itself stores unvalidated external UUIDs.
         */
        order.setCustomerProfileId(dto.getCustomerProfileId());
        order.setOrderType(dto.getOrderType());
        order.setOrderDate(dto.getOrderDate() != null
                ? dto.getOrderDate() : LocalDateTime.now());
        order.setSubtotalAmount(dto.getSubtotalAmount());
        order.setDeliveryCharge(dto.getDeliveryCharge());
        order.setDiscountAmount(dto.getDiscountAmount());
        order.setTaxAmount(dto.getTaxAmount() != null ? dto.getTaxAmount() : BigDecimal.ZERO);
        order.setPlatformFeeAmount(dto.getPlatformFeeAmount() != null ? dto.getPlatformFeeAmount() : BigDecimal.ZERO);
        order.setTotalAmount(dto.getTotalAmount());
        /*
         * orderStatus is deliberately NOT copied here - update() validates the requested
         * transition (and computes any cancellation fee) before setting it explicitly, and
         * create() sets it directly since a new order has no prior status to validate against.
         * cancellationFeeAmount is likewise never read from the DTO: it is a read-only,
         * server-computed field (see calculateCancellationFee()).
         */
        order.setStatusHistoryJson(dto.getStatusHistoryJson());
        order.setOrderTrackingJson(dto.getOrderTrackingJson());
        order.setDeliveryAddress(dto.getDeliveryAddress());
        order.setDeliveryLatitude(dto.getDeliveryLatitude());
        order.setDeliveryLongitude(dto.getDeliveryLongitude());
        order.setPaymentMethod(dto.getPaymentMethod());
        order.setPaymentStatus(dto.getPaymentStatus());
        order.setTransactionReference(dto.getTransactionReference());
        order.setCancellationReason(dto.getCancellationReason());
        order.setCancelledDatetime(dto.getCancelledDatetime());
        order.setUpdatedDatetime(LocalDateTime.now());
    }

    private OrderDto toDto(Order order) {
        OrderDto dto = new OrderDto();
        dto.setId(order.getId());
        dto.setOrderNumber(order.getOrderNumber());
        dto.setCustomerProfileId(order.getCustomerProfileId());
        dto.setOrderType(order.getOrderType());
        dto.setOrderDate(order.getOrderDate());
        dto.setSubtotalAmount(order.getSubtotalAmount());
        dto.setDeliveryCharge(order.getDeliveryCharge());
        dto.setDiscountAmount(order.getDiscountAmount());
        dto.setTaxAmount(order.getTaxAmount());
        dto.setPlatformFeeAmount(order.getPlatformFeeAmount());
        dto.setTotalAmount(order.getTotalAmount());
        dto.setOrderStatus(order.getOrderStatus());
        dto.setStatusHistoryJson(order.getStatusHistoryJson());
        dto.setOrderTrackingJson(order.getOrderTrackingJson());
        dto.setDeliveryAddress(order.getDeliveryAddress());
        dto.setDeliveryLatitude(order.getDeliveryLatitude());
        dto.setDeliveryLongitude(order.getDeliveryLongitude());
        dto.setPaymentMethod(order.getPaymentMethod());
        dto.setPaymentStatus(order.getPaymentStatus());
        dto.setTransactionReference(order.getTransactionReference());
        dto.setCancellationReason(order.getCancellationReason());
        dto.setCancelledDatetime(order.getCancelledDatetime());
        dto.setCancellationFeeAmount(order.getCancellationFeeAmount());
        dto.setUpdatedDatetime(order.getUpdatedDatetime());
        return dto;
    }

    /*
     * ORDER STATUS TRANSITION VALIDATION
     *
     * Mirrors TripService.validateStatusTransition(): a forward-only graph where DELIVERED,
     * CANCELLED, RETAILER_REJECTED and SHOP_UNAVAILABLE are terminal (no outgoing transitions)
     * and CANCELLED is reachable from every non-terminal status. Requesting the current status
     * again is a no-op, same convention TripService uses.
     *
     * The retail-flow statuses (WAITING_FOR_RETAILER, RETAILER_ACCEPTED, RETAILER_REJECTED,
     * FINDING_DELIVERY_PARTNER, SHOP_UNAVAILABLE) are new. BOOKING_CONFIRMED/VEHICLE_ASSIGNED/
     * IN_TRANSIT/DELIVERED/CANCELLED are unchanged and still exactly what
     * LogisticsBookingDetailService and TripService write directly to Order.orderStatus for
     * FLEET_SERVICE bookings (those two services mutate the entity and save it through their
     * own repositories, bypassing this method entirely - see their class-level notes - so
     * nothing here needs to special-case orderType).
     */
    private void validateStatusTransition(String currentStatus, String requestedStatus) {
        if (currentStatus.equals(requestedStatus)) {
            return;
        }

        boolean validTransition = switch (currentStatus) {
            case "NEW" -> "WAITING_FOR_RETAILER".equals(requestedStatus)
                    || "BOOKING_CONFIRMED".equals(requestedStatus)
                    || "CANCELLED".equals(requestedStatus);
            case "WAITING_FOR_RETAILER" -> "RETAILER_ACCEPTED".equals(requestedStatus)
                    || "RETAILER_REJECTED".equals(requestedStatus)
                    || "SHOP_UNAVAILABLE".equals(requestedStatus)
                    || "CANCELLED".equals(requestedStatus);
            case "RETAILER_ACCEPTED" -> "FINDING_DELIVERY_PARTNER".equals(requestedStatus)
                    || "CANCELLED".equals(requestedStatus);
            case "FINDING_DELIVERY_PARTNER" -> "VEHICLE_ASSIGNED".equals(requestedStatus)
                    || "BOOKING_CONFIRMED".equals(requestedStatus)
                    || "CANCELLED".equals(requestedStatus);
            case "BOOKING_CONFIRMED" ->
                    "VEHICLE_ASSIGNED".equals(requestedStatus) || "CANCELLED".equals(requestedStatus);
            case "VEHICLE_ASSIGNED" -> "IN_TRANSIT".equals(requestedStatus) || "CANCELLED".equals(requestedStatus);
            case "IN_TRANSIT" -> "DELIVERED".equals(requestedStatus) || "CANCELLED".equals(requestedStatus);
            case "DELIVERED", "CANCELLED", "RETAILER_REJECTED", "SHOP_UNAVAILABLE" -> false;
            default -> false;
        };

        if (!validTransition) {
            throw new IllegalArgumentException(
                    "Invalid order status transition from " + currentStatus + " to " + requestedStatus);
        }
    }

    /*
     * CANCELLATION FEE
     *
     * Fired only when the requested transition target is CANCELLED. Tiered by how far
     * cancellation has progressed the delivery: nothing committed yet is free, a vehicle
     * already assigned/close to pickup costs a quarter of the order, and a vehicle already
     * en route costs half. A trip already COMPLETED (or an order already DELIVERED) cannot
     * be cancelled at all - this should already be unreachable via validateStatusTransition()
     * since DELIVERED is terminal, but the check stays here as a defense-in-depth safety net
     * specifically for the fee-calculation path.
     */
    private BigDecimal calculateCancellationFee(Order order, String currentStatus) {
        Optional<Trip> tripOpt = tripRepository.findByOrder_Id(order.getId());
        Trip trip = tripOpt.orElse(null);
        String tripStatus = trip == null ? null : trip.getTripStatus();

        if ("COMPLETED".equals(tripStatus) || "DELIVERED".equals(currentStatus)) {
            throw new IllegalArgumentException("A delivered order cannot be cancelled");
        }

        if (trip == null) {
            // No trip has been dispatched for this order yet: cancelling costs nothing.
            return BigDecimal.ZERO;
        }

        if ("IN_PROGRESS".equals(tripStatus)) {
            // Vehicle is already en route: half the order value is forfeited.
            return percentageOf(order.getTotalAmount(), new BigDecimal("0.50"));
        }

        OffsetDateTime plannedStartAt = trip.getPlannedStartAt();
        boolean freeCancellationWindow = "PLANNED".equals(tripStatus)
                && plannedStartAt != null
                && OffsetDateTime.now().isBefore(plannedStartAt.minusHours(24));

        if (freeCancellationWindow) {
            // Trip is still PLANNED and starts more than 24 hours out: free cancellation.
            return BigDecimal.ZERO;
        }

        // Trip starts within 24 hours (or is already overdue) or is already ASSIGNED,
        // but has not yet departed: a quarter of the order value is forfeited.
        return percentageOf(order.getTotalAmount(), new BigDecimal("0.25"));
    }

    /*
     * STOCK RESTORATION ON CANCELLATION
     *
     * Fires from the same CANCELLED-transition branch as calculateCancellationFee() above,
     * which already guards this to run at most once per order: a repeated cancel attempt is a
     * same-status no-op under validateStatusTransition() (currentStatus.equals(requestedStatus)
     * returns early), so this method is never reached twice for the same order through the
     * normal update() flow. The per-item stockRestored flag is defense-in-depth on top of that
     * guard, not the only safeguard against a double restore.
     *
     * Each item's restore call is isolated in its own try/catch: a Feign failure restoring one
     * line item (S3 down, product deleted, timeout) must not abort the whole cancellation - the
     * order still ends up CANCELLED even if a restore call to S3 fails for one line item. That
     * item is simply left with stockRestored=false and its stock is not corrected in S3; there
     * is no retry/reconciliation job here to catch it later (known limitation, out of scope for
     * this pass, same as the lack of a true cross-service saga/compensating transaction for
     * OrderItemService's deduct-on-create path).
     */
    private void restoreStockForCancelledOrder(Order order) {
        List<OrderItem> items = orderItemRepository.findByOrder_Id(order.getId());
        for (OrderItem item : items) {
            if (item.isStockRestored()) {
                continue;
            }
            try {
                inventoryClient.restoreStock(item.getProductId(),
                        new InventoryClient.StockMutationRequest(item.getQuantity()));
                item.setStockRestored(true);
                orderItemRepository.save(item);
            } catch (FeignException exception) {
                log.warn("Failed to restore stock in S3 for order item {} (product {}, qty {}) "
                                + "on cancellation of order {}: {}",
                        item.getId(), item.getProductId(), item.getQuantity(), order.getId(),
                        exception.getMessage());
            }
        }
    }

    private BigDecimal percentageOf(BigDecimal amount, BigDecimal percentage) {
        BigDecimal base = amount == null ? BigDecimal.ZERO : amount;
        return base.multiply(percentage).setScale(2, RoundingMode.HALF_UP);
    }

    /*
     * DELIVERY SLA STATUS
     *
     * Derives an SLA window from the order's LogisticsBookingDetail.bookingType plus its
     * Trip.distanceKm (see resolveSlaHours()), then compares that window against the Trip's
     * plannedStartAt/completedAt to classify the delivery as PENDING (no trip yet), AT_RISK
     * (still moving, deadline already passed), IN_PROGRESS (still moving, within window),
     * ON_TIME (delivered inside the window) or LATE (delivered outside the window).
     */
    private String computeSlaStatus(Order order) {
        Trip trip = tripRepository.findByOrder_Id(order.getId()).orElse(null);
        if (trip == null) {
            return "PENDING";
        }

        OffsetDateTime plannedStartAt = trip.getPlannedStartAt();
        if (plannedStartAt == null) {
            return "PENDING";
        }

        double slaHours = resolveSlaHours(order, trip);
        OffsetDateTime slaDeadline = plannedStartAt.plusMinutes(Math.round(slaHours * 60));
        OffsetDateTime completedAt = trip.getCompletedAt();

        if (completedAt == null) {
            return OffsetDateTime.now().isAfter(slaDeadline) ? "AT_RISK" : "IN_PROGRESS";
        }
        return completedAt.isAfter(slaDeadline) ? "LATE" : "ON_TIME";
    }

    /*
     * SLA WINDOW (hours) = base hours for the booking type + a distance allowance.
     */
    private double resolveSlaHours(Order order, Trip trip) {
        String bookingType = logisticsBookingDetailRepository.findById(order.getId())
                .map(LogisticsBookingDetail::getBookingType)
                .orElse(null);

        double baseHours = bookingType == null ? 24.0 : switch (bookingType) {
            case "EXPRESS" -> 4.0;     // same-day express delivery window
            case "STANDARD" -> 24.0;   // default next-day delivery window
            case "SCHEDULED" -> 48.0;  // customer-scheduled delivery window
            default -> 24.0;           // unknown booking type falls back to the STANDARD window
        };

        BigDecimal distanceKm = trip.getDistanceKm();
        // Distance allowance: 0.1 hour (6 minutes) added per kilometre of trip distance.
        double distanceHours = distanceKm == null ? 0.0 : distanceKm.doubleValue() * 0.1;

        return baseHours + distanceHours;
    }

    /*
     * RETAILER OWNERSHIP RESOLUTION
     *
     * Retail orders are assumed one-retailer-per-order (a multi-retailer cart is split into
     * one order per retailer at checkout time, in the frontend) - so "does this retailer own
     * this order" only needs to check the first line item's retailerId, not every item.
     */
    private UUID firstLineItemRetailerId(Order order) {
        return orderItemRepository.findByOrder_Id(order.getId()).stream()
                .findFirst()
                .map(OrderItem::getRetailerId)
                .orElse(null);
    }

    private UUID resolveActingRetailerId(UUID actingUserAccountId) {
        try {
            RetailerContextSummary retailer = retailerClient.getRetailerByUserAccount(actingUserAccountId);
            return retailer.retailerId();
        } catch (FeignException exception) {
            throw new ForbiddenOperationException(
                    "The authenticated account is not a registered retailer");
        }
    }

    private void verifyRetailerOwnsOrder(Order order, UUID retailerId) {
        UUID orderRetailerId = firstLineItemRetailerId(order);
        if (orderRetailerId == null || !orderRetailerId.equals(retailerId)) {
            throw new ForbiddenOperationException(
                    "Order " + order.getId() + " does not belong to this retailer");
        }
    }

    /*
     * NOTIFICATION DELIVERY - both helpers are deliberately best-effort: a Feign failure
     * reaching S6 (or resolving the recipient's S1 user account id) is logged and swallowed,
     * never allowed to fail the order-status change that triggered it. Same posture as
     * restoreStockForCancelledOrder() above.
     */
    private void notifyRetailerBestEffort(UUID retailerId, Order order, String type, String title, String message) {
        try {
            UUID recipientUserAccountId = retailerClient.getRetailer(retailerId).userAccountId();
            notificationClient.create(new NotificationCreateRequest(
                    recipientUserAccountId, "RETAILER", type,
                    "ORDER", String.valueOf(order.getId()), title, message));
        } catch (FeignException exception) {
            log.warn("Failed to notify retailer {} about order {}: {}",
                    retailerId, order.getId(), exception.getMessage());
        }
    }

    private void notifyCustomerBestEffort(Order order, String type, String title, String message) {
        try {
            CustomerSummary customer = customerClient.getCustomer(order.getCustomerProfileId());
            notificationClient.create(new NotificationCreateRequest(
                    customer.userAccountId(), "CUSTOMER", type,
                    "ORDER", String.valueOf(order.getId()), title, message));
        } catch (FeignException exception) {
            log.warn("Failed to notify customer about order {}: {}", order.getId(), exception.getMessage());
        }
    }

    /*
     * CUSTOMER TRACKING STEPPER
     *
     * Maps the stored orderStatus (plus, where the stored value is ambiguous, the order's
     * Trip substatus) onto the fixed 9-stage sequence from the requirement. Pure derivation -
     * no new stored fields. RETAILER_REJECTED/SHOP_UNAVAILABLE/CANCELLED are reported via
     * haltedStateOf() instead of being spliced into this linear list.
     */
    private static final String[] STEP_KEYS = {
            "ORDER_PLACED", "WAITING_FOR_RETAILER", "RETAILER_ACCEPTED", "FINDING_DELIVERY_PARTNER",
            "DELIVERY_PARTNER_ACCEPTED", "GOING_TO_SHOP", "ORDER_PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"
    };
    private static final String[] STEP_LABELS = {
            "Order Placed", "Waiting for Retailer", "Retailer Accepted", "Finding Delivery Partner",
            "Delivery Partner Accepted", "Going to Shop", "Order Picked Up", "Out for Delivery", "Delivered"
    };

    /*
     * A FLEET_SERVICE (logistics) booking has no retailer at all - it goes straight from NEW to
     * BOOKING_CONFIRMED (see LogisticsBookingDetailService), never WAITING_FOR_RETAILER/
     * RETAILER_ACCEPTED. Reusing the RETAIL step sequence for it showed those two retailer
     * stages as already "done" on every logistics booking's tracker, which is meaningless noise
     * for a booking that was never routed through a shop.
     */
    private static final String[] LOGISTICS_STEP_KEYS = {
            "BOOKING_PLACED", "BOOKING_CONFIRMED", "DELIVERY_PARTNER_ACCEPTED", "GOING_TO_PICKUP",
            "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"
    };
    private static final String[] LOGISTICS_STEP_LABELS = {
            "Booking Placed", "Booking Confirmed", "Delivery Partner Accepted", "Going to Pickup",
            "Picked Up", "Out for Delivery", "Delivered"
    };

    private String haltedStateOf(String orderStatus) {
        return switch (orderStatus) {
            case "RETAILER_REJECTED", "SHOP_UNAVAILABLE", "CANCELLED" -> orderStatus;
            default -> null;
        };
    }

    private String displayStageOf(Order order) {
        String haltedState = haltedStateOf(order.getOrderStatus());
        if (haltedState != null) {
            return switch (haltedState) {
                case "RETAILER_REJECTED" -> "Retailer Rejected";
                case "SHOP_UNAVAILABLE" -> "Shop Unavailable";
                default -> "Cancelled";
            };
        }
        int currentIndex = currentStepIndex(order);
        return isLogisticsBooking(order) ? LOGISTICS_STEP_LABELS[currentIndex] : STEP_LABELS[currentIndex];
    }

    private boolean isLogisticsBooking(Order order) {
        return "FLEET_SERVICE".equalsIgnoreCase(order.getOrderType());
    }

    /**
     * Index into STEP_KEYS/STEP_LABELS of the order's current stage. "Delivery Partner
     * Accepted" vs "Going to Shop" (both stored as VEHICLE_ASSIGNED) and "Order Picked Up" vs
     * "Out for Delivery" (both stored as IN_TRANSIT) are disambiguated using the order's Trip
     * substatus, since Order itself has no finer-grained stored value for these - Trip has no
     * persisted "arrived at shop" state either (see TripService's acknowledge*Arrival methods),
     * so the moment pickup proof is required (tripStatus=IN_PROGRESS) this treats the order as
     * already "Out for Delivery" rather than trying to model a separate "at the shop" instant.
     */
    private int currentStepIndex(Order order) {
        String status = order.getOrderStatus();
        if (isLogisticsBooking(order)) {
            return switch (status) {
                case "NEW" -> 0;
                case "BOOKING_CONFIRMED" -> 1;
                case "VEHICLE_ASSIGNED" -> {
                    Trip trip = tripRepository.findByOrder_Id(order.getId()).orElse(null);
                    yield trip != null && "ASSIGNED".equals(trip.getTripStatus()) ? 3 : 2;
                }
                case "IN_TRANSIT" -> 5;
                case "DELIVERED" -> 6;
                default -> 0;
            };
        }
        return switch (status) {
            case "NEW", "WAITING_FOR_RETAILER" -> 1;
            case "RETAILER_ACCEPTED" -> 2;
            case "FINDING_DELIVERY_PARTNER", "BOOKING_CONFIRMED" -> 3;
            case "VEHICLE_ASSIGNED" -> {
                Trip trip = tripRepository.findByOrder_Id(order.getId()).orElse(null);
                yield trip != null && "ASSIGNED".equals(trip.getTripStatus()) ? 5 : 4;
            }
            case "IN_TRANSIT" -> 7;
            case "DELIVERED" -> 8;
            default -> 0;
        };
    }

    private List<TrackingStepDto> buildTrackingSteps(Order order) {
        int currentIndex = currentStepIndex(order);
        String[] keys = isLogisticsBooking(order) ? LOGISTICS_STEP_KEYS : STEP_KEYS;
        String[] labels = isLogisticsBooking(order) ? LOGISTICS_STEP_LABELS : STEP_LABELS;
        List<TrackingStepDto> steps = new ArrayList<>(keys.length);
        for (int i = 0; i < keys.length; i++) {
            String state = i < currentIndex ? "DONE" : i == currentIndex ? "CURRENT" : "PENDING";
            LocalDateTime reachedAt = "PENDING".equals(state) ? null : order.getUpdatedDatetime();
            steps.add(new TrackingStepDto(keys[i], labels[i], state, reachedAt));
        }
        return steps;
    }
}
