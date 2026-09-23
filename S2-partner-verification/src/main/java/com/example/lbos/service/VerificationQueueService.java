package com.example.lbos.service;

import com.example.lbos.dto.VerificationQueueDTO;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VerificationQueueService {
    VerificationQueueDTO createVerificationQueue(VerificationQueueDTO dto);
    VerificationQueueDTO getVerificationQueueById(UUID id);
    List<VerificationQueueDTO> getAllVerificationQueues();
    VerificationQueueDTO updateVerificationQueue(UUID id, VerificationQueueDTO dto);
    void deleteVerificationQueue(UUID id);
    List<VerificationQueueDTO> getVerificationQueuesBySubjectId(UUID subjectId);
    List<VerificationQueueDTO> getVerificationQueuesByStatus(String status);

    /** Same as getVerificationQueuesByStatus, scoped to a single zone - see the controller doc. */
    List<VerificationQueueDTO> getVerificationQueuesByStatusAndZone(String status, UUID zoneId);

    /** Every queue entry in a single zone, regardless of status. */
    List<VerificationQueueDTO> getVerificationQueuesByZone(UUID zoneId);
    List<VerificationQueueDTO> getVerificationQueuesByIsActive(Boolean isActive);

    /** The one queue entry a subject can have open at a time, if any - never a stale/decided one. */
    Optional<VerificationQueueDTO> getActiveVerificationQueueForSubject(UUID subjectId);

    // Business Workflow

    /**
     * The one common submit-verification step for every subject type (RETAILER, FLEET_OWNER,
     * DRIVER, VEHICLE): flips a DOCUMENTS_SUBMITTED queue to SENT_TO_LOCATION_MANAGER and
     * dispatches it to the Location Manager active in queue.zoneId. Requires zoneId to already
     * be set on the queue (done at creation time by whichever caller created it).
     */
    void submitForVerification(UUID queueId);

    void processVerificationResult(UUID queueId, String result, String reason);

    /**
     * Blocks a previously-APPROVED subject at any later time (e.g. fraud discovered after the
     * fact) - unlike processVerificationResult, this is allowed FROM the APPROVED terminal
     * state specifically (every other terminal/non-terminal state is rejected), and always
     * results in the subject being suspended/blocked rather than "REJECTED" as a first-time
     * decision would read.
     */
    void revokeApproval(UUID queueId, String reason);

    VerificationQueueDTO assignReviewer(UUID id, UUID reviewerAccountId);

    /** How many non-terminal (still-open) verification items are currently assigned to this reviewer. */
    long getPendingReviewCountForReviewer(UUID reviewerAccountId);

    // Location Manager work transfer

    /** Requests a Location Manager can see: assigned to them, or in their zone and not handed to someone else. */
    List<VerificationQueueDTO> getVerificationQueuesForReviewer(UUID reviewerAccountId, UUID zoneId, String statusOrNull);

    /** Pending verification work of a Location Manager (assigned to them, or unassigned in their zone). */
    long getPendingWorkCount(UUID reviewerAccountId, UUID zoneId);

    /** The pending requests of a Location Manager, for the Work Transfer popup. */
    List<com.example.lbos.dto.PendingWorkItemDTO> getPendingWork(UUID reviewerAccountId);

    /** Moves the selected pending requests to another Location Manager; each request moves or fails on its own. */
    com.example.lbos.dto.TransferWorkResultDTO transferWork(com.example.lbos.dto.TransferWorkRequestDTO request);
}
