package com.lbos.finance.entity;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import jakarta.persistence.*;
@Entity
@Table(name = "customer_refund")
public class CustomerRefund {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID customerRefundId;
    private UUID customerTicketId;
    private UUID paymentTransactionId;
    private Long orderItemId;
    private String refundReference;
    private BigDecimal refundAmount;
    private String refundStatus;
    private String reason;
    private OffsetDateTime requestedAt;
    private OffsetDateTime processedAt;
    public UUID getCustomerRefundId() { return customerRefundId; }
    public void setCustomerRefundId(UUID customerRefundId) { this.customerRefundId = customerRefundId; }
    public UUID getCustomerTicketId() { return customerTicketId; }
    public void setCustomerTicketId(UUID customerTicketId) { this.customerTicketId = customerTicketId; }
    public UUID getPaymentTransactionId() { return paymentTransactionId; }
    public void setPaymentTransactionId(UUID paymentTransactionId) { this.paymentTransactionId = paymentTransactionId; }
    public Long getOrderItemId() { return orderItemId; }
    public void setOrderItemId(Long orderItemId) { this.orderItemId = orderItemId; }
    public String getRefundReference() { return refundReference; }
    public void setRefundReference(String refundReference) { this.refundReference = refundReference; }
    public BigDecimal getRefundAmount() { return refundAmount; }
    public void setRefundAmount(BigDecimal refundAmount) { this.refundAmount = refundAmount; }
    public String getRefundStatus() { return refundStatus; }
    public void setRefundStatus(String refundStatus) { this.refundStatus = refundStatus; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public OffsetDateTime getRequestedAt() { return requestedAt; }
    public void setRequestedAt(OffsetDateTime requestedAt) { this.requestedAt = requestedAt; }
    public OffsetDateTime getProcessedAt() { return processedAt; }
    public void setProcessedAt(OffsetDateTime processedAt) { this.processedAt = processedAt; }
}
