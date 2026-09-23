package com.cbg.lbos.controller;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.cbg.lbos.dto.ReviewEligibilityResponse;
import com.cbg.lbos.client.ProductClient;
import com.cbg.lbos.client.dto.ApiResponseEnvelope;
import com.cbg.lbos.client.dto.ProductSummary;
import com.cbg.lbos.dto.client.LineServiceabilityResult;
import com.cbg.lbos.dto.client.ServiceabilityRequest;
import com.cbg.lbos.dto.client.ServiceabilityResponse;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.entity.OrderItem;
import com.cbg.lbos.entity.Trip;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.repository.OrderItemRepository;
import com.cbg.lbos.repository.OrderRepository;
import com.cbg.lbos.repository.TripRepository;
import com.cbg.lbos.service.OrderService;

/**
 * Service-to-service endpoints consumed by S3's {@code OrderLogisticsClient} and S6's
 * {@code OrderServiceClient}/{@code LogisticsServiceClient}.
 * {@code review-eligibility} is derived from existing Order/OrderItem data.
 * {@code POST /api/v1/internal/delivery/serviceability-checks} is implemented as a small,
 * deterministic retail-delivery check. It validates the address scope supplied by S3 and
 * confirms every requested product is active and in stock through S3's Product API. Because
 * the 34-entity model contains no retail fare table, the demo uses a documented flat INR 49
 * delivery charge; the fleet-service booking path keeps its existing detailed fare engine.
 *
 * {@code /orders/{orderId}}, {@code /orders/{orderId}/items} and {@code /trips/by-order/{id}}
 * were added for S6, whose OrderServiceClient/LogisticsServiceClient previously called
 * unauthenticated, nonexistent paths ("/api/orders/{id}/items", "/api/trips/orders/{id}") -
 * every S6 flow that touches an order (refunds, invoices, payments, support tickets) was
 * failing outright. These response shapes deliberately match S6's OrderResponse/
 * OrderItemResponse/TripResponse field names exactly (orderId not id, tripId not id, etc.) -
 * Jackson silently nulls out any field it can't match by name.
 */
@RestController
@RequestMapping("/api/v1/internal")
public class InternalOrderLogisticsController {

    private static final String DELIVERED_STATUS = "DELIVERED";

    public record InternalOrderResponse(
            Long orderId, String orderNumber, UUID customerProfileId, String orderType,
            java.time.LocalDateTime orderDate, BigDecimal subtotalAmount, BigDecimal deliveryCharge,
            BigDecimal discountAmount, BigDecimal taxAmount, BigDecimal platformFeeAmount, BigDecimal totalAmount,
            String orderStatus, String paymentMethod,
            String paymentStatus, String transactionReference, OffsetDateTime deliveredAt,
            String deliveryAddress) {
    }

    public record InternalOrderItemResponse(
            Long orderItemId, Long orderId, UUID retailerId, Long productId, String skuSnapshot,
            String productNameSnapshot, Integer quantity, BigDecimal unitPrice, BigDecimal discountAmount,
            BigDecimal lineTotal) {
    }

    public record InternalTripResponse(
            UUID tripId, Long orderId, UUID vehicleId, UUID driverId, UUID fleetOwnerId, String tripStatus,
            OffsetDateTime completedAt, String proofOfDelivery) {
    }

    public record OrderStatsRequest(java.util.Collection<UUID> retailerIds, java.time.LocalDateTime from, java.time.LocalDateTime to) {
    }

    public record OrderStatsResponse(long activeOrders, long completedOrders) {
    }

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final TripRepository tripRepository;
    private final ProductClient productClient;
    private final OrderService orderService;

    public InternalOrderLogisticsController(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            TripRepository tripRepository,
            ProductClient productClient,
            OrderService orderService) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.tripRepository = tripRepository;
        this.productClient = productClient;
        this.orderService = orderService;
    }

    /**
     * Called by S6's PaymentTransactionServiceImpl.capture() once a simulated payment
     * transaction succeeds - see that class's own note on why nothing previously closed this
     * loop. Best-effort from S6's side (a failure here must not fail the payment capture
     * itself); this endpoint itself is a plain, idempotent field update.
     */
    /**
     * Order counts for a set of retailers (S2's Location Manager dashboard passes the retailers of one zone): orders
     * still in progress right now, and orders delivered inside the requested window. Same status definitions as the
     * rest of S4 - in progress = not one of OrderService.TERMINAL_ORDER_STATUSES, completed = DELIVERED.
     */
    @PostMapping("/orders/stats")
    public OrderStatsResponse orderStats(@RequestBody OrderStatsRequest request) {
        if (request.retailerIds() == null || request.retailerIds().isEmpty()) {
            return new OrderStatsResponse(0, 0);
        }
        java.time.LocalDateTime from = request.from() == null ? java.time.LocalDateTime.of(2000, 1, 1, 0, 0) : request.from();
        java.time.LocalDateTime to = request.to() == null ? java.time.LocalDateTime.now().plusDays(1) : request.to();
        return new OrderStatsResponse(
                orderRepository.countInProgressForRetailers(request.retailerIds(), OrderService.TERMINAL_ORDER_STATUSES),
                orderRepository.countDeliveredForRetailers(request.retailerIds(), from, to));
    }

    @PostMapping("/orders/{orderId}/payment-confirmed")
    public ResponseEntity<Void> paymentConfirmed(@PathVariable Long orderId) {
        orderService.markPaymentConfirmed(orderId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/orders/{orderId}")
    public InternalOrderResponse getOrder(@PathVariable Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
        return toOrderResponse(order);
    }

    @GetMapping("/orders/{orderId}/items")
    public List<InternalOrderItemResponse> getOrderItems(@PathVariable Long orderId) {
        if (!orderRepository.existsById(orderId)) {
            throw new ResourceNotFoundException("Order not found: " + orderId);
        }
        return orderItemRepository.findByOrder_Id(orderId).stream()
                .map(this::toOrderItemResponse)
                .toList();
    }

    @GetMapping("/trips/by-order/{orderId}")
    public InternalTripResponse getTripByOrder(@PathVariable Long orderId) {
        Trip trip = tripRepository.findByOrder_Id(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("No trip found for order: " + orderId));
        return new InternalTripResponse(
                trip.getId(), orderId, trip.getVehicleId(), trip.getDriverId(), trip.getFleetOwnerId(),
                trip.getTripStatus(), trip.getCompletedAt(), trip.getProofOfDelivery());
    }

    /** Consumed by S6 to resolve "complaints on my trips" for a driver, without exposing the
     *  tickets themselves here - just the distinct order ids this driver has ever been assigned. */
    @GetMapping("/trips/by-driver/{driverId}")
    public List<Long> getOrderIdsForDriver(@PathVariable UUID driverId) {
        return tripRepository.findByDriverId(driverId).stream().map(trip -> trip.getOrder().getId()).toList();
    }

    private InternalOrderResponse toOrderResponse(Order order) {
        OffsetDateTime deliveredAt = DELIVERED_STATUS.equalsIgnoreCase(order.getOrderStatus()) && order.getUpdatedDatetime() != null
                ? order.getUpdatedDatetime().atZone(ZoneId.systemDefault()).toOffsetDateTime()
                : null;
        return new InternalOrderResponse(
                order.getId(), order.getOrderNumber(), order.getCustomerProfileId(), order.getOrderType(),
                order.getOrderDate(), order.getSubtotalAmount(), order.getDeliveryCharge(), order.getDiscountAmount(),
                order.getTaxAmount(), order.getPlatformFeeAmount(),
                order.getTotalAmount(), order.getOrderStatus(), order.getPaymentMethod(), order.getPaymentStatus(),
                order.getTransactionReference(), deliveredAt, order.getDeliveryAddress());
    }

    private InternalOrderItemResponse toOrderItemResponse(OrderItem item) {
        return new InternalOrderItemResponse(
                item.getId(), item.getOrder().getId(), item.getRetailerId(), item.getProductId(),
                item.getSkuSnapshot(), item.getProductNameSnapshot(), item.getQuantity(), item.getUnitPrice(),
                item.getDiscountAmount(), item.getLineTotal());
    }

    /*
     * Retail delivery pricing is intentionally simple for the training/demo application
     * because no retail fare table exists in the 34-entity model. Fleet-service bookings use
     * the richer S4 logistics cost engine.
     */
    private static final BigDecimal RETAIL_DELIVERY_CHARGE = new BigDecimal("49.00");
    private static final String RETAIL_DELIVERY_ESTIMATE = "30-60 minutes";
    /** Upper bound of {@link #RETAIL_DELIVERY_ESTIMATE} - the customer tracking ETA counts down to it. */
    public static final int RETAIL_DELIVERY_ESTIMATE_MAX_MINUTES = 60;

    /**
     * Checks each requested product/retailer separately and returns one line result per
     * product, rather than failing the whole request closed on the first unserviceable line -
     * a multi-retailer cart must be able to show "this product isn't serviceable" for one
     * retailer while the rest of the cart stays valid. The top-level serviceable/deliveryCharge/
     * estimate/reasonCode fields remain a whole-cart aggregate for callers that don't need the
     * per-line breakdown (serviceable is true only when every line is serviceable).
     */
    @PostMapping("/delivery/serviceability-checks")
    public ResponseEntity<ServiceabilityResponse> serviceability(
            @RequestBody ServiceabilityRequest request) {

        if (request == null || request.addressId() == null
                || request.cityId() == null || request.zoneId() == null) {
            return ResponseEntity.ok(new ServiceabilityResponse(
                    false, BigDecimal.ZERO, null, "INVALID_ADDRESS", List.of()));
        }

        if (request.productIds() == null || request.productIds().isEmpty()) {
            return ResponseEntity.ok(new ServiceabilityResponse(
                    false, BigDecimal.ZERO, null, "EMPTY_CART", List.of()));
        }

        java.util.Map<Long, ProductSummary> productsById = fetchProducts(request.productIds());
        List<LineServiceabilityResult> lines = new java.util.ArrayList<>();
        for (Long productId : request.productIds()) {
            lines.add(checkLine(productId, productsById));
        }

        boolean allServiceable = lines.stream().allMatch(LineServiceabilityResult::serviceable);
        // Surfaces the first blocking line's own reasonCode at the aggregate level (rather than
        // a generic "some line failed" constant) so a single-retailer cart's aggregate response
        // is unchanged from before this per-line breakdown existed.
        String aggregateReasonCode = allServiceable ? null : lines.stream()
                .filter(line -> !line.serviceable())
                .map(LineServiceabilityResult::reasonCode)
                .findFirst()
                .orElse(null);

        return ResponseEntity.ok(new ServiceabilityResponse(
                allServiceable,
                allServiceable ? RETAIL_DELIVERY_CHARGE : BigDecimal.ZERO,
                allServiceable ? RETAIL_DELIVERY_ESTIMATE : null,
                aggregateReasonCode,
                lines));
    }

    /**
     * Every distinct product on the checkout in ONE Feign call instead of one call per line - a
     * live network trace measured the old per-line loop as the dominant cost of
     * /checkout/prepare (~340ms for just a 2-line, single-retailer cart, scaling linearly with
     * cart size). A failed batch call (S3 unreachable) leaves every id unresolved, which
     * checkLine() below reports as COMMERCE_SERVICE_UNAVAILABLE per line - the same outcome the
     * old per-line FeignException catch produced for a downed S3.
     */
    private java.util.Map<Long, ProductSummary> fetchProducts(List<Long> productIds) {
        List<Long> distinctIds = productIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (distinctIds.isEmpty()) {
            return java.util.Map.of();
        }
        try {
            ApiResponseEnvelope<List<ProductSummary>> response = productClient.getProductsByIds(distinctIds);
            List<ProductSummary> products = response == null ? null : response.data();
            if (products == null) {
                return java.util.Map.of();
            }
            return products.stream().collect(java.util.stream.Collectors.toMap(ProductSummary::id, p -> p, (a, b) -> a));
        } catch (feign.FeignException exception) {
            return java.util.Map.of();
        }
    }

    private LineServiceabilityResult checkLine(Long productId, java.util.Map<Long, ProductSummary> productsById) {
        if (productId == null) {
            return new LineServiceabilityResult(null, null, false, "INVALID_PRODUCT", BigDecimal.ZERO, null);
        }

        ProductSummary product = productsById.get(productId);
        // Absent covers everything a per-id call used to catch as a FeignException (genuinely
        // not found, inactive, its shop currently closed, or S3 unreachable) - see getByIds()
        // on the S3 side, which omits exactly these cases from its response rather than 404ing
        // per id.
        if (product == null) {
            return new LineServiceabilityResult(productId, null, false, "COMMERCE_SERVICE_UNAVAILABLE", BigDecimal.ZERO, null);
        }
        if (!"ACTIVE".equalsIgnoreCase(product.status())) {
            return new LineServiceabilityResult(
                    productId, product.retailerId(), false, "PRODUCT_NOT_ACTIVE", BigDecimal.ZERO, null);
        }
        if (product.stock() <= 0) {
            return new LineServiceabilityResult(
                    productId, product.retailerId(), false, "PRODUCT_OUT_OF_STOCK", BigDecimal.ZERO, null);
        }
        return new LineServiceabilityResult(
                productId, product.retailerId(), true, null, RETAIL_DELIVERY_CHARGE, RETAIL_DELIVERY_ESTIMATE);
    }

    /**
     * Answers "has this customer ever purchased/received this product" without the caller
     * already knowing an orderId (unlike /orders/{orderId}/review-eligibility below, which
     * requires one) - backs the product-detail page deciding up front whether to even show a
     * "Write a review" action, instead of asking the customer to type an Order ID and guessing
     * at the error if they never bought it.
     */
    @GetMapping("/orders/eligible-order-for-review")
    public ResponseEntity<ReviewEligibilityResponse> eligibleOrderForReview(
            @RequestParam UUID customerProfileId,
            @RequestParam Long productId) {
        List<Long> orderIds = orderItemRepository.findDeliveredOrderIdsForCustomerAndProduct(customerProfileId, productId);
        if (orderIds.isEmpty()) {
            return ResponseEntity.ok(new ReviewEligibilityResponse(false, null, customerProfileId, productId, "NEVER_PURCHASED"));
        }
        return ResponseEntity.ok(new ReviewEligibilityResponse(true, orderIds.get(0), customerProfileId, productId, null));
    }

    @GetMapping("/orders/{orderId}/review-eligibility")
    public ResponseEntity<ReviewEligibilityResponse> reviewEligibility(
            @PathVariable Long orderId,
            @RequestParam UUID customerProfileId,
            @RequestParam Long productId) {

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));

        if (!order.getCustomerProfileId().equals(customerProfileId)) {
            return ResponseEntity.ok(new ReviewEligibilityResponse(false, orderId, customerProfileId, productId, "NOT_ORDER_OWNER"));
        }
        if (!DELIVERED_STATUS.equalsIgnoreCase(order.getOrderStatus())) {
            return ResponseEntity.ok(new ReviewEligibilityResponse(false, orderId, customerProfileId, productId, "ORDER_NOT_DELIVERED"));
        }
        if (!orderItemRepository.existsByOrder_IdAndProductId(orderId, productId)) {
            return ResponseEntity.ok(new ReviewEligibilityResponse(false, orderId, customerProfileId, productId, "PRODUCT_NOT_IN_ORDER"));
        }
        return ResponseEntity.ok(new ReviewEligibilityResponse(true, orderId, customerProfileId, productId, null));
    }
}
