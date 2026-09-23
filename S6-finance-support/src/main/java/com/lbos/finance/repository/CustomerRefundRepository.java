package com.lbos.finance.repository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.lbos.finance.entity.CustomerRefund;
public interface CustomerRefundRepository extends JpaRepository<CustomerRefund, UUID> {

    List<CustomerRefund> findByPaymentTransactionId(UUID paymentTransactionId);

    /** Refund requests already logged for a given support ticket - lets the ticket-detail view
     *  show existing approve/reject state instead of re-prompting to create a duplicate. */
    List<CustomerRefund> findByCustomerTicketId(UUID customerTicketId);

    /** Excludes REJECTED refunds from the running total, since a rejected refund never paid out. */
    @Query("select coalesce(sum(r.refundAmount), 0) from CustomerRefund r "
            + "where r.paymentTransactionId = :paymentTransactionId and r.refundStatus <> 'REJECTED'")
    BigDecimal sumNonRejectedRefundAmount(@Param("paymentTransactionId") UUID paymentTransactionId);

    /** Item-level equivalent used to prevent one line item being refunded beyond its own value. */
    @Query("select coalesce(sum(r.refundAmount), 0) from CustomerRefund r "
            + "where r.paymentTransactionId = :paymentTransactionId and r.orderItemId = :orderItemId "
            + "and r.refundStatus <> 'REJECTED'")
    BigDecimal sumNonRejectedRefundAmountForItem(
            @Param("paymentTransactionId") UUID paymentTransactionId,
            @Param("orderItemId") Long orderItemId);

    /** Sums only fully COMPLETED refunds, for use as the refund-rate numerator. */
    @Query("select coalesce(sum(r.refundAmount), 0) from CustomerRefund r where r.refundStatus = 'COMPLETED'")
    BigDecimal sumCompletedRefundAmount();
}
