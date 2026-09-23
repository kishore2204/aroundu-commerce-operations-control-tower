package com.lbos.finance.entity;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import jakarta.persistence.*;
/** Indexed on order_id - findByOrderId/existsByOrderIdAndPaymentStatusNot had no index before. */
@Entity
@Table(name = "payment_transaction", indexes = @Index(name = "idx_payment_transaction_order_id", columnList = "order_id"))
public class PaymentTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID paymentTransactionId;
    private Long orderId;
    private String providerReference;
    private String paymentMethod;
    private String paymentStatus;
    private String escrowStatus;
    private OffsetDateTime heldAt;
    private BigDecimal amount;
    private String currencyCode;
    private OffsetDateTime processedAt;
    public UUID getPaymentTransactionId() { return paymentTransactionId; }
    public void setPaymentTransactionId(UUID paymentTransactionId) { this.paymentTransactionId = paymentTransactionId; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getProviderReference() { return providerReference; }
    public void setProviderReference(String providerReference) { this.providerReference = providerReference; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }
    public String getEscrowStatus() { return escrowStatus; }
    public void setEscrowStatus(String escrowStatus) { this.escrowStatus = escrowStatus; }
    public OffsetDateTime getHeldAt() { return heldAt; }
    public void setHeldAt(OffsetDateTime heldAt) { this.heldAt = heldAt; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getCurrencyCode() { return currencyCode; }
    public void setCurrencyCode(String currencyCode) { this.currencyCode = currencyCode; }
    public OffsetDateTime getProcessedAt() { return processedAt; }
    public void setProcessedAt(OffsetDateTime processedAt) { this.processedAt = processedAt; }
}
