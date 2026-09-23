package com.lbos.finance.controller;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lbos.finance.dto.PaymentTransactionRequest;
import com.lbos.finance.entity.PaymentTransaction;
import com.lbos.finance.service.PaymentTransactionService;

@RestController
@RequestMapping("/api/payment-transactions")
public class PaymentTransactionController {

    private final PaymentTransactionService paymentTransactionService;

    public PaymentTransactionController(
            PaymentTransactionService paymentTransactionService) {
        this.paymentTransactionService = paymentTransactionService;
    }

    /**
     * A CUSTOMER-role caller can only pay for their own order - see
     * PaymentTransactionServiceImpl.createPaymentTransaction(request, actingCustomerUserAccountId).
     * Staff callers (SUPER_ADMIN/OPERATIONS_MANAGER) skip that check, same as before this
     * endpoint was opened up to customers - see SecurityConfig's carve-out.
     */
    @PostMapping
    public PaymentTransaction createPaymentTransaction(
            @Valid @RequestBody PaymentTransactionRequest paymentTransactionRequest, Authentication authentication) {
        return paymentTransactionService.createPaymentTransaction(
                paymentTransactionRequest, customerOwnerOrNull(authentication));
    }

    private java.util.UUID customerOwnerOrNull(Authentication authentication) {
        boolean isCustomer = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_CUSTOMER".equals(authority.getAuthority()));
        return isCustomer ? java.util.UUID.fromString(authentication.getName()) : null;
    }

    @GetMapping
    public List<PaymentTransaction> getAllPaymentTransactions() {
        return paymentTransactionService.getAllPaymentTransactions();
    }

    @GetMapping("/by-order/{orderId}")
    public List<PaymentTransaction> getByOrderId(@PathVariable Long orderId) {
        return paymentTransactionService.getByOrderId(orderId);
    }

    @GetMapping("/{paymentTransactionId}")
    public PaymentTransaction getPaymentTransactionById(
            @PathVariable UUID paymentTransactionId) {
        return paymentTransactionService.getPaymentTransactionById(
                paymentTransactionId);
    }

    @PostMapping("/{paymentTransactionId}/capture")
    public PaymentTransaction capture(@PathVariable UUID paymentTransactionId) {
        return paymentTransactionService.capture(paymentTransactionId);
    }

    @PostMapping("/{paymentTransactionId}/release-escrow")
    public PaymentTransaction releaseEscrow(@PathVariable UUID paymentTransactionId) {
        return paymentTransactionService.releaseEscrow(paymentTransactionId);
    }

    @PostMapping("/{paymentTransactionId}/fail")
    public PaymentTransaction fail(@PathVariable UUID paymentTransactionId, @RequestBody(required = false) Map<String, String> body) {
        String reason = body == null ? null : body.get("reason");
        return paymentTransactionService.failPayment(paymentTransactionId, reason);
    }
}
