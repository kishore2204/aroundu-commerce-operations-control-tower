package com.lbos.finance.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lbos.finance.dto.AnalyticsOverviewResponse;
import com.lbos.finance.dto.RefundRegionInsightResponse;
import com.lbos.finance.entity.CustomerRefund;
import com.lbos.finance.entity.PaymentTransaction;
import com.lbos.finance.entity.SupportTicket;
import com.lbos.finance.integration.client.OrderServiceClient;
import com.lbos.finance.integration.dto.OrderResponse;
import com.lbos.finance.repository.AuditLogRepository;
import com.lbos.finance.repository.CustomerInvoiceRepository;
import com.lbos.finance.repository.CustomerRefundRepository;
import com.lbos.finance.repository.NotificationRepository;
import com.lbos.finance.repository.PaymentTransactionRepository;
import com.lbos.finance.repository.SettlementRepository;
import com.lbos.finance.repository.SupportTicketRepository;

@Service
@Transactional(readOnly = true)
public class AnalyticsServiceImpl implements AnalyticsService {

    private static final int SCALE = 4;
    private static final String UNKNOWN_REGION = "Unknown";

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final CustomerInvoiceRepository customerInvoiceRepository;
    private final CustomerRefundRepository customerRefundRepository;
    private final SettlementRepository settlementRepository;
    private final SupportTicketRepository supportTicketRepository;
    private final NotificationRepository notificationRepository;
    private final AuditLogRepository auditLogRepository;
    private final OrderServiceClient orderServiceClient;

    public AnalyticsServiceImpl(
            PaymentTransactionRepository paymentTransactionRepository,
            CustomerInvoiceRepository customerInvoiceRepository,
            CustomerRefundRepository customerRefundRepository,
            SettlementRepository settlementRepository,
            SupportTicketRepository supportTicketRepository,
            NotificationRepository notificationRepository,
            AuditLogRepository auditLogRepository,
            OrderServiceClient orderServiceClient) {
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.customerInvoiceRepository = customerInvoiceRepository;
        this.customerRefundRepository = customerRefundRepository;
        this.settlementRepository = settlementRepository;
        this.supportTicketRepository = supportTicketRepository;
        this.notificationRepository = notificationRepository;
        this.auditLogRepository = auditLogRepository;
        this.orderServiceClient = orderServiceClient;
    }

    @Override
    public AnalyticsOverviewResponse getOverview() {
        BigDecimal recordedPaymentAmount = paymentTransactionRepository.sumRecordedPaymentAmount();
        return new AnalyticsOverviewResponse(
                paymentTransactionRepository.count(),
                customerInvoiceRepository.count(),
                customerRefundRepository.count(),
                settlementRepository.count(),
                supportTicketRepository.count(),
                notificationRepository.count(),
                auditLogRepository.count(),
                recordedPaymentAmount == null ? BigDecimal.ZERO : recordedPaymentAmount,
                computeRefundRate(),
                computeSettlementFeeRatio(),
                computeAverageTicketResolutionHours());
    }

    /**
     * Builds a read-only management insight without changing the database schema. A refund is
     * linked to a payment transaction, which is linked to the order. The order already contains
     * the checkout delivery-address snapshot. The last non-blank comma-separated address segment
     * is used as the current project's city/region label. If legacy data cannot be resolved, the
     * request is intentionally retained under "Unknown" instead of being silently dropped.
     */
    @Override
    public List<RefundRegionInsightResponse> getRefundRegionInsights() {
        List<CustomerRefund> refunds = customerRefundRepository.findAll();
        if (refunds.isEmpty()) {
            return List.of();
        }

        Map<Long, String> regionByOrderId = new HashMap<>();
        Map<String, RefundRegionAccumulator> totals = new LinkedHashMap<>();

        for (CustomerRefund refund : refunds) {
            String region = resolveRefundRegion(refund, regionByOrderId);
            RefundRegionAccumulator accumulator = totals.computeIfAbsent(
                    region,
                    ignored -> new RefundRegionAccumulator());
            accumulator.requestCount++;
            accumulator.requestedAmount = accumulator.requestedAmount.add(zeroIfNull(refund.getRefundAmount()));

            String status = refund.getRefundStatus();
            if ("APPROVED".equalsIgnoreCase(status) || "COMPLETED".equalsIgnoreCase(status)) {
                accumulator.approvedAmount = accumulator.approvedAmount.add(zeroIfNull(refund.getRefundAmount()));
            }
            if ("COMPLETED".equalsIgnoreCase(status)) {
                accumulator.completedAmount = accumulator.completedAmount.add(zeroIfNull(refund.getRefundAmount()));
            }
        }

        List<RefundRegionInsightResponse> result = new ArrayList<>();
        totals.forEach((region, value) -> result.add(new RefundRegionInsightResponse(
                region,
                value.requestCount,
                value.requestedAmount,
                value.approvedAmount,
                value.completedAmount)));
        result.sort((left, right) -> {
            int amountComparison = right.requestedAmount().compareTo(left.requestedAmount());
            return amountComparison != 0 ? amountComparison : left.region().compareToIgnoreCase(right.region());
        });
        return result;
    }

    private String resolveRefundRegion(CustomerRefund refund, Map<Long, String> regionByOrderId) {
        if (refund.getPaymentTransactionId() == null) {
            return UNKNOWN_REGION;
        }

        PaymentTransaction payment = paymentTransactionRepository.findById(refund.getPaymentTransactionId()).orElse(null);
        if (payment == null || payment.getOrderId() == null) {
            return UNKNOWN_REGION;
        }

        return regionByOrderId.computeIfAbsent(payment.getOrderId(), orderId -> {
            try {
                OrderResponse order = orderServiceClient.getOrderById(orderId);
                return extractRegion(order == null ? null : order.deliveryAddress());
            } catch (Exception ignored) {
                return UNKNOWN_REGION;
            }
        });
    }

    private String extractRegion(String deliveryAddress) {
        if (deliveryAddress == null || deliveryAddress.isBlank()) {
            return UNKNOWN_REGION;
        }
        String[] parts = deliveryAddress.split(",");
        for (int index = parts.length - 1; index >= 0; index--) {
            String part = parts[index].trim();
            if (!part.isBlank()) {
                return part;
            }
        }
        return UNKNOWN_REGION;
    }

    /** Completed refund volume as a fraction of successfully captured payment volume. */
    private BigDecimal computeRefundRate() {
        BigDecimal completedRefunds = customerRefundRepository.sumCompletedRefundAmount();
        BigDecimal successfulPayments = paymentTransactionRepository.sumSuccessfulPaymentAmount();
        return safeDivide(completedRefunds, successfulPayments);
    }

    /** Fees taken as a fraction of the gross amount settled. */
    private BigDecimal computeSettlementFeeRatio() {
        BigDecimal feeAmount = settlementRepository.sumFeeAmount();
        BigDecimal grossAmount = settlementRepository.sumGrossAmount();
        return safeDivide(feeAmount, grossAmount);
    }

    /** Average hours between a ticket being raised and resolved, across all resolved tickets. */
    private BigDecimal computeAverageTicketResolutionHours() {
        List<SupportTicket> resolvedTickets = supportTicketRepository.findByResolvedAtIsNotNull();
        if (resolvedTickets.isEmpty()) {
            return BigDecimal.ZERO;
        }
        double totalHours = 0.0;
        for (SupportTicket ticket : resolvedTickets) {
            totalHours += Duration.between(ticket.getRaisedAt(), ticket.getResolvedAt()).toMinutes() / 60.0;
        }
        double averageHours = totalHours / resolvedTickets.size();
        return BigDecimal.valueOf(averageHours).setScale(SCALE, RoundingMode.HALF_UP);
    }

    private BigDecimal safeDivide(BigDecimal numerator, BigDecimal denominator) {
        if (numerator == null || denominator == null || denominator.signum() == 0) {
            return BigDecimal.ZERO;
        }
        return numerator.divide(denominator, SCALE, RoundingMode.HALF_UP);
    }

    private BigDecimal zeroIfNull(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static final class RefundRegionAccumulator {
        private long requestCount;
        private BigDecimal requestedAmount = BigDecimal.ZERO;
        private BigDecimal approvedAmount = BigDecimal.ZERO;
        private BigDecimal completedAmount = BigDecimal.ZERO;
    }
}
