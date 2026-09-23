package com.example.lbos.dto;

import java.util.List;
import java.util.UUID;

/**
 * Outcome of a (possibly partial) work transfer. Only ids in {@code transferred} have really moved; every id in
 * {@code failed} is still with the original Location Manager. {@code remainingPending} is what that officer still
 * has after this call - the original action may continue only when it reaches zero.
 */
public record TransferWorkResultDTO(
        List<UUID> transferred,
        List<Failure> failed,
        long remainingPending) {

    public record Failure(UUID verificationQueueId, String reason) {
    }
}
