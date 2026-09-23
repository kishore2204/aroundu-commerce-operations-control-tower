package com.lbos.finance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record PaymentTransactionRequest(
        @NotNull Long orderId,
        @NotBlank String paymentMethod) { }
