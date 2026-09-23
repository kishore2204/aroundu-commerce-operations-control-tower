package com.example.lbos.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One pending verification request in the Work Transfer popup. {@code verificationQueueId} is only the handle the
 * transfer call needs; what the Operations Manager reads is the type, the name of the partner being verified and
 * the dates.
 */
public record PendingWorkItemDTO(
        UUID verificationQueueId,
        String subjectType,
        String subjectName,
        String verificationStatus,
        OffsetDateTime submittedAt) {
}
