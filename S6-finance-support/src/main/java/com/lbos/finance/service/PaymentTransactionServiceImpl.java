package com.lbos.finance.service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lbos.finance.dto.PaymentTransactionRequest;
import com.lbos.finance.entity.PaymentTransaction;
import com.lbos.finance.exception.BusinessRuleException;
import com.lbos.finance.exception.ResourceNotFoundException;
import com.lbos.finance.integration.client.IdentityServiceClient;
import com.lbos.finance.integration.client.CustomerServiceClient;
import com.lbos.finance.integration.client.OrderServiceClient;
import com.lbos.finance.integration.dto.CustomerProfileResponse;
import com.lbos.finance.integration.dto.OrderResponse;
import com.lbos.finance.integration.dto.UserAccountResponse;
import com.lbos.finance.repository.PaymentTransactionRepository;

/**
 * amount/orderId/paymentMethod are immutable once a transaction is created - a captured
 * payment's recorded amount must never change after the fact. Previously a generic PUT let
 * a caller silently overwrite those fields (re-deriving them from a fresh, possibly stale,
 * order lookup) on an already-processed transaction. State now only moves forward through
 * capture()/releaseEscrow()/failPayment(), each guarded by the transaction's current status.
 */
@Service
@Transactional
public class PaymentTransactionServiceImpl implements PaymentTransactionService {

    private static final Logger log = LoggerFactory.getLogger(PaymentTransactionServiceImpl.class);

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final OrderServiceClient orderServiceClient;
    private final IdentityServiceClient identityServiceClient;
    private final CustomerServiceClient customerServiceClient;

    public PaymentTransactionServiceImpl(
            PaymentTransactionRepository paymentTransactionRepository,
            OrderServiceClient orderServiceClient,
            IdentityServiceClient identityServiceClient,
            CustomerServiceClient customerServiceClient) {

        this.paymentTransactionRepository = paymentTransactionRepository;
        this.orderServiceClient = orderServiceClient;
        this.identityServiceClient = identityServiceClient;
        this.customerServiceClient = customerServiceClient;
    }

    @Override
    public PaymentTransaction createPaymentTransaction(
            PaymentTransactionRequest paymentTransactionRequest) {
        return createPaymentTransaction(paymentTransactionRequest, null);
    }

    @Override
    public PaymentTransaction createPaymentTransaction(
            PaymentTransactionRequest paymentTransactionRequest, UUID actingCustomerUserAccountId) {

        PaymentTransaction paymentTransaction = mapAndValidatePaymentTransaction(
                paymentTransactionRequest, actingCustomerUserAccountId);

        return paymentTransactionRepository.save(paymentTransaction);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentTransaction> getAllPaymentTransactions() {
        return paymentTransactionRepository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentTransaction> getByOrderId(Long orderId) {
        return paymentTransactionRepository.findByOrderId(orderId);
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentTransaction getPaymentTransactionById(
            UUID paymentTransactionId) {

        return paymentTransactionRepository.findById(paymentTransactionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Payment transaction not found: " + paymentTransactionId));
    }

    @Override
    public PaymentTransaction capture(UUID paymentTransactionId) {
        PaymentTransaction paymentTransaction = getPaymentTransactionById(paymentTransactionId);
        if (!"PENDING".equals(paymentTransaction.getPaymentStatus())) {
            throw new BusinessRuleException(
                    "Transaction " + paymentTransactionId + " is not PENDING and cannot be captured");
        }
        paymentTransaction.setPaymentStatus("SUCCESS");
        paymentTransaction.setEscrowStatus("HELD");
        paymentTransaction.setHeldAt(OffsetDateTime.now());
        PaymentTransaction saved = paymentTransactionRepository.save(paymentTransaction);
        confirmPaymentWithOrderServiceBestEffort(saved.getOrderId());
        return saved;
    }

    /**
     * Tells S4 the order's payment succeeded (Order.paymentStatus -> PAID) - see
     * OrderServiceClient.confirmPayment(). Best-effort: a failure here must not fail the
     * capture itself, same posture S4 already uses for its own cross-service calls (e.g.
     * OrderService.restoreStockForCancelledOrder()) - the payment has genuinely succeeded on
     * this side regardless of whether S4 could be told about it right now.
     */
    private void confirmPaymentWithOrderServiceBestEffort(Long orderId) {
        try {
            orderServiceClient.confirmPayment(orderId);
        } catch (RuntimeException exception) {
            log.warn("Failed to notify S4 that payment succeeded for order {}: {}", orderId, exception.getMessage());
        }
    }

    @Override
    public PaymentTransaction releaseEscrow(UUID paymentTransactionId) {
        PaymentTransaction paymentTransaction = getPaymentTransactionById(paymentTransactionId);
        if (!"SUCCESS".equals(paymentTransaction.getPaymentStatus())
                || !"HELD".equals(paymentTransaction.getEscrowStatus())) {
            throw new BusinessRuleException(
                    "Transaction " + paymentTransactionId + " must be SUCCESS/HELD before escrow can be released");
        }
        paymentTransaction.setEscrowStatus("RELEASED");
        paymentTransaction.setProcessedAt(OffsetDateTime.now());
        return paymentTransactionRepository.save(paymentTransaction);
    }

    @Override
    public PaymentTransaction failPayment(UUID paymentTransactionId, String reason) {
        PaymentTransaction paymentTransaction = getPaymentTransactionById(paymentTransactionId);
        if (!"PENDING".equals(paymentTransaction.getPaymentStatus())) {
            throw new BusinessRuleException(
                    "Transaction " + paymentTransactionId + " is not PENDING and cannot be failed");
        }
        paymentTransaction.setPaymentStatus("FAILED");
        paymentTransaction.setProcessedAt(OffsetDateTime.now());
        return paymentTransactionRepository.save(paymentTransaction);
    }

    private PaymentTransaction mapAndValidatePaymentTransaction(
            PaymentTransactionRequest paymentTransactionRequest, UUID actingCustomerUserAccountId) {

        OrderResponse orderResponse = orderServiceClient.getOrderById(
                paymentTransactionRequest.orderId());

        CustomerProfileResponse customerProfileResponse =
                customerServiceClient.getCustomerProfile(
                        orderResponse.customerProfileId());

        if (actingCustomerUserAccountId != null
                && !actingCustomerUserAccountId.equals(customerProfileResponse.userAccountId())) {
            throw new BusinessRuleException("Order does not belong to the authenticated customer");
        }

        UserAccountResponse userAccountResponse =
                identityServiceClient.getUserAccount(
                        customerProfileResponse.userAccountId());

        if (!"ACTIVE".equalsIgnoreCase(
                customerProfileResponse.profileStatus())) {
            throw new BusinessRuleException(
                    "Customer profile is not active");
        }

        if (!"ACTIVE".equalsIgnoreCase(
                userAccountResponse.accountStatus())) {
            throw new BusinessRuleException(
                    "Customer account is not active");
        }

        if ("PAID".equalsIgnoreCase(orderResponse.paymentStatus())) {
            throw new BusinessRuleException(
                    "The order has already been paid");
        }

        if (!orderResponse.paymentMethod().equalsIgnoreCase(
                paymentTransactionRequest.paymentMethod())) {
            throw new BusinessRuleException(
                    "Payment method does not match the order");
        }

        if (orderResponse.totalAmount() == null
                || orderResponse.totalAmount().signum() <= 0) {
            throw new BusinessRuleException(
                    "Order total amount must be greater than zero to create a payment transaction");
        }

        // A local invariant on top of the order's own paymentStatus check above: nothing in
        // S4 calls back into S6 to flip an order's paymentStatus once a payment is captured
        // here, so that Feign-sourced check alone can't prevent a second live payment
        // transaction being opened against the same order from this service. A FAILED
        // transaction doesn't block a retry - only a still-live (PENDING/SUCCESS) one does.
        if (paymentTransactionRepository.existsByOrderIdAndPaymentStatusNot(
                orderResponse.orderId(), "FAILED")) {
            throw new BusinessRuleException(
                    "A payment transaction already exists for order " + orderResponse.orderId());
        }

        PaymentTransaction paymentTransaction = new PaymentTransaction();
        paymentTransaction.setOrderId(orderResponse.orderId());
        paymentTransaction.setPaymentMethod(
                paymentTransactionRequest.paymentMethod());
        paymentTransaction.setAmount(orderResponse.totalAmount());
        paymentTransaction.setPaymentStatus("PENDING");
        paymentTransaction.setEscrowStatus("NOT_HELD");
        paymentTransaction.setCurrencyCode("INR");

        return paymentTransaction;
    }
}
