package com.example.lbos.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

@Schema(description = "Request payload for assigning a reviewing officer to a verification queue entry")
public record AssignReviewerRequestDto(

        @NotNull(message = "reviewerAccountId cannot be null")
        @Schema(description = "Account ID of the officer who will review this verification queue entry",
                example = "123e4567-e89b-12d3-a456-426614174003")
        UUID reviewerAccountId
) {
}
