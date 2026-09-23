package com.example.lbos.service;

import com.example.lbos.entity.VerificationQueue;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * What "a Location Manager's pending verification work" means - one definition shared by the work-transfer
 * popup, the pending counts that block disabling/deactivating/transferring an officer, the officer's own queue
 * and the dashboard, so they can never disagree.
 *
 * <p>A verification request is <b>pending</b> while it is open and has reached the Location Manager but is not yet
 * decided: SENT_TO_LOCATION_MANAGER (waiting for review) or RESUBMISSION_REQUIRED (waiting for the submitter's new
 * document, then comes back for review). It belongs to a Location Manager when it was explicitly assigned to them
 * (reviewedByAccountId) or, if nobody was assigned, when it sits in their zone.
 */
public final class VerificationWork {

    /** Statuses of an open request that the Location Manager still has to work through. */
    public static final List<String> PENDING_STATUSES = List.of("SENT_TO_LOCATION_MANAGER", "RESUBMISSION_REQUIRED");

    private static final Set<String> PENDING = Set.copyOf(PENDING_STATUSES);

    private VerificationWork() {
    }

    public static boolean isPending(VerificationQueue queue) {
        return Boolean.TRUE.equals(queue.getIsActive())
                && queue.getVerificationStatus() != null && PENDING.contains(queue.getVerificationStatus().toUpperCase());
    }

    /** Pending work owned by this reviewer: assigned to them, or unassigned in their zone. */
    public static boolean isPendingFor(VerificationQueue queue, UUID reviewerAccountId, UUID reviewerZoneId) {
        if (!isPending(queue)) {
            return false;
        }
        if (queue.getReviewedByAccountId() != null) {
            return queue.getReviewedByAccountId().equals(reviewerAccountId);
        }
        return reviewerZoneId != null && reviewerZoneId.equals(queue.getZoneId());
    }
}
