package com.lbos.finance.repository;

import java.math.BigDecimal;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.lbos.finance.entity.PaymentTransaction;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, UUID> {

    @Query("select coalesce(sum(paymentTransaction.amount), 0) from PaymentTransaction paymentTransaction")
    BigDecimal sumRecordedPaymentAmount();

    /** Sums only successfully captured payments, for use as the refund-rate denominator. */
    @Query("select coalesce(sum(paymentTransaction.amount), 0) from PaymentTransaction paymentTransaction "
            + "where paymentTransaction.paymentStatus = 'SUCCESS'")
    BigDecimal sumSuccessfulPaymentAmount();

    /**
     * Used to reject a duplicate payment attempt against an order that already has a live
     * (non-FAILED) transaction. A FAILED transaction doesn't count, since it must be
     * possible to retry payment for an order after a declined attempt.
     */
    boolean existsByOrderIdAndPaymentStatusNot(Long orderId, String paymentStatus);

    /** Used to resolve the paymentTransactionId needed to raise a refund for a given order
     *  (e.g. from a support ticket's damaged-item claim), without the caller having to already
     *  know the transaction id. */
    java.util.List<PaymentTransaction> findByOrderId(Long orderId);
}
