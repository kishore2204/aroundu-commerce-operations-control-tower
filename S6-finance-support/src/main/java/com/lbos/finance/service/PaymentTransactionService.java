package com.lbos.finance.service;

import java.util.List;
import java.util.UUID;

import com.lbos.finance.dto.PaymentTransactionRequest;
import com.lbos.finance.entity.PaymentTransaction;

public interface PaymentTransactionService {

    PaymentTransaction createPaymentTransaction(PaymentTransactionRequest paymentTransactionRequest);

    /**
     * Same as above, but additionally verifies the order belongs to the customer identified by
     * actingCustomerUserAccountId - used when a CUSTOMER-role JWT calls this endpoint directly
     * (see PaymentTransactionController), so one customer can never create a payment
     * transaction against another customer's order. Pass null to skip the check (staff callers,
     * and the single-arg overload above).
     */
    PaymentTransaction createPaymentTransaction(
            PaymentTransactionRequest paymentTransactionRequest, UUID actingCustomerUserAccountId);

    List<PaymentTransaction> getAllPaymentTransactions();

    /** This order's payment transaction(s) - used to resolve a paymentTransactionId for a refund. */
    List<PaymentTransaction> getByOrderId(Long orderId);

    PaymentTransaction getPaymentTransactionById(UUID paymentTransactionId);

    /** PENDING -> SUCCESS, escrow NOT_HELD -> HELD. */
    PaymentTransaction capture(UUID paymentTransactionId);

    /** requires SUCCESS + HELD; escrow HELD -> RELEASED. This is the only path that unlocks
     *  a settlement, since SettlementService requires SUCCESS+RELEASED before accepting one. */
    PaymentTransaction releaseEscrow(UUID paymentTransactionId);

    /** PENDING -> FAILED. */
    PaymentTransaction failPayment(UUID paymentTransactionId, String reason);
}
