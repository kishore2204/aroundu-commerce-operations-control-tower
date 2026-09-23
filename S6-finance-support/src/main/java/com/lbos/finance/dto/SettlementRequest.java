package com.lbos.finance.dto;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.LocalDate;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
public record SettlementRequest(
        UUID operationsManagerId,
        @NotNull UUID paymentTransactionId,
        String settlementReference,
        @NotNull @Positive BigDecimal grossAmount,
        @NotNull @PositiveOrZero BigDecimal feeAmount,
        @NotNull LocalDate settlementDate
) { }
