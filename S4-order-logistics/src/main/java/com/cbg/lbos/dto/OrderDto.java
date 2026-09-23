package com.cbg.lbos.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public class OrderDto {

    private Long id;

    @NotBlank(message = "Order number is required")
    @Size(max = 30, message = "Order number cannot exceed 30 characters")
    private String orderNumber;

    @NotNull(message = "Customer profile ID is required")
    private UUID customerProfileId;

    @NotBlank(message = "Order type is required")
    @Size(max = 30, message = "Order type cannot exceed 30 characters")
    private String orderType;

    private LocalDateTime orderDate;

    @NotNull(message = "Subtotal amount is required")
    @DecimalMin(value = "0.00", message = "Subtotal amount cannot be negative")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal subtotalAmount;

    @NotNull(message = "Delivery charge is required")
    @DecimalMin(value = "0.00", message = "Delivery charge cannot be negative")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal deliveryCharge;

    @NotNull(message = "Discount amount is required")
    @DecimalMin(value = "0.00", message = "Discount amount cannot be negative")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal discountAmount;

    @DecimalMin(value = "0.00", message = "Tax amount cannot be negative")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal taxAmount;

    @DecimalMin(value = "0.00", message = "Platform fee amount cannot be negative")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal platformFeeAmount;

    @NotNull(message = "Total amount is required")
    @DecimalMin(value = "0.00", message = "Total amount cannot be negative")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal totalAmount;

    @NotBlank(message = "Order status is required")
    @Size(max = 20, message = "Order status cannot exceed 20 characters")
    private String orderStatus;

    @NotBlank(message = "Status history JSON is required")
    private String statusHistoryJson;

    @NotBlank(message = "Order tracking JSON is required")
    private String orderTrackingJson;

    @Size(max = 500, message = "Delivery address cannot exceed 500 characters")
    private String deliveryAddress;

    /**
     * Total weight of the order in kg (sum of unit weight x quantity). INTERNAL: only filled in on the
     * fleet-facing GET /api/orders/pending-fleet-assignment, null on every customer-facing read.
     */
    private java.math.BigDecimal totalWeightKg;

    private BigDecimal deliveryLatitude;
    private BigDecimal deliveryLongitude;

    @NotBlank(message = "Payment method is required")
    @Size(max = 30, message = "Payment method cannot exceed 30 characters")
    private String paymentMethod;

    @NotBlank(message = "Payment status is required")
    @Size(max = 25, message = "Payment status cannot exceed 25 characters")
    private String paymentStatus;

    @Size(max = 100, message = "Transaction reference cannot exceed 100 characters")
    private String transactionReference;

    @Size(max = 500, message = "Cancellation reason cannot exceed 500 characters")
    private String cancellationReason;

    private LocalDateTime cancelledDatetime;

    /*
     * Read-only: computed by OrderService.calculateCancellationFee() when an order is
     * cancelled. A value supplied here by a client is ignored - see
     * OrderService.copyDtoToEntity, which never reads this field.
     */
    private BigDecimal cancellationFeeAmount;

    private LocalDateTime updatedDatetime;

    public OrderDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }
    public UUID getCustomerProfileId() { return customerProfileId; }
    public void setCustomerProfileId(UUID customerProfileId) { this.customerProfileId = customerProfileId; }
    public String getOrderType() { return orderType; }
    public void setOrderType(String orderType) { this.orderType = orderType; }
    public LocalDateTime getOrderDate() { return orderDate; }
    public void setOrderDate(LocalDateTime orderDate) { this.orderDate = orderDate; }
    public BigDecimal getSubtotalAmount() { return subtotalAmount; }
    public void setSubtotalAmount(BigDecimal subtotalAmount) { this.subtotalAmount = subtotalAmount; }
    public BigDecimal getDeliveryCharge() { return deliveryCharge; }
    public void setDeliveryCharge(BigDecimal deliveryCharge) { this.deliveryCharge = deliveryCharge; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(BigDecimal discountAmount) { this.discountAmount = discountAmount; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public BigDecimal getTaxAmount() { return taxAmount; }
    public void setTaxAmount(BigDecimal taxAmount) { this.taxAmount = taxAmount; }
    public BigDecimal getPlatformFeeAmount() { return platformFeeAmount; }
    public void setPlatformFeeAmount(BigDecimal platformFeeAmount) { this.platformFeeAmount = platformFeeAmount; }
    public String getOrderStatus() { return orderStatus; }
    public void setOrderStatus(String orderStatus) { this.orderStatus = orderStatus; }
    public String getStatusHistoryJson() { return statusHistoryJson; }
    public void setStatusHistoryJson(String statusHistoryJson) { this.statusHistoryJson = statusHistoryJson; }
    public String getOrderTrackingJson() { return orderTrackingJson; }
    public void setOrderTrackingJson(String orderTrackingJson) { this.orderTrackingJson = orderTrackingJson; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public java.math.BigDecimal getTotalWeightKg() { return totalWeightKg; }
    public void setTotalWeightKg(java.math.BigDecimal totalWeightKg) { this.totalWeightKg = totalWeightKg; }
    public void setDeliveryAddress(String deliveryAddress) { this.deliveryAddress = deliveryAddress; }
    public BigDecimal getDeliveryLatitude() { return deliveryLatitude; }
    public void setDeliveryLatitude(BigDecimal deliveryLatitude) { this.deliveryLatitude = deliveryLatitude; }
    public BigDecimal getDeliveryLongitude() { return deliveryLongitude; }
    public void setDeliveryLongitude(BigDecimal deliveryLongitude) { this.deliveryLongitude = deliveryLongitude; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }
    public String getTransactionReference() { return transactionReference; }
    public void setTransactionReference(String transactionReference) { this.transactionReference = transactionReference; }
    public String getCancellationReason() { return cancellationReason; }
    public void setCancellationReason(String cancellationReason) { this.cancellationReason = cancellationReason; }
    public LocalDateTime getCancelledDatetime() { return cancelledDatetime; }
    public void setCancelledDatetime(LocalDateTime cancelledDatetime) { this.cancelledDatetime = cancelledDatetime; }
    public BigDecimal getCancellationFeeAmount() { return cancellationFeeAmount; }
    public void setCancellationFeeAmount(BigDecimal cancellationFeeAmount) { this.cancellationFeeAmount = cancellationFeeAmount; }
    public LocalDateTime getUpdatedDatetime() { return updatedDatetime; }
    public void setUpdatedDatetime(LocalDateTime updatedDatetime) { this.updatedDatetime = updatedDatetime; }
}
