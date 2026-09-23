package com.cbg.lbos.service;

import com.cbg.lbos.client.CustomerClient;
import com.cbg.lbos.client.InventoryClient;
import com.cbg.lbos.client.ProductClient;
import com.cbg.lbos.client.RetailerClient;
import com.cbg.lbos.client.dto.ApiResponseEnvelope;
import com.cbg.lbos.client.dto.CustomerSummary;
import com.cbg.lbos.client.dto.ProductSummary;
import com.cbg.lbos.client.dto.RetailerSummary;
import com.cbg.lbos.dto.OrderItemDto;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.entity.OrderItem;
import com.cbg.lbos.exception.InsufficientStockException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.repository.OrderItemRepository;
import com.cbg.lbos.repository.OrderRepository;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class OrderItemService {

    /*
     * Order statuses an item can still be created/updated/deleted under. Once an order has
     * moved past this point (vehicle assigned, in transit, delivered, cancelled) its line items
     * are frozen - see requireEditableOrder().
     */
    private static final Set<String> EDITABLE_ORDER_STATUSES = Set.of("NEW", "BOOKING_CONFIRMED");

    private static final Logger log = LoggerFactory.getLogger(OrderItemService.class);

    private final OrderItemRepository orderItemRepository;
    private final OrderRepository orderRepository;
    private final ProductClient productClient;
    private final RetailerClient retailerClient;
    private final CustomerClient customerClient;
    private final InventoryClient inventoryClient;
    private final OrderService orderService;

    public OrderItemService(
            OrderItemRepository orderItemRepository,
            OrderRepository orderRepository,
            ProductClient productClient,
            RetailerClient retailerClient,
            CustomerClient customerClient,
            InventoryClient inventoryClient,
            OrderService orderService) {
        this.orderItemRepository = orderItemRepository;
        this.orderRepository = orderRepository;
        this.productClient = productClient;
        this.retailerClient = retailerClient;
        this.customerClient = customerClient;
        this.inventoryClient = inventoryClient;
        this.orderService = orderService;
    }

    public OrderItemDto create(OrderItemDto dto) {
        OrderItem item = new OrderItem();
        copyDtoToEntity(dto, item);

        /*
         * Deduct stock in S3 BEFORE persisting the item, and only persist if the deduction
         * succeeds - that way a rejected/failed deduction never leaves an order item that
         * claims stock nothing actually reserved. This call crosses into a different service's
         * database, so it is NOT covered by this method's local @Transactional: if the
         * deduction succeeds here but the subsequent save/recalculate fails, S3's stock is not
         * automatically rolled back. A true cross-service compensating transaction (saga) is
         * out of scope for this pass.
         */
        deductStock(item.getProductId(), item.getQuantity());

        OrderItemDto saved = toDto(orderItemRepository.save(item));
        orderService.recalculateTotals(saved.getOrderId());
        return saved;
    }

    @Transactional(readOnly = true)
    public OrderItemDto getById(Long id) {
        return toDto(findItem(id));
    }

    @Transactional(readOnly = true)
    public List<OrderItemDto> getAll() {
        return orderItemRepository.findAll().stream().map(this::toDto).toList();
    }

    /** A single order's line items - lets a customer/retailer see what's actually in an order
     *  (product names, quantities, prices) instead of just its total, without needing the
     *  staff-only getAll(). */
    @Transactional(readOnly = true)
    public List<OrderItemDto> getByOrderId(Long orderId) {
        findRequiredOrder(orderId);
        return orderItemRepository.findByOrder_Id(orderId).stream().map(this::toDto).toList();
    }

    /** The line items of several orders in ONE query (each dto carries its orderId) - replaces one request per order on
     *  the order list. Same visibility as {@link #getByOrderId}; unknown ids simply contribute nothing. Only the stored
     *  snapshot fields are returned (name, quantity, prices, ...): the live product / retailer / customer enrichment of
     *  {@link #getByOrderId} would cost three calls to other services per line, which a list never needs. */
    @Transactional(readOnly = true)
    public List<OrderItemDto> getByOrderIds(java.util.Collection<Long> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) return List.of();
        return orderItemRepository.findByOrder_IdIn(orderIds).stream().map(this::toSnapshotDto).toList();
    }

    public OrderItemDto update(Long id, OrderItemDto dto) {
        OrderItem item = findItem(id);
        // The item's existing order must still be editable - a line item already sitting on a
        // frozen order (VEHICLE_ASSIGNED and beyond) cannot be changed regardless of what the
        // incoming dto asks for.
        requireEditableOrder(item.getOrder());
        Long previousProductId = item.getProductId();
        Integer previousQuantity = item.getQuantity();
        copyDtoToEntity(dto, item);
        adjustStockForQuantityChange(previousProductId, previousQuantity, item.getProductId(), item.getQuantity());
        OrderItemDto saved = toDto(orderItemRepository.save(item));
        orderService.recalculateTotals(saved.getOrderId());
        return saved;
    }

    public void delete(Long id) {
        OrderItem item = findItem(id);
        requireEditableOrder(item.getOrder());
        Long orderId = item.getOrder().getId();
        restoreStock(item.getProductId(), item.getQuantity());
        orderItemRepository.delete(item);
        orderService.recalculateTotals(orderId);
    }

    private OrderItem findItem(Long id) {
        return orderItemRepository.findById(id).orElseThrow(() ->
                new ResourceNotFoundException("Order item not found with ID: " + id));
    }

    /*
     * Rejects create/update/delete once the parent order has moved past the early, still-mutable
     * stage (NEW/BOOKING_CONFIRMED). Closes a real gap: before this check, item mutation was
     * never blocked by order status at all - a line item could be added, changed or removed on
     * an order that was already VEHICLE_ASSIGNED, IN_TRANSIT, DELIVERED or CANCELLED.
     */
    private void requireEditableOrder(Order order) {
        if (!EDITABLE_ORDER_STATUSES.contains(order.getOrderStatus())) {
            throw new IllegalArgumentException(
                    "Order items cannot be modified once the order is " + order.getOrderStatus());
        }
    }

    /*
     * Deducts stock in S3 for a newly created order item. Any Feign-level failure (S3 down/
     * timeout, product not found, or a 422 InsufficientStockException from S3's own atomic
     * removeStock guard) is surfaced as this service's own InsufficientStockException so
     * order-item creation fails cleanly instead of silently succeeding with no stock actually
     * reserved.
     */
    private void deductStock(Long productId, Integer quantity) {
        try {
            inventoryClient.deductStock(productId, new InventoryClient.StockMutationRequest(quantity));
        } catch (FeignException exception) {
            // The raw Feign exception message (S3's own HTTP response, possibly with internal detail)
            // is deliberately not included here - it is never safe to forward verbatim to the client.
            throw new InsufficientStockException(
                    "Unable to reserve " + quantity + " unit(s) of product " + productId + ". Please check the available stock and try again.");
        }
    }

    /*
     * Best-effort restoration - mirrors OrderService.restoreStockForCancelledOrder()'s posture:
     * a downstream hiccup here shouldn't block a legitimate delete/quantity-decrease the caller
     * is already entitled to make. Logged, not thrown. Used by delete() (full restoration) and
     * by adjustStockForQuantityChange() (partial, delta-only restoration).
     */
    private void restoreStock(Long productId, Integer quantity) {
        try {
            inventoryClient.restoreStock(productId, new InventoryClient.StockMutationRequest(quantity));
        } catch (FeignException exception) {
            log.warn("Failed to restore stock in S3 for product {} (qty {}): {}",
                    productId, quantity, exception.getMessage());
        }
    }

    /*
     * update() previously never touched inventory at all - a quantity increase silently
     * reserved nothing extra (real overselling risk: another order could deduct the same units
     * this order's line total now claims), and a quantity decrease never gave the difference
     * back. Confirmed live: changing an item's quantity 3 -> 4 left S3's stock unchanged.
     * Symmetric with create()'s deductStock/delete()'s restoreStock: a same-product quantity
     * change adjusts by the delta only (fail-closed on increase, best-effort on decrease); a
     * product swap is treated as a full restore of the old line plus a full deduct of the new
     * one, since there's no meaningful "delta" between two different products' stock.
     */
    private void adjustStockForQuantityChange(Long previousProductId, Integer previousQuantity,
            Long newProductId, Integer newQuantity) {
        if (!previousProductId.equals(newProductId)) {
            restoreStock(previousProductId, previousQuantity);
            deductStock(newProductId, newQuantity);
            return;
        }
        int delta = newQuantity - previousQuantity;
        if (delta > 0) {
            deductStock(newProductId, delta);
        } else if (delta < 0) {
            restoreStock(newProductId, -delta);
        }
    }

    private void copyDtoToEntity(OrderItemDto dto, OrderItem item) {
        Order order = findRequiredOrder(dto.getOrderId());
        requireEditableOrder(order);
        item.setOrder(order);

        /*
         * retailer lives in S2, which S4 does not call. The scalar FK is
         * stored as supplied.
         */
        item.setRetailerId(dto.getRetailerId());
        item.setProductId(dto.getProductId());

        /*
         * The product itself lives in S3. Fetch it so the line-item snapshot
         * is taken from the authoritative source at write time.
         */
        ProductSummary product = fetchProduct(dto.getProductId());

        item.setSkuSnapshot(product.sku());
        item.setProductNameSnapshot(product.name());
        item.setWeightKgSnapshot(product.weightKg());

        /*
         * unitPrice is always the live catalogue price from S3, never a
         * client-supplied value - a client could otherwise set its own price
         * on an order line. There is no "negotiated price" concept in this
         * service, and nothing here can authorize deviating from the
         * catalogue price anyway.
         */
        BigDecimal unitPrice = product.unitPrice();
        item.setUnitPrice(unitPrice);

        item.setQuantity(dto.getQuantity());

        BigDecimal discountAmount = dto.getDiscountAmount() != null ? dto.getDiscountAmount() : BigDecimal.ZERO;
        BigDecimal grossLineTotal = unitPrice.multiply(BigDecimal.valueOf(dto.getQuantity()));
        if (discountAmount.compareTo(BigDecimal.ZERO) < 0 || discountAmount.compareTo(grossLineTotal) > 0) {
            throw new IllegalArgumentException(
                    "Discount amount must be between 0 and " + grossLineTotal + " for this line item");
        }
        item.setDiscountAmount(discountAmount);

        /*
         * lineTotal is always computed from the server-trusted unitPrice,
         * quantity, and discount - never taken from the client, which
         * previously let a caller set it to anything regardless of the
         * other fields.
         */
        item.setLineTotal(grossLineTotal.subtract(discountAmount));
    }

    private Order findRequiredOrder(Long orderId) {
        if (orderId == null) {
            throw new ResourceNotFoundException("Order not found with ID: " + null);
        }
        return orderRepository.findById(orderId).orElseThrow(() ->
                new ResourceNotFoundException("Order not found with ID: " + orderId));
    }

    /*
     * S3 returns 404 for a missing product. Any Feign-level failure is
     * surfaced as the same "not found" exception this service already used
     * when the product was a local join.
     */
    private ProductSummary fetchProduct(Long productId) {
        if (productId == null) {
            throw new ResourceNotFoundException("Product not found with ID: " + null);
        }

        ApiResponseEnvelope<ProductSummary> response;
        try {
            response = productClient.getProduct(productId);
        } catch (FeignException exception) {
            throw new ResourceNotFoundException(
                    "Product not found with ID: " + productId);
        }

        if (response == null || response.data() == null) {
            throw new ResourceNotFoundException(
                    "Product not found with ID: " + productId);
        }
        return response.data();
    }

    private OrderItemDto toDto(OrderItem item) {
        OrderItemDto dto = toSnapshotDto(item);
        Order order = item.getOrder();

        /*
         * Live enrichment via Feign, resolved fresh on every read (product/retailer/customer
         * details can change after the order line's snapshot was taken). Each lookup is
         * independently resilient: a stale/deleted upstream record or a downed dependency
         * leaves that one nested field null rather than failing the whole response. Note this
         * means getAll() now issues up to 3 extra Feign calls per row (N+1) - acceptable at
         * this training system's scale, intentionally not "fixed" with a batch endpoint here.
         */
        dto.setProduct(fetchProductSummaryQuietly(item.getProductId()));
        dto.setRetailer(fetchRetailerSummaryQuietly(item.getRetailerId()));
        dto.setCustomer(fetchCustomerSummaryQuietly(order.getCustomerProfileId()));

        return dto;
    }

    /** The stored (snapshot) fields of a line - no call to any other service. */
    private OrderItemDto toSnapshotDto(OrderItem item) {
        OrderItemDto dto = new OrderItemDto();
        dto.setId(item.getId());
        Order order = item.getOrder();
        dto.setOrderId(order.getId());
        dto.setRetailerId(item.getRetailerId());
        dto.setProductId(item.getProductId());
        dto.setSkuSnapshot(item.getSkuSnapshot());
        dto.setProductNameSnapshot(item.getProductNameSnapshot());
        dto.setQuantity(item.getQuantity());
        dto.setUnitPrice(item.getUnitPrice());
        dto.setDiscountAmount(item.getDiscountAmount());
        dto.setLineTotal(item.getLineTotal());

        /*
         * deliveryAddress is already stored on the parent Order (a snapshot taken at order
         * creation time) - no Feign call needed, unlike the fields below.
         */
        dto.setDeliveryAddress(order.getDeliveryAddress());
        return dto;
    }

    private ProductSummary fetchProductSummaryQuietly(Long productId) {
        if (productId == null) {
            return null;
        }
        try {
            ApiResponseEnvelope<ProductSummary> response = productClient.getProduct(productId);
            return response != null ? response.data() : null;
        } catch (FeignException exception) {
            return null;
        }
    }

    private RetailerSummary fetchRetailerSummaryQuietly(UUID retailerId) {
        if (retailerId == null) {
            return null;
        }
        try {
            return retailerClient.getRetailer(retailerId);
        } catch (FeignException exception) {
            return null;
        }
    }

    private CustomerSummary fetchCustomerSummaryQuietly(UUID customerProfileId) {
        if (customerProfileId == null) {
            return null;
        }
        try {
            return customerClient.getCustomer(customerProfileId);
        } catch (FeignException exception) {
            return null;
        }
    }
}
