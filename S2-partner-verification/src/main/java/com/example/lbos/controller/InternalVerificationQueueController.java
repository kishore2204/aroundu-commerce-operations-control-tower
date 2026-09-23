package com.example.lbos.controller;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.lbos.dto.VerificationQueueDTO;
import com.example.lbos.service.VerificationQueueService;

/**
 * Service-to-service lookup of a reviewer's current open-review workload (e.g. S1 checking
 * whether a Location Manager can be safely deactivated), and service-to-service creation of new
 * verification-queue entries (e.g. S5 submitting a driver/vehicle for the same document
 * verification workflow already used for Retailer/FleetOwner onboarding). Gated by
 * hasRole("SERVICE") like the other /internal/** endpoints - not for browser/end-user use.
 */
@RestController
@RequestMapping("/internal/v1/verification-queues")
public class InternalVerificationQueueController {

    public record PendingReviewCountResponse(long pendingCount) {
    }

    /**
     * Everything but subjectType/subjectId/submittedByAccountId/zoneId is set server-side
     * (isActive, verificationStatus, timestamps) - a calling service has no business dictating
     * those. zoneId is the caller's responsibility since S2 has no way to derive a DRIVER/
     * VEHICLE's zone itself (only the owning Fleet Owner's zone applies, and only S5 knows the
     * driver/vehicle's fleet owner) - required for submitForVerification() to be able to
     * dispatch this queue to a Location Manager later.
     */
    public record CreateVerificationQueueRequest(String subjectType, UUID subjectId, UUID submittedByAccountId, UUID zoneId) {
    }

    public record CreateVerificationQueueResponse(UUID verificationQueueId, String subjectType, UUID subjectId,
                                                    String verificationStatus) {
    }

    private final VerificationQueueService service;

    public InternalVerificationQueueController(VerificationQueueService service) {
        this.service = service;
    }

    @GetMapping("/reviewer/{reviewerAccountId}/pending-count")
    public ResponseEntity<PendingReviewCountResponse> pendingCount(@PathVariable UUID reviewerAccountId,
            @org.springframework.web.bind.annotation.RequestParam(required = false) UUID zoneId) {
        // With the reviewer's zone this is their full pending work (assigned + unassigned in the zone); without it,
        // only what was explicitly assigned to them - the count the older callers always got.
        long pending = zoneId != null
                ? service.getPendingWorkCount(reviewerAccountId, zoneId)
                : service.getPendingReviewCountForReviewer(reviewerAccountId);
        return ResponseEntity.ok(new PendingReviewCountResponse(pending));
    }

    @PostMapping
    public ResponseEntity<CreateVerificationQueueResponse> create(@RequestBody CreateVerificationQueueRequest request) {
        // Reuse an already-open queue for the subject. A double click / retry must never create
        // two active DRIVER or VEHICLE verification applications for the same record.
        java.util.Optional<VerificationQueueDTO> existing = service.getActiveVerificationQueueForSubject(request.subjectId());
        if (existing.isPresent()) {
            VerificationQueueDTO queue = existing.get();
            return ResponseEntity.ok(new CreateVerificationQueueResponse(
                    queue.getVerificationQueueId(), queue.getSubjectType(), queue.getSubjectId(),
                    queue.getVerificationStatus()));
        }

        VerificationQueueDTO dto = new VerificationQueueDTO();
        dto.setSubjectType(request.subjectType());
        dto.setSubjectId(request.subjectId());
        dto.setSubmittedByAccountId(request.submittedByAccountId());
        dto.setZoneId(request.zoneId());
        dto.setIsActive(true);
        dto.setVerificationStatus("DOCUMENTS_SUBMITTED");

        VerificationQueueDTO created = service.createVerificationQueue(dto);
        /*
         * Keep the queue at DOCUMENTS_SUBMITTED until the browser has uploaded the actual
         * license/insurance file. The frontend then invokes the common submit-for-verification
         * endpoint. This prevents a Location Manager from receiving an application before its
         * required document exists.
         */
        return new ResponseEntity<>(new CreateVerificationQueueResponse(
                created.getVerificationQueueId(), created.getSubjectType(), created.getSubjectId(),
                created.getVerificationStatus()), HttpStatus.CREATED);
    }
}
