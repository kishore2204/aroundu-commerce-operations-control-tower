package com.lbos.finance.entity;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import jakarta.persistence.*;
/** Indexed on the columns SettlementRepository filters on (payment_transaction_id, payee_type +
 *  payee_id) - neither had an index before. */
@Entity
@Table(name = "settlement", indexes = {
        @Index(name = "idx_settlement_payment_transaction_id", columnList = "payment_transaction_id"),
        @Index(name = "idx_settlement_payee", columnList = "payee_type, payee_id"),
})
public class Settlement {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID settlementId;
    private UUID operationsManagerId;
    private UUID paymentTransactionId;
    /** "RETAILER" / "FLEET_OWNER" / "PLATFORM" / null - null means this is the legacy
     *  operations-manager settlement created via the original createSettlement() request-based
     *  flow, not part of an order's retailer/fleet-owner/platform escrow split. */
    private String payeeType;
    /** The retailer/fleet-owner id this settlement pays out to - null for PLATFORM (AroundU
     *  itself has no id to reference) and for legacy operations-manager settlements. */
    private UUID payeeId;
    private String settlementReference;
    private BigDecimal grossAmount;
    private BigDecimal feeAmount;
    private BigDecimal netAmount;
    private String settlementStatus;
    private LocalDate settlementDate;
    private OffsetDateTime createdAt;
    private OffsetDateTime completedAt;
    /** Display name of the payee, resolved when a settlement is read (never stored): the retailer / fleet owner
     *  business name, "AroundU Platform" for PLATFORM, and "N/A" for legacy or unresolvable rows. The payeeId stays
     *  as the internal reference. */
    @Transient
    private String payeeName;
    public String getPayeeName() { return payeeName; }
    public void setPayeeName(String payeeName) { this.payeeName = payeeName; }
    public UUID getSettlementId() { return settlementId; }
    public void setSettlementId(UUID settlementId) { this.settlementId = settlementId; }
    public UUID getOperationsManagerId() { return operationsManagerId; }
    public void setOperationsManagerId(UUID operationsManagerId) { this.operationsManagerId = operationsManagerId; }
    public UUID getPaymentTransactionId() { return paymentTransactionId; }
    public void setPaymentTransactionId(UUID paymentTransactionId) { this.paymentTransactionId = paymentTransactionId; }
    public String getPayeeType() { return payeeType; }
    public void setPayeeType(String payeeType) { this.payeeType = payeeType; }
    public UUID getPayeeId() { return payeeId; }
    public void setPayeeId(UUID payeeId) { this.payeeId = payeeId; }
    public String getSettlementReference() { return settlementReference; }
    public void setSettlementReference(String settlementReference) { this.settlementReference = settlementReference; }
    public BigDecimal getGrossAmount() { return grossAmount; }
    public void setGrossAmount(BigDecimal grossAmount) { this.grossAmount = grossAmount; }
    public BigDecimal getFeeAmount() { return feeAmount; }
    public void setFeeAmount(BigDecimal feeAmount) { this.feeAmount = feeAmount; }
    public BigDecimal getNetAmount() { return netAmount; }
    public void setNetAmount(BigDecimal netAmount) { this.netAmount = netAmount; }
    public String getSettlementStatus() { return settlementStatus; }
    public void setSettlementStatus(String settlementStatus) { this.settlementStatus = settlementStatus; }
    public LocalDate getSettlementDate() { return settlementDate; }
    public void setSettlementDate(LocalDate settlementDate) { this.settlementDate = settlementDate; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(OffsetDateTime completedAt) { this.completedAt = completedAt; }
}
