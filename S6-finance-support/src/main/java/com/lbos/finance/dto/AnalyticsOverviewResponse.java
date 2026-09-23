package com.lbos.finance.dto;

import java.math.BigDecimal;

public record AnalyticsOverviewResponse(
        long paymentTransactions,
        long invoices,
        long refunds,
        long settlements,
        long supportTickets,
        long notifications,
        long auditLogs,
        BigDecimal recordedPaymentAmount,
        BigDecimal refundRate,
        BigDecimal settlementFeeRatio,
        BigDecimal averageTicketResolutionHours) {
}
