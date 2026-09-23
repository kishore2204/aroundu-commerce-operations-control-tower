package com.example.lbos.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

/** Move the listed pending requests from one Location Manager (by account) to another. */
public record TransferWorkRequestDTO(
        @NotNull UUID fromReviewerAccountId,
        @NotNull UUID toReviewerAccountId,
        @NotEmpty List<UUID> verificationQueueIds) {
}
