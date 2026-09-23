package com.lbos.finance.dto;
import java.util.UUID;
import java.math.BigDecimal;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
public record CustomerRefundRequest(
        UUID customerTicketId,
        @NotNull UUID paymentTransactionId,
        @NotNull Long orderItemId,
        String refundReference,
        @NotNull @Positive BigDecimal refundAmount,
        @NotBlank String reason
) { }
