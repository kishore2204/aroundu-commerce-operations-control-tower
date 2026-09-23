package com.lbos.finance.repository;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import com.lbos.finance.entity.Settlement;
public interface SettlementRepository extends JpaRepository<Settlement, UUID> {
    boolean existsByPaymentTransactionId(UUID paymentTransactionId);

    /** Idempotency guard for the retailer/fleet-owner escrow split - a repeat call for the
     *  same order/payee is a safe no-op instead of double-crediting. */
    boolean existsByPaymentTransactionIdAndPayeeTypeAndPayeeId(UUID paymentTransactionId, String payeeType, UUID payeeId);

    /** Same idempotency guard for the PLATFORM payee, which has no payeeId to key on. */
    boolean existsByPaymentTransactionIdAndPayeeType(UUID paymentTransactionId, String payeeType);

    java.util.List<Settlement> findByPaymentTransactionId(UUID paymentTransactionId);

    /** A retailer's / fleet owner's OWN settlements - served by idx_settlement_payee (payee_type, payee_id). */
    java.util.List<Settlement> findByPayeeTypeAndPayeeId(String payeeType, UUID payeeId);

    /** Sums the fee taken across all settlements, for use as the settlement-fee-ratio numerator. */
    @Query("select coalesce(sum(s.feeAmount), 0) from Settlement s")
    BigDecimal sumFeeAmount();

    /** Sums the gross settled amount across all settlements, for use as the settlement-fee-ratio denominator. */
    @Query("select coalesce(sum(s.grossAmount), 0) from Settlement s")
    BigDecimal sumGrossAmount();
}
