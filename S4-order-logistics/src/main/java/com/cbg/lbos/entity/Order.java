package com.cbg.lbos.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Indexed on {@code customer_profile_id} (GET /api/orders/mine, one lookup per customer order-list
 * view) and on {@code (order_status, updated_datetime)} - a composite that serves both the
 * every-60-seconds RetailerResponseTimeoutJob scan (equality on status, range on the timestamp)
 * and the plain by-status lookups (findByOrderStatus/findByOrderStatusIn), since a query that only
 * filters on the leading column of a composite index can still use it. Also indexed on
 * {@code (customer_profile_id, order_date)} for the paginated order-history query
 * (findByCustomerProfileIdOrderByOrderDateDesc, GET /api/orders/mine/page) - lets Postgres serve
 * each page's filter+sort directly from the index instead of sorting the customer's full order
 * set on every page fetch.
 */
@Entity
@Table(name = "orders", indexes = {
        @Index(name = "idx_orders_customer_profile_id", columnList = "customer_profile_id"),
        @Index(name = "idx_orders_status_updated_datetime", columnList = "order_status, updated_datetime"),
        @Index(name = "idx_orders_customer_profile_id_order_date", columnList = "customer_profile_id, order_date"),
})
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_id")
    private Long id;
    @Column(name = "order_number", nullable = false)
    private String orderNumber;
    /*
     * customer_profile is owned by S3 (lbos-commerce). Stored as a plain
     * scalar FK - never a JPA relationship to another service's table.
     */
    @Column(name = "customer_profile_id", nullable = false)
    private UUID customerProfileId;
    @Column(name = "order_type", nullable = false)
    private String orderType;
    @Column(name = "order_date", nullable = false)
    private LocalDateTime orderDate;
    @Column(name = "subtotal_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotalAmount;
    @Column(name = "delivery_charge", nullable = false, precision = 12, scale = 2)
    private BigDecimal deliveryCharge;
    @Column(name = "discount_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal discountAmount;
    /*
     * Previously computed for display at checkout (S3 CheckoutServiceImpl.prepare()) but never
     * persisted here, so the amount checkout showed and the amount actually stored/settled on
     * this order silently diverged - GET /api/orders/{id} could never show a tax/platform-fee
     * line because neither was ever stored.
     */
    @Column(name = "tax_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal taxAmount = BigDecimal.ZERO;
    @Column(name = "platform_fee_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal platformFeeAmount = BigDecimal.ZERO;
    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;
    @Column(name = "order_status", nullable = false)
    private String orderStatus;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "status_history_json", nullable = false)
    private String statusHistoryJson;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "order_tracking_json", nullable = false)
    private String orderTrackingJson;
    @Column(name = "delivery_address")
    private String deliveryAddress;
    /*
     * Nullable - only populated for RETAIL orders (deliveryAddress is a formatted string with
     * no coordinates of its own). Used by OrderService.retailerAccept() to find the nearest
     * available fleet owner/driver via S5's haversine-distance search once the retailer
     * accepts the order - see OrderService.findNearestFleetPartner().
     */
    @Column(name = "delivery_latitude", precision = 9, scale = 6)
    private BigDecimal deliveryLatitude;
    @Column(name = "delivery_longitude", precision = 9, scale = 6)
    private BigDecimal deliveryLongitude;
    @Column(name = "payment_method", nullable = false)
    private String paymentMethod;
    @Column(name = "payment_status", nullable = false)
    private String paymentStatus;
    @Column(name = "transaction_reference")
    private String transactionReference;
    @Column(name = "cancellation_reason")
    private String cancellationReason;
    @Column(name = "cancelled_datetime")
    private LocalDateTime cancelledDatetime;
    /*
     * Server-computed cancellation fee (see OrderService.calculateCancellationFee) - only
     * ever set by OrderService when an order transitions to CANCELLED, never by a client.
     */
    @Column(name = "cancellation_fee_amount", precision = 12, scale = 2)
    private BigDecimal cancellationFeeAmount;
    @Column(name = "updated_datetime", nullable = false)
    private LocalDateTime updatedDatetime;

    public Order() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getOrderNumber() {
        return orderNumber;
    }

    public void setOrderNumber(String orderNumber) {
        this.orderNumber = orderNumber;
    }

    public UUID getCustomerProfileId() {
        return customerProfileId;
    }

    public void setCustomerProfileId(UUID customerProfileId) {
        this.customerProfileId = customerProfileId;
    }

    public String getOrderType() {
        return orderType;
    }

    public void setOrderType(String orderType) {
        this.orderType = orderType;
    }

    public LocalDateTime getOrderDate() {
        return orderDate;
    }

    public void setOrderDate(LocalDateTime orderDate) {
        this.orderDate = orderDate;
    }

    public BigDecimal getSubtotalAmount() {
        return subtotalAmount;
    }

    public void setSubtotalAmount(BigDecimal subtotalAmount) {
        this.subtotalAmount = subtotalAmount;
    }

    public BigDecimal getDeliveryCharge() {
        return deliveryCharge;
    }

    public void setDeliveryCharge(BigDecimal deliveryCharge) {
        this.deliveryCharge = deliveryCharge;
    }

    public BigDecimal getDiscountAmount() {
        return discountAmount;
    }

    public void setDiscountAmount(BigDecimal discountAmount) {
        this.discountAmount = discountAmount;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public BigDecimal getTaxAmount() {
        return taxAmount;
    }

    public void setTaxAmount(BigDecimal taxAmount) {
        this.taxAmount = taxAmount;
    }

    public BigDecimal getPlatformFeeAmount() {
        return platformFeeAmount;
    }

    public void setPlatformFeeAmount(BigDecimal platformFeeAmount) {
        this.platformFeeAmount = platformFeeAmount;
    }

    public String getOrderStatus() {
        return orderStatus;
    }

    public void setOrderStatus(String orderStatus) {
        this.orderStatus = orderStatus;
    }

    public String getStatusHistoryJson() {
        return statusHistoryJson;
    }

    public void setStatusHistoryJson(String statusHistoryJson) {
        this.statusHistoryJson = statusHistoryJson;
    }

    public String getOrderTrackingJson() {
        return orderTrackingJson;
    }

    public void setOrderTrackingJson(String orderTrackingJson) {
        this.orderTrackingJson = orderTrackingJson;
    }

    public String getDeliveryAddress() {
        return deliveryAddress;
    }

    public void setDeliveryAddress(String deliveryAddress) {
        this.deliveryAddress = deliveryAddress;
    }

    public BigDecimal getDeliveryLatitude() {
        return deliveryLatitude;
    }

    public void setDeliveryLatitude(BigDecimal deliveryLatitude) {
        this.deliveryLatitude = deliveryLatitude;
    }

    public BigDecimal getDeliveryLongitude() {
        return deliveryLongitude;
    }

    public void setDeliveryLongitude(BigDecimal deliveryLongitude) {
        this.deliveryLongitude = deliveryLongitude;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public String getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(String paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public String getTransactionReference() {
        return transactionReference;
    }

    public void setTransactionReference(String transactionReference) {
        this.transactionReference = transactionReference;
    }

    public String getCancellationReason() {
        return cancellationReason;
    }

    public void setCancellationReason(String cancellationReason) {
        this.cancellationReason = cancellationReason;
    }

    public LocalDateTime getCancelledDatetime() {
        return cancelledDatetime;
    }

    public void setCancelledDatetime(LocalDateTime cancelledDatetime) {
        this.cancelledDatetime = cancelledDatetime;
    }

    public BigDecimal getCancellationFeeAmount() {
        return cancellationFeeAmount;
    }

    public void setCancellationFeeAmount(BigDecimal cancellationFeeAmount) {
        this.cancellationFeeAmount = cancellationFeeAmount;
    }

    public LocalDateTime getUpdatedDatetime() {
        return updatedDatetime;
    }

    public void setUpdatedDatetime(LocalDateTime updatedDatetime) {
        this.updatedDatetime = updatedDatetime;
    }

}
