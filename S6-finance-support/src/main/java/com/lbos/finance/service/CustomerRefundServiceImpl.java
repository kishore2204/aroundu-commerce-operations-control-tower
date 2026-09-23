package com.lbos.finance.service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lbos.finance.dto.CustomerRefundRequest;
import com.lbos.finance.dto.CustomerRefundUpdateRequest;
import com.lbos.finance.dto.RefundEligibilityResponse;
import com.lbos.finance.dto.RefundableOrderItemResponse;
import com.lbos.finance.entity.CustomerRefund;
import com.lbos.finance.entity.PaymentTransaction;
import com.lbos.finance.entity.SupportTicket;
import com.lbos.finance.exception.BusinessRuleException;
import com.lbos.finance.exception.ResourceNotFoundException;
import com.lbos.finance.integration.client.CatalogServiceClient;
import com.lbos.finance.integration.client.IdentityServiceClient;
import com.lbos.finance.integration.client.LogisticsServiceClient;
import com.lbos.finance.integration.client.OperationsServiceClient;
import com.lbos.finance.integration.client.OrderServiceClient;
import com.lbos.finance.integration.dto.OrderItemResponse;
import com.lbos.finance.integration.dto.OrderResponse;
import com.lbos.finance.integration.dto.ProductCategoryResponse;
import com.lbos.finance.integration.dto.ProductResponse;
import com.lbos.finance.integration.dto.TripResponse;
import com.lbos.finance.repository.CustomerRefundRepository;
import com.lbos.finance.repository.PaymentTransactionRepository;
import com.lbos.finance.repository.SupportTicketRepository;

/**
 * Refund workflow for support-linked customer claims.
 *
 * <p>The database model already stores the support-ticket id, payment transaction, order-item id,
 * amount and status, so no schema change is required. Eligibility is evaluated from existing
 * ticket/order/trip/payment records and item-level refundable balances are calculated on the
 * backend. Angular only displays these decisions and values.</p>
 *
 * <p>Status flow remains REQUESTED -> APPROVED -> COMPLETED, with REQUESTED -> REJECTED as the
 * negative decision. Rejected amounts do not consume an item's refundable balance.</p>
 */
@Service
@Transactional
public class CustomerRefundServiceImpl implements CustomerRefundService {

    private static final Set<String> REFUND_ELIGIBLE_SUBCATEGORIES = Set.of(
            "ITEM_MISSING",
            "WRONG_ITEM_DELIVERED",
            "ITEM_DAMAGED",
            "RETURN_REQUEST",
            "REPLACEMENT_REQUEST");

    private final CustomerRefundRepository customerRefundRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final SupportTicketRepository supportTicketRepository;
    private final OrderServiceClient orderServiceClient;
    private final IdentityServiceClient identityServiceClient;
    private final CatalogServiceClient catalogServiceClient;
    private final LogisticsServiceClient logisticsServiceClient;
    private final OperationsServiceClient operationsServiceClient;

    public CustomerRefundServiceImpl(
            CustomerRefundRepository customerRefundRepository,
            PaymentTransactionRepository paymentTransactionRepository,
            SupportTicketRepository supportTicketRepository,
            OrderServiceClient orderServiceClient,
            IdentityServiceClient identityServiceClient,
            CatalogServiceClient catalogServiceClient,
            LogisticsServiceClient logisticsServiceClient,
            OperationsServiceClient operationsServiceClient) {
        this.customerRefundRepository = customerRefundRepository;
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.supportTicketRepository = supportTicketRepository;
        this.orderServiceClient = orderServiceClient;
        this.identityServiceClient = identityServiceClient;
        this.catalogServiceClient = catalogServiceClient;
        this.logisticsServiceClient = logisticsServiceClient;
        this.operationsServiceClient = operationsServiceClient;
    }

    @Override
    public CustomerRefund createCustomerRefund(CustomerRefundRequest request) {
        if (request.customerTicketId() == null) {
            throw new BusinessRuleException("A support ticket is required before a refund can be requested");
        }

        RefundEligibilityResponse eligibility = getEligibilityByTicket(request.customerTicketId());
        if (!eligibility.eligible()) {
            throw new BusinessRuleException(eligibility.reason());
        }
        if (eligibility.paymentTransactionId() == null
                || !eligibility.paymentTransactionId().equals(request.paymentTransactionId())) {
            throw new BusinessRuleException("The refund payment transaction does not belong to this eligible ticket/order");
        }

        RefundableOrderItemResponse refundableItem = eligibility.items().stream()
                .filter(item -> item.orderItemId().equals(request.orderItemId()))
                .findFirst()
                .orElseThrow(() -> new BusinessRuleException(
                        "The selected order item is not eligible for another refund"));

        if (request.refundAmount().compareTo(refundableItem.remainingRefundableAmount()) > 0) {
            throw new BusinessRuleException(
                    "Refund amount " + request.refundAmount()
                            + " exceeds the remaining refundable amount of "
                            + refundableItem.remainingRefundableAmount() + " for this item");
        }

        PaymentTransaction paymentTransaction = paymentTransactionRepository.findById(request.paymentTransactionId())
                .orElseThrow(() -> new ResourceNotFoundException("Payment transaction not found"));

        OrderResponse orderResponse = orderServiceClient.getOrderById(paymentTransaction.getOrderId());
        OrderItemResponse orderItemResponse = orderServiceClient.getOrderItems(orderResponse.orderId()).stream()
                .filter(orderItem -> orderItem.orderItemId().equals(request.orderItemId()))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Order item not found"));

        String reason = request.reason().trim();
        // Category is useful for later support analysis, but a catalog lookup must never make an
        // otherwise valid refund workflow fail. Enrich best-effort using the existing S3 APIs.
        try {
            ProductResponse productResponse = catalogServiceClient.getProduct(orderItemResponse.productId());
            if (productResponse != null && productResponse.categoryId() != null) {
                ProductCategoryResponse category = catalogServiceClient.getProductCategory(productResponse.categoryId());
                if (category != null && category.name() != null && !category.name().isBlank()) {
                    reason = reason + " | Category: " + category.name();
                }
            }
        } catch (Exception ignored) {
            // Keep the customer's/support agent's reason without category enrichment.
        }

        CustomerRefund entity = new CustomerRefund();
        entity.setCustomerTicketId(request.customerTicketId());
        entity.setPaymentTransactionId(request.paymentTransactionId());
        entity.setOrderItemId(request.orderItemId());
        entity.setRefundReference(
                request.refundReference() == null || request.refundReference().isBlank()
                        ? generateRefundReference()
                        : request.refundReference().trim());
        entity.setRefundAmount(request.refundAmount());
        entity.setReason(reason);
        entity.setRefundStatus("REQUESTED");
        entity.setRequestedAt(OffsetDateTime.now());
        return customerRefundRepository.save(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public RefundEligibilityResponse getEligibilityByTicket(UUID customerTicketId) {
        SupportTicket ticket = supportTicketRepository.findById(customerTicketId)
                .orElseThrow(() -> new ResourceNotFoundException("SupportTicket not found: " + customerTicketId));

        if (!"CUSTOMER".equals(ticket.getRaisedByRole())) {
            return ineligible("Refunds can only be created from a customer support ticket");
        }
        if ("CLOSED".equals(ticket.getTicketStatus())) {
            return ineligible("This ticket is already closed; no new refund can be requested");
        }
        if (!REFUND_ELIGIBLE_SUBCATEGORIES.contains(ticket.getTicketSubCategory())) {
            return ineligible("This ticket type is not eligible for an item refund. Support can still resolve or escalate the ticket normally.");
        }
        if (ticket.getOrderId() == null) {
            return ineligible("This ticket is not linked to an order");
        }

        OrderResponse order;
        try {
            order = orderServiceClient.getOrderById(ticket.getOrderId());
        } catch (Exception e) {
            return ineligible("The linked order could not be loaded");
        }
        if (!"DELIVERED".equalsIgnoreCase(order.orderStatus())) {
            return ineligible("Only a delivered order is eligible for this refund workflow");
        }

        try {
            TripResponse trip = logisticsServiceClient.getTripByOrderId(ticket.getOrderId());
            if (trip == null || !"COMPLETED".equalsIgnoreCase(trip.tripStatus())) {
                return ineligible("Delivery must be completed before a refund can be requested");
            }
        } catch (Exception e) {
            return ineligible("A completed delivery trip could not be verified for this order");
        }

        PaymentTransaction successfulPayment = paymentTransactionRepository.findByOrderId(ticket.getOrderId()).stream()
                .filter(payment -> "SUCCESS".equalsIgnoreCase(payment.getPaymentStatus()))
                .max(Comparator.comparing(
                        PaymentTransaction::getProcessedAt,
                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElse(null);
        if (successfulPayment == null) {
            return ineligible("No successful payment transaction exists for this order");
        }

        List<OrderItemResponse> orderItems;
        try {
            orderItems = orderServiceClient.getOrderItems(ticket.getOrderId());
        } catch (Exception e) {
            return ineligible("Order items could not be loaded for refund review");
        }

        List<RefundableOrderItemResponse> refundableItems = orderItems.stream()
                .filter(item -> item.orderItemId() != null && item.lineTotal() != null && item.lineTotal().signum() > 0)
                .map(item -> {
                    BigDecimal alreadyRequested = zeroIfNull(
                            customerRefundRepository.sumNonRejectedRefundAmountForItem(
                                    successfulPayment.getPaymentTransactionId(), item.orderItemId()));
                    BigDecimal remaining = item.lineTotal().subtract(alreadyRequested).max(BigDecimal.ZERO);
                    return new RefundableOrderItemResponse(
                            item.orderItemId(),
                            item.productNameSnapshot(),
                            item.quantity(),
                            item.lineTotal(),
                            alreadyRequested,
                            remaining);
                })
                .filter(item -> item.remainingRefundableAmount().signum() > 0)
                .toList();

        if (refundableItems.isEmpty()) {
            return new RefundEligibilityResponse(
                    false,
                    "Every item in this order has already used its refundable balance",
                    successfulPayment.getPaymentTransactionId(),
                    List.of());
        }

        return new RefundEligibilityResponse(
                true,
                "Eligible for item-level refund review",
                successfulPayment.getPaymentTransactionId(),
                refundableItems);
    }

    private RefundEligibilityResponse ineligible(String reason) {
        return new RefundEligibilityResponse(false, reason, null, List.of());
    }

    private BigDecimal zeroIfNull(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String generateRefundReference() {
        return "RF-" + OffsetDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS"));
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerRefund> getAllCustomerRefunds() {
        return customerRefundRepository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public CustomerRefund getCustomerRefundById(UUID id) {
        return customerRefundRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CustomerRefund not found: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerRefund> getByTicket(UUID customerTicketId) {
        return customerRefundRepository.findByCustomerTicketId(customerTicketId);
    }

    @Override
    public CustomerRefund updateCustomerRefund(UUID id, CustomerRefundUpdateRequest request) {
        CustomerRefund existing = getCustomerRefundById(id);
        if (!"REQUESTED".equals(existing.getRefundStatus())) {
            throw new BusinessRuleException(
                    "Refund " + id + " has already been " + existing.getRefundStatus() + " and can no longer be edited");
        }
        if (request.refundReference() != null) {
            existing.setRefundReference(request.refundReference());
        }
        if (request.reason() != null) {
            existing.setReason(request.reason());
        }
        return customerRefundRepository.save(existing);
    }

    @Override
    public CustomerRefund approveRefund(UUID id) {
        CustomerRefund existing = requireStatus(id, "REQUESTED", "approved");
        existing.setRefundStatus("APPROVED");
        return customerRefundRepository.save(existing);
    }

    @Override
    public CustomerRefund rejectRefund(UUID id, String reason) {
        CustomerRefund existing = requireStatus(id, "REQUESTED", "rejected");
        existing.setRefundStatus("REJECTED");
        if (reason != null && !reason.isBlank()) {
            existing.setReason(existing.getReason() + " | Rejection: " + reason.trim());
        }
        existing.setProcessedAt(OffsetDateTime.now());
        return customerRefundRepository.save(existing);
    }

    @Override
    public CustomerRefund completeRefund(UUID id) {
        CustomerRefund existing = requireStatus(id, "APPROVED", "completed");
        existing.setRefundStatus("COMPLETED");
        existing.setProcessedAt(OffsetDateTime.now());
        return customerRefundRepository.save(existing);
    }

    private CustomerRefund requireStatus(UUID id, String requiredStatus, String action) {
        CustomerRefund existing = getCustomerRefundById(id);
        if (!requiredStatus.equals(existing.getRefundStatus())) {
            throw new BusinessRuleException(
                    "Refund " + id + " must be " + requiredStatus + " before it can be " + action
                            + " (currently " + existing.getRefundStatus() + ")");
        }
        return existing;
    }

    @Override
    public void deleteCustomerRefund(UUID id) {
        CustomerRefund existing = getCustomerRefundById(id);
        if (!"REQUESTED".equals(existing.getRefundStatus())) {
            throw new BusinessRuleException(
                    "Only a REQUESTED refund may be withdrawn; " + id + " is already " + existing.getRefundStatus());
        }
        customerRefundRepository.delete(existing);
    }
}
