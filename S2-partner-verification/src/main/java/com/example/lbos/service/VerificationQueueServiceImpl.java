package com.example.lbos.service;

import com.example.lbos.client.LocationManagerClient;
import com.example.lbos.client.S5FleetClient;
import com.example.lbos.repository.VerificationQueueRepository;
import com.example.lbos.dto.VerificationQueueDTO;
import com.example.lbos.entity.VerificationQueue;
import com.example.lbos.exception.FleetOwnerNotFoundException;
import com.example.lbos.exception.InvalidVerificationTransitionException;
import com.example.lbos.exception.RetailerNotFoundException;
import com.example.lbos.exception.VerificationQueueNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class VerificationQueueServiceImpl implements VerificationQueueService {

    private static final Logger log = LoggerFactory.getLogger(VerificationQueueServiceImpl.class);

    private final VerificationQueueRepository verificationQueueRepository;
    private final com.example.lbos.repository.RetailerRepository retailerRepository;
    private final com.example.lbos.repository.FleetOwnerRepository fleetOwnerRepository;
    private final com.example.lbos.repository.VerificationDocumentRepository verificationDocumentRepository;
    private final S5FleetClient s5FleetClient;
    private final LocationManagerClient locationManagerClient;
    private final com.example.lbos.client.NotificationClient notificationClient;
    private final com.example.lbos.client.AccountLookupClient accountClient;

    public VerificationQueueServiceImpl(VerificationQueueRepository verificationQueueRepository,
                                        com.example.lbos.repository.RetailerRepository retailerRepository,
                                        com.example.lbos.repository.FleetOwnerRepository fleetOwnerRepository,
                                        com.example.lbos.repository.VerificationDocumentRepository verificationDocumentRepository,
                                        S5FleetClient s5FleetClient,
                                        LocationManagerClient locationManagerClient,
                                        com.example.lbos.client.NotificationClient notificationClient,
                                        com.example.lbos.client.AccountLookupClient accountClient) {
        this.notificationClient = notificationClient;
        this.accountClient = accountClient;
        this.verificationQueueRepository = verificationQueueRepository;
        this.retailerRepository = retailerRepository;
        this.fleetOwnerRepository = fleetOwnerRepository;
        this.verificationDocumentRepository = verificationDocumentRepository;
        this.s5FleetClient = s5FleetClient;
        this.locationManagerClient = locationManagerClient;
    }

    @Override
    public VerificationQueueDTO createVerificationQueue(VerificationQueueDTO dto) {
        VerificationQueue entity = mapToEntity(dto);
        
        if (entity.getCreatedAt() == null) {
            entity.setCreatedAt(OffsetDateTime.now());
        }
        entity.setUpdatedAt(OffsetDateTime.now());
        
        VerificationQueue saved = verificationQueueRepository.save(entity);
        return mapToDTO(saved);
    }

    @Override
    public VerificationQueueDTO getVerificationQueueById(UUID id) {
        VerificationQueue entity = verificationQueueRepository.findById(id)
                .orElseThrow(() -> new VerificationQueueNotFoundException("VerificationQueue not found with id: " + id));
        return mapToDTO(entity);
    }

    @Override
    public List<VerificationQueueDTO> getAllVerificationQueues() {
        return verificationQueueRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public VerificationQueueDTO updateVerificationQueue(UUID id, VerificationQueueDTO dto) {
        VerificationQueue existing = verificationQueueRepository.findById(id)
                .orElseThrow(() -> new VerificationQueueNotFoundException("VerificationQueue not found with id: " + id));

        existing.setSubjectType(dto.getSubjectType());
        existing.setSubjectId(dto.getSubjectId());
        existing.setZoneId(dto.getZoneId());
        existing.setIsActive(dto.getIsActive());
        existing.setSubmittedByAccountId(dto.getSubmittedByAccountId());
        existing.setReviewedByAccountId(dto.getReviewedByAccountId());
        existing.setVerificationStatus(dto.getVerificationStatus());
        existing.setRejectionReason(dto.getRejectionReason());
        existing.setSuspensionReason(dto.getSuspensionReason());
        existing.setDeletionReason(dto.getDeletionReason());
        existing.setUpdatedAt(OffsetDateTime.now());

        VerificationQueue updated = verificationQueueRepository.save(existing);
        return mapToDTO(updated);
    }

    @Override
    public void deleteVerificationQueue(UUID id) {
        if (!verificationQueueRepository.existsById(id)) {
            throw new VerificationQueueNotFoundException("VerificationQueue not found with id: " + id);
        }
        verificationQueueRepository.deleteById(id);
    }

    @Override
    public List<VerificationQueueDTO> getVerificationQueuesBySubjectId(UUID subjectId) {
        return verificationQueueRepository.findBySubjectId(subjectId).stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public List<VerificationQueueDTO> getVerificationQueuesByStatus(String status) {
        return verificationQueueRepository.findByVerificationStatus(status).stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public List<VerificationQueueDTO> getVerificationQueuesByStatusAndZone(String status, UUID zoneId) {
        return verificationQueueRepository.findByVerificationStatusAndZoneId(status, zoneId).stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public List<VerificationQueueDTO> getVerificationQueuesByZone(UUID zoneId) {
        return verificationQueueRepository.findByZoneId(zoneId).stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public List<VerificationQueueDTO> getVerificationQueuesByIsActive(Boolean isActive) {
        return verificationQueueRepository.findByIsActive(isActive).stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public java.util.Optional<VerificationQueueDTO> getActiveVerificationQueueForSubject(UUID subjectId) {
        return verificationQueueRepository.findFirstBySubjectIdAndIsActiveTrueOrderByCreatedAtDesc(subjectId)
                .map(this::mapToDTO);
    }

    private static final Set<String> TERMINAL_STATUSES = Set.of("APPROVED", "REJECTED");

    /**
     * The one common submit-verification step for RETAILER, FLEET_OWNER, DRIVER, and VEHICLE
     * alike - flips DOCUMENTS_SUBMITTED to SENT_TO_LOCATION_MANAGER and dispatches to the
     * Location Manager active in the queue's zone. Retailer/FleetOwner-specific submit methods
     * (RetailerServiceImpl/FleetOwnerServiceImpl) delegate here for this part, then separately
     * update their own entity's status field - that part isn't common to all 4 subject types.
     */
    @Override
    @org.springframework.transaction.annotation.Transactional
    public void submitForVerification(UUID queueId) {
        VerificationQueue queue = verificationQueueRepository.findById(queueId)
                .orElseThrow(() -> new VerificationQueueNotFoundException("VerificationQueue not found with id: " + queueId));

        String currentStatus = queue.getVerificationStatus() == null ? "" : queue.getVerificationStatus();
        boolean firstSubmission = "DOCUMENTS_SUBMITTED".equalsIgnoreCase(currentStatus);
        boolean resubmission = "RESUBMISSION_REQUIRED".equalsIgnoreCase(currentStatus);
        if (!firstSubmission && !resubmission) {
            throw new InvalidVerificationTransitionException(
                    "VerificationQueue " + queueId + " must be DOCUMENTS_SUBMITTED or RESUBMISSION_REQUIRED to submit for verification, was: "
                            + currentStatus);
        }
        if (resubmission) {
            List<com.example.lbos.entity.VerificationDocument> stillRejected = verificationDocumentRepository
                    .findByVerificationQueueIdAndIsCurrentVersion(queueId, true).stream()
                    .filter(document -> "REJECTED".equalsIgnoreCase(document.getDocumentStatus()))
                    .toList();
            if (!stillRejected.isEmpty()) {
                throw new InvalidVerificationTransitionException(
                        "Re-upload every rejected document before resubmitting. Remaining: "
                                + stillRejected.stream().map(com.example.lbos.entity.VerificationDocument::getDocumentTypeName)
                                        .distinct().sorted().collect(java.util.stream.Collectors.joining(", ")));
            }
        }

        Set<String> requiredDocumentTypes = requiredDocumentTypes(queue.getSubjectType());
        Map<String, com.example.lbos.entity.VerificationDocument> currentByType = verificationDocumentRepository
                .findByVerificationQueueIdAndIsCurrentVersion(queueId, true).stream()
                .collect(java.util.stream.Collectors.toMap(
                        com.example.lbos.entity.VerificationDocument::getDocumentTypeName,
                        java.util.function.Function.identity(),
                        this::preferredCurrentDocument));
        List<String> missingOrRejected = requiredDocumentTypes.stream()
                .filter(type -> {
                    com.example.lbos.entity.VerificationDocument document = currentByType.get(type);
                    return document == null
                            || document.getFileContent() == null
                            || document.getFileContent().length == 0
                            || "REJECTED".equalsIgnoreCase(document.getDocumentStatus());
                })
                .sorted().toList();
        if (!missingOrRejected.isEmpty()) {
            throw new InvalidVerificationTransitionException(
                    "Upload every required current document before submitting. Missing or rejected: "
                            + String.join(", ", missingOrRejected));
        }

        queue.setVerificationStatus("SENT_TO_LOCATION_MANAGER");
        queue.setRejectionReason(null);
        queue.setIsActive(true);
        queue.setUpdatedAt(OffsetDateTime.now());
        verificationQueueRepository.save(queue);

        dispatchToLocationManager(queue);
    }

    /**
     * Hands the request to one of the Location Managers active in queue.zoneId (a zone can have several) and
     * forwards it to them. A request that already belongs to an active officer of the zone (a resubmission) stays
     * with them; a new one goes to the officer with the least pending work, the longest-serving winning a tie.
     * Best-effort: a dispatch failure is logged, not thrown - the SENT_TO_LOCATION_MANAGER
     * status change already made still stands even if S1 is unreachable, same posture as the
     * S2->S5 activation call in processVerificationResult below.
     */
    private void dispatchToLocationManager(VerificationQueue queue) {
        if (queue.getZoneId() == null) {
            log.warn("VerificationQueue {} has no zoneId - cannot dispatch to a Location Manager", queue.getVerificationQueueId());
            return;
        }
        Map<String, Object> request = new HashMap<>();
        request.put("queueId", queue.getVerificationQueueId());
        request.put("subjectType", queue.getSubjectType());
        request.put("subjectId", queue.getSubjectId());
        request.put("status", queue.getVerificationStatus());

        try {
            List<LocationManagerClient.ZoneLocationManager> officers = locationManagerClient.getActiveLocationManagersByZone(queue.getZoneId());
            if (officers == null || officers.isEmpty()) {
                log.warn("Zone {} has no active Location Manager - verification queue {} stays unassigned",
                        queue.getZoneId(), queue.getVerificationQueueId());
                return;
            }
            LocationManagerClient.ZoneLocationManager chosen = chooseLocationManager(queue, officers);
            if (chosen.userAccountId() != null && !chosen.userAccountId().equals(queue.getReviewedByAccountId())) {
                queue.setReviewedByAccountId(chosen.userAccountId());
                queue.setUpdatedAt(OffsetDateTime.now());
                verificationQueueRepository.save(queue);
            }
            locationManagerClient.submitVerificationRequest(chosen.locationManagerId(), request);
        } catch (Exception locationManagerDispatchFailure) {
            log.warn("Failed to dispatch verification queue {} (subject {} {}) to a Location Manager in zone {}: {}",
                    queue.getVerificationQueueId(), queue.getSubjectType(), queue.getSubjectId(), queue.getZoneId(),
                    locationManagerDispatchFailure.getMessage(), locationManagerDispatchFailure);
        }
    }

    /** Keeps an officer the request already belongs to; otherwise the officer with the least pending work. */
    private LocationManagerClient.ZoneLocationManager chooseLocationManager(
            VerificationQueue queue, List<LocationManagerClient.ZoneLocationManager> officers) {
        if (queue.getReviewedByAccountId() != null) {
            for (LocationManagerClient.ZoneLocationManager officer : officers) {
                if (queue.getReviewedByAccountId().equals(officer.userAccountId())) return officer;
            }
        }
        LocationManagerClient.ZoneLocationManager least = officers.get(0);
        long leastWork = Long.MAX_VALUE;
        for (LocationManagerClient.ZoneLocationManager officer : officers) {
            long work = officer.userAccountId() == null ? Long.MAX_VALUE
                    : verificationQueueRepository.countPendingWork(officer.userAccountId(), queue.getZoneId(), VerificationWork.PENDING_STATUSES);
            if (work < leastWork) {
                least = officer;
                leastWork = work;
            }
        }
        return least;
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void processVerificationResult(UUID queueId, String result, String reason) {
        if (!"APPROVED".equalsIgnoreCase(result) && !"REJECTED".equalsIgnoreCase(result)) {
            throw new InvalidVerificationTransitionException("result must be APPROVED or REJECTED, got: " + result);
        }

        VerificationQueue queue = verificationQueueRepository.findById(queueId)
                .orElseThrow(() -> new VerificationQueueNotFoundException("VerificationQueue not found with id: " + queueId));

        if (TERMINAL_STATUSES.contains(queue.getVerificationStatus() == null ? "" : queue.getVerificationStatus().toUpperCase())) {
            throw new InvalidVerificationTransitionException(
                    "VerificationQueue " + queueId + " already has a final decision: " + queue.getVerificationStatus());
        }

        UUID reviewerAccountId = resolveAuthenticatedUserAccountId();
        if (reviewerAccountId != null && reviewerAccountId.equals(queue.getSubmittedByAccountId())) {
            throw new InvalidVerificationTransitionException("A reviewer cannot decide on their own submission");
        }

        if ("APPROVED".equalsIgnoreCase(result)) {
            java.util.Set<String> expectedDocumentTypes = requiredDocumentTypes(queue.getSubjectType());
            var currentDocuments = verificationDocumentRepository.findByVerificationQueueIdAndIsCurrentVersion(queueId, true);
            java.util.Map<String, com.example.lbos.entity.VerificationDocument> byType = currentDocuments.stream()
                    .collect(java.util.stream.Collectors.toMap(
                            com.example.lbos.entity.VerificationDocument::getDocumentTypeName,
                            java.util.function.Function.identity(), this::preferredCurrentDocument));
            java.util.List<String> incomplete = expectedDocumentTypes.stream()
                    .filter(type -> !byType.containsKey(type) || !"APPROVED".equalsIgnoreCase(byType.get(type).getDocumentStatus()))
                    .sorted().toList();
            if (!incomplete.isEmpty()) {
                throw new InvalidVerificationTransitionException(
                        "Approve every required document before approving the application. Pending: " + String.join(", ", incomplete));
            }
        }

        queue.setVerificationStatus(result.toUpperCase()); // APPROVED or REJECTED
        queue.setIsActive(false);
        if (reviewerAccountId != null) {
            queue.setReviewedByAccountId(reviewerAccountId);
        }
        if ("REJECTED".equalsIgnoreCase(result)) {
            queue.setRejectionReason(reason);
        }
        queue.setUpdatedAt(OffsetDateTime.now());
        verificationQueueRepository.save(queue);

        // Update documents
        List<com.example.lbos.entity.VerificationDocument> documents = verificationDocumentRepository.findByVerificationQueueIdAndIsCurrentVersion(queueId, true);
        for (com.example.lbos.entity.VerificationDocument doc : documents) {
            doc.setDocumentStatus(result.toUpperCase());
            if ("REJECTED".equalsIgnoreCase(result)) {
                doc.setRejectReason(reason);
            }
            verificationDocumentRepository.save(doc);
        }

        // Repeat-offender check: a subject rejected 3+ times gets auto-suspended instead of just rejected.
        boolean repeatOffenderSuspension = false;
        if ("REJECTED".equalsIgnoreCase(result)) {
            long rejectionCount = verificationQueueRepository.countBySubjectIdAndVerificationStatus(queue.getSubjectId(), "REJECTED");
            if (rejectionCount >= 3) {
                repeatOffenderSuspension = true;
                queue.setSuspensionReason("Auto-suspended after " + rejectionCount + " rejected verification attempts");
                verificationQueueRepository.save(queue);
            }
        }

        // Update subject
        if ("RETAILER".equalsIgnoreCase(queue.getSubjectType())) {
            com.example.lbos.entity.Retailer retailer = retailerRepository.findById(queue.getSubjectId())
                .orElseThrow(() -> new RetailerNotFoundException("Retailer not found with id: " + queue.getSubjectId()));
            if (repeatOffenderSuspension) {
                retailer.setRetailerStatus("SUSPENDED");
            } else {
                retailer.setRetailerStatus(result.equalsIgnoreCase("APPROVED") ? "VERIFIED" : "REJECTED");
            }
            retailerRepository.save(retailer);
            if (repeatOffenderSuspension) syncAccountStatus(retailer.getUserAccountId(), "SUSPENDED");
            else if ("APPROVED".equalsIgnoreCase(result)) reactivateSuspendedAccount(retailer.getUserAccountId());
        } else if ("FLEET_OWNER".equalsIgnoreCase(queue.getSubjectType())) {
            com.example.lbos.entity.FleetOwner fleetOwner = fleetOwnerRepository.findById(queue.getSubjectId())
                .orElseThrow(() -> new FleetOwnerNotFoundException("FleetOwner not found with id: " + queue.getSubjectId()));
            if (repeatOffenderSuspension) {
                fleetOwner.setProfileStatus("SUSPENDED");
                fleetOwner.setOwnerStatus("INACTIVE");
            } else {
                fleetOwner.setProfileStatus(result.equalsIgnoreCase("APPROVED") ? "VERIFIED" : "REJECTED");
                if (result.equalsIgnoreCase("APPROVED")) {
                    fleetOwner.setOwnerStatus("ACTIVE");
                }
            }
            fleetOwnerRepository.save(fleetOwner);
            if (repeatOffenderSuspension) syncAccountStatus(fleetOwner.getUserAccountId(), "SUSPENDED");
            else if ("APPROVED".equalsIgnoreCase(result)) reactivateSuspendedAccount(fleetOwner.getUserAccountId());
        } else if ("DRIVER".equalsIgnoreCase(queue.getSubjectType())) {
            // Driver/vehicle status itself lives entirely in S5 - S2 only owns the verification
            // decision. REJECTED needs no outbound call: the driver simply stays INACTIVE, its
            // current/default state since DriverServiceImpl.create().
            if (result.equalsIgnoreCase("APPROVED")) {
                try {
                    s5FleetClient.activateDriver(queue.getSubjectId());
                } catch (feign.FeignException e) {
                    // Log and handle - same "don't hard-fail the decision" posture as
                    // FleetOwnerServiceImpl.submitFleetOwnerForVerification's dispatch to S1:
                    // the APPROVED decision itself still stands even if S5 is unreachable.
                    log.warn("Failed to activate driver {} in S5 after APPROVED decision on queue {}: {}",
                            queue.getSubjectId(), queue.getVerificationQueueId(), e.getMessage(), e);
                }
            }
        } else if ("VEHICLE".equalsIgnoreCase(queue.getSubjectType())) {
            if (result.equalsIgnoreCase("APPROVED")) {
                try {
                    s5FleetClient.activateVehicle(queue.getSubjectId());
                } catch (feign.FeignException e) {
                    // Log and handle - see the DRIVER branch above for the rationale.
                    log.warn("Failed to activate vehicle {} in S5 after APPROVED decision on queue {}: {}",
                            queue.getSubjectId(), queue.getVerificationQueueId(), e.getMessage(), e);
                }
            }
        }
    }

    /**
     * Blocks a subject that was previously APPROVED - see the interface doc. Deliberately its
     * own method rather than a special case inside processVerificationResult: that method's
     * TERMINAL_STATUSES guard exists specifically to make APPROVED/REJECTED immutable for a
     * first-time decision, and revoke needs the opposite rule (only FROM approved, at any
     * later time), plus different subject-side effects (suspend, not "reject").
     */
    @Override
    @org.springframework.transaction.annotation.Transactional
    public void revokeApproval(UUID queueId, String reason) {
        VerificationQueue queue = verificationQueueRepository.findById(queueId)
                .orElseThrow(() -> new VerificationQueueNotFoundException("VerificationQueue not found with id: " + queueId));

        if (!"APPROVED".equalsIgnoreCase(queue.getVerificationStatus())) {
            throw new InvalidVerificationTransitionException(
                    "VerificationQueue " + queueId + " can only be revoked from APPROVED, was: " + queue.getVerificationStatus());
        }

        queue.setVerificationStatus("REJECTED");
        queue.setRejectionReason(reason);
        queue.setSuspensionReason(reason);
        UUID reviewerAccountId = resolveAuthenticatedUserAccountId();
        if (reviewerAccountId != null) {
            queue.setReviewedByAccountId(reviewerAccountId);
        }
        queue.setUpdatedAt(OffsetDateTime.now());
        verificationQueueRepository.save(queue);

        if ("RETAILER".equalsIgnoreCase(queue.getSubjectType())) {
            com.example.lbos.entity.Retailer retailer = retailerRepository.findById(queue.getSubjectId())
                    .orElseThrow(() -> new RetailerNotFoundException("Retailer not found with id: " + queue.getSubjectId()));
            retailer.setRetailerStatus("SUSPENDED");
            retailerRepository.save(retailer);
            syncAccountStatus(retailer.getUserAccountId(), "SUSPENDED");
        } else if ("FLEET_OWNER".equalsIgnoreCase(queue.getSubjectType())) {
            com.example.lbos.entity.FleetOwner fleetOwner = fleetOwnerRepository.findById(queue.getSubjectId())
                    .orElseThrow(() -> new FleetOwnerNotFoundException("FleetOwner not found with id: " + queue.getSubjectId()));
            fleetOwner.setProfileStatus("SUSPENDED");
            fleetOwner.setOwnerStatus("INACTIVE");
            fleetOwnerRepository.save(fleetOwner);
            syncAccountStatus(fleetOwner.getUserAccountId(), "SUSPENDED");
        } else if ("DRIVER".equalsIgnoreCase(queue.getSubjectType())) {
            try {
                s5FleetClient.suspendDriver(queue.getSubjectId());
            } catch (feign.FeignException e) {
                log.warn("Failed to suspend driver {} in S5 after revoking queue {}: {}",
                        queue.getSubjectId(), queue.getVerificationQueueId(), e.getMessage(), e);
            }
        } else if ("VEHICLE".equalsIgnoreCase(queue.getSubjectType())) {
            try {
                s5FleetClient.suspendVehicle(queue.getSubjectId());
            } catch (feign.FeignException e) {
                log.warn("Failed to suspend vehicle {} in S5 after revoking queue {}: {}",
                        queue.getSubjectId(), queue.getVerificationQueueId(), e.getMessage(), e);
            }
        }
    }

    /**
     * Keeps the S1 account status (what the admin Accounts page lists) in step with a status a Location Manager sets
     * here. Runs after the transaction commits and never fails the decision - the same best-effort posture as the
     * dispatch and notification calls; a driver is synchronised the same way by S5 (DriverServiceImpl.changeStatus).
     */
    private void syncAccountStatus(UUID userAccountId, String accountStatus) {
        if (userAccountId == null) return;
        AfterCommit.run("Sync account " + userAccountId + " to " + accountStatus,
                () -> accountClient.updateStatus(userAccountId, java.util.Map.of("accountStatus", accountStatus)));
    }

    /** A partner that is verified again after being blocked can sign in again: SUSPENDED -> ACTIVE (any other status is left alone). */
    private void reactivateSuspendedAccount(UUID userAccountId) {
        if (userAccountId == null) return;
        AfterCommit.run("Reactivate account " + userAccountId, () -> {
            var account = accountClient.get(userAccountId);
            if (account != null && "SUSPENDED".equalsIgnoreCase(account.accountStatus())) {
                accountClient.updateStatus(userAccountId, java.util.Map.of("accountStatus", "ACTIVE"));
            }
        });
    }

    /** Null (rather than throwing) when there is no authenticated caller - e.g. an internal/test call. */
    private UUID resolveAuthenticatedUserAccountId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException invalidSubjectException) {
            return null;
        }
    }

    @Override
    public VerificationQueueDTO assignReviewer(UUID id, UUID reviewerAccountId) {
        VerificationQueue existing = verificationQueueRepository.findById(id)
                .orElseThrow(() -> new VerificationQueueNotFoundException("VerificationQueue not found with id: " + id));

        if (TERMINAL_STATUSES.contains(existing.getVerificationStatus() == null ? "" : existing.getVerificationStatus().toUpperCase())) {
            throw new InvalidVerificationTransitionException(
                    "VerificationQueue " + id + " already has a final decision: " + existing.getVerificationStatus());
        }

        if (reviewerAccountId.equals(existing.getSubmittedByAccountId())) {
            throw new InvalidVerificationTransitionException("A reviewer cannot decide on their own submission");
        }

        long pendingCount = getPendingReviewCountForReviewer(reviewerAccountId);
        if (pendingCount >= 15) {
            throw new InvalidVerificationTransitionException(
                    "Reviewer already has 15 or more pending verification items assigned; assign to someone else");
        }

        existing.setReviewedByAccountId(reviewerAccountId);
        existing.setUpdatedAt(OffsetDateTime.now());

        VerificationQueue updated = verificationQueueRepository.save(existing);
        return mapToDTO(updated);
    }

    // ------------------------------------------------------------------ Location Manager work transfer

    @Override
    public List<VerificationQueueDTO> getVerificationQueuesForReviewer(UUID reviewerAccountId, UUID zoneId, String statusOrNull) {
        return verificationQueueRepository.findVisibleToReviewer(reviewerAccountId, zoneId, VerificationWork.PENDING_STATUSES).stream()
                .filter(queue -> statusOrNull == null || statusOrNull.equalsIgnoreCase(queue.getVerificationStatus()))
                .map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public long getPendingWorkCount(UUID reviewerAccountId, UUID zoneId) {
        return verificationQueueRepository.countPendingWork(reviewerAccountId, zoneId, VerificationWork.PENDING_STATUSES);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<com.example.lbos.dto.PendingWorkItemDTO> getPendingWork(UUID reviewerAccountId) {
        LocationManagerClient.LocationManagerSummary from = lookupLocationManager(reviewerAccountId);
        requireSupervisionOf(from);
        List<VerificationQueue> items = verificationQueueRepository.findPendingWork(
                reviewerAccountId, from.zoneId(), VerificationWork.PENDING_STATUSES);
        Map<UUID, String> names = subjectNames(items);
        return items.stream().map(queue -> new com.example.lbos.dto.PendingWorkItemDTO(
                queue.getVerificationQueueId(), queue.getSubjectType(), names.get(queue.getSubjectId()),
                queue.getVerificationStatus(), queue.getCreatedAt())).collect(Collectors.toList());
    }

    /*
    ##################################################################
    
                                               CR_CHG0030050_Reassign_Verification_Deactivation_3239399_3241245
    
    #####################################################################
    */
    /**
     * Each request is checked and moved on its own, so one that cannot move (already decided, not this officer's, the
     * target is its own submitter) is reported as failed and stays exactly where it was, while the rest still move.
     * Only checks that can fail are made before a request is written, so nothing is ever half-transferred.
     */
    @Override
    @org.springframework.transaction.annotation.Transactional
    public com.example.lbos.dto.TransferWorkResultDTO transferWork(com.example.lbos.dto.TransferWorkRequestDTO request) {
        if (request.fromReviewerAccountId().equals(request.toReviewerAccountId())) {
            throw new InvalidVerificationTransitionException("Choose a different Location Manager to transfer the work to");
        }
        LocationManagerClient.LocationManagerSummary from = lookupLocationManager(request.fromReviewerAccountId());
        requireSupervisionOf(from);
        LocationManagerClient.LocationManagerSummary to = lookupLocationManager(request.toReviewerAccountId());
        if (!to.isActive()) {
            throw new InvalidVerificationTransitionException("The selected Location Manager is not active");
        }
        if (to.stateId() == null || !to.stateId().equals(from.stateId())) {
            throw new InvalidVerificationTransitionException("Work can only be transferred to a Location Manager in the same state");
        }

        Map<UUID, VerificationQueue> requested = verificationQueueRepository.findAllById(request.verificationQueueIds()).stream()
                .collect(Collectors.toMap(VerificationQueue::getVerificationQueueId, queue -> queue));
        List<UUID> transferred = new java.util.ArrayList<>();
        List<com.example.lbos.dto.TransferWorkResultDTO.Failure> failed = new java.util.ArrayList<>();
        for (UUID id : new java.util.LinkedHashSet<>(request.verificationQueueIds())) {
            VerificationQueue queue = requested.get(id);
            String problem = null;
            if (queue == null) {
                problem = "This request no longer exists";
            } else if (!VerificationWork.isPendingFor(queue, request.fromReviewerAccountId(), from.zoneId())) {
                problem = "This request is no longer pending with this Location Manager";
            } else if (request.toReviewerAccountId().equals(queue.getSubmittedByAccountId())) {
                problem = "A reviewer cannot decide on their own submission";
            }
            if (problem != null) {
                failed.add(new com.example.lbos.dto.TransferWorkResultDTO.Failure(id, problem));
                continue;
            }
            queue.setReviewedByAccountId(request.toReviewerAccountId());
            queue.setUpdatedAt(OffsetDateTime.now());
            verificationQueueRepository.save(queue);
            transferred.add(id);
        }

        if (!transferred.isEmpty()) {
            notifyWorkAssigned(request.toReviewerAccountId(), transferred.size(), from.displayName());
        }
        long remaining = verificationQueueRepository.countPendingWork(
                request.fromReviewerAccountId(), from.zoneId(), VerificationWork.PENDING_STATUSES);
        return new com.example.lbos.dto.TransferWorkResultDTO(transferred, failed, remaining);
    }

    private LocationManagerClient.LocationManagerSummary lookupLocationManager(UUID accountId) {
        try {
            return locationManagerClient.getByUser(accountId);
        } catch (feign.FeignException.NotFound notFound) {
            throw new InvalidVerificationTransitionException("That account is not a Location Manager");
        } catch (Exception lookupFailure) {
            throw new InvalidVerificationTransitionException("Location Manager details could not be confirmed right now. Please try again.");
        }
    }

    /** An Operations Manager may only move work of the Location Managers they supervise; Super Admin may move any. */
    private void requireSupervisionOf(LocationManagerClient.LocationManagerSummary locationManager) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return;
        }
        boolean operationsManager = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_OPERATIONS_MANAGER".equals(authority.getAuthority()));
        UUID caller = resolveAuthenticatedUserAccountId();
        if (operationsManager && (caller == null || !caller.equals(locationManager.operationsManagerAccountId()))) {
            throw new com.example.lbos.exception.ForbiddenActionException("This Location Manager is not under your supervision");
        }
    }

    private void notifyWorkAssigned(UUID toAccountId, int count, String fromName) {
        if (notificationClient == null) {
            return;
        }
        com.example.lbos.client.NotificationClient.NotificationCreateRequest request =
                new com.example.lbos.client.NotificationClient.NotificationCreateRequest(
                        toAccountId, "LOCATION_MANAGER", "VERIFICATION_WORK_ASSIGNED", "VERIFICATION_QUEUE", null,
                        "Verification work assigned to you",
                        count + (count == 1 ? " verification request has" : " verification requests have")
                                + " been transferred to you from " + fromName + ". Open your verification queue to review "
                                + (count == 1 ? "it." : "them."));
        AfterCommit.run("Notifying " + toAccountId + " about transferred verification work", () -> notificationClient.create(request));
    }

    /** Partner names for a set of requests: retailers and fleet owners in one query each, drivers/vehicles best-effort from S5. */
    private Map<UUID, String> subjectNames(List<VerificationQueue> items) {
        Map<UUID, String> names = new HashMap<>();
        Set<UUID> retailerIds = new java.util.HashSet<>();
        Set<UUID> fleetOwnerIds = new java.util.HashSet<>();
        for (VerificationQueue queue : items) {
            switch (String.valueOf(queue.getSubjectType()).toUpperCase()) {
                case "RETAILER" -> retailerIds.add(queue.getSubjectId());
                case "FLEET_OWNER" -> fleetOwnerIds.add(queue.getSubjectId());
                case "DRIVER" -> names.put(queue.getSubjectId(), driverName(queue.getSubjectId()));
                case "VEHICLE" -> names.put(queue.getSubjectId(), vehicleName(queue.getSubjectId()));
                default -> { }
            }
        }
        if (!retailerIds.isEmpty()) {
            retailerRepository.findAllById(retailerIds).forEach(retailer -> names.put(retailer.getRetailerId(), retailer.getBusinessName()));
        }
        if (!fleetOwnerIds.isEmpty()) {
            fleetOwnerRepository.findAllById(fleetOwnerIds).forEach(owner -> names.put(owner.getFleetOwnerId(), owner.getBusinessName()));
        }
        return names;
    }

    private String driverName(UUID driverId) {
        try {
            S5FleetClient.DriverInfo driver = s5FleetClient.getDriver(driverId);
            String name = ((driver.firstName() == null ? "" : driver.firstName()) + " " + (driver.lastName() == null ? "" : driver.lastName())).trim();
            return name.isEmpty() ? driver.email() : name;
        } catch (Exception lookupFailure) {
            return null;
        }
    }

    private String vehicleName(UUID vehicleId) {
        try {
            S5FleetClient.VehicleInfo vehicle = s5FleetClient.getVehicle(vehicleId);
            String model = ((vehicle.make() == null ? "" : vehicle.make()) + " " + (vehicle.model() == null ? "" : vehicle.model())).trim();
            return model.isEmpty() ? vehicle.registrationNumber() : vehicle.registrationNumber() + " (" + model + ")";
        } catch (Exception lookupFailure) {
            return null;
        }
    }

    @Override
    public long getPendingReviewCountForReviewer(UUID reviewerAccountId) {
        return verificationQueueRepository.countByReviewedByAccountIdAndVerificationStatusNotInAndIsActiveTrue(
                reviewerAccountId, TERMINAL_STATUSES);
    }

    private Set<String> requiredDocumentTypes(String subjectType) {
        if (subjectType == null) return Set.of();
        return switch (subjectType.toUpperCase()) {
            case "RETAILER" -> Set.of("GST_CERTIFICATE", "PAN_CARD", "BUSINESS_LICENSE", "ADDRESS_PROOF");
            case "FLEET_OWNER" -> Set.of("GST_NUMBER", "PAN_CARD");
            case "DRIVER" -> Set.of("DRIVING_LICENSE");
            case "VEHICLE" -> Set.of("INSURANCE");
            default -> Set.of();
        };
    }

    /** Picks the actual/latest document if legacy data accidentally contains duplicate current rows. */
    private com.example.lbos.entity.VerificationDocument preferredCurrentDocument(
            com.example.lbos.entity.VerificationDocument left,
            com.example.lbos.entity.VerificationDocument right) {
        boolean leftHasFile = left.getFileContent() != null && left.getFileContent().length > 0;
        boolean rightHasFile = right.getFileContent() != null && right.getFileContent().length > 0;
        if (leftHasFile != rightHasFile) return rightHasFile ? right : left;
        int leftVersion = left.getVersionNumber() == null ? 0 : left.getVersionNumber();
        int rightVersion = right.getVersionNumber() == null ? 0 : right.getVersionNumber();
        if (leftVersion != rightVersion) return rightVersion > leftVersion ? right : left;
        OffsetDateTime leftUpdated = left.getUpdatedAt() == null ? OffsetDateTime.MIN : left.getUpdatedAt();
        OffsetDateTime rightUpdated = right.getUpdatedAt() == null ? OffsetDateTime.MIN : right.getUpdatedAt();
        return rightUpdated.isAfter(leftUpdated) ? right : left;
    }

    private VerificationQueue mapToEntity(VerificationQueueDTO dto) {
        VerificationQueue entity = new VerificationQueue();
        entity.setVerificationQueueId(dto.getVerificationQueueId());
        entity.setSubjectType(dto.getSubjectType());
        entity.setSubjectId(dto.getSubjectId());
        entity.setZoneId(dto.getZoneId());
        entity.setIsActive(dto.getIsActive());
        entity.setSubmittedByAccountId(dto.getSubmittedByAccountId());
        entity.setReviewedByAccountId(dto.getReviewedByAccountId());
        entity.setVerificationStatus(dto.getVerificationStatus());
        entity.setRejectionReason(dto.getRejectionReason());
        entity.setSuspensionReason(dto.getSuspensionReason());
        entity.setDeletionReason(dto.getDeletionReason());
        entity.setCreatedAt(dto.getCreatedAt());
        entity.setUpdatedAt(dto.getUpdatedAt());
        return entity;
    }

    private VerificationQueueDTO mapToDTO(VerificationQueue entity) {
        VerificationQueueDTO dto = new VerificationQueueDTO();
        dto.setVerificationQueueId(entity.getVerificationQueueId());
        dto.setSubjectType(entity.getSubjectType());
        dto.setSubjectId(entity.getSubjectId());
        dto.setZoneId(entity.getZoneId());
        dto.setIsActive(entity.getIsActive());
        dto.setSubmittedByAccountId(entity.getSubmittedByAccountId());
        dto.setReviewedByAccountId(entity.getReviewedByAccountId());
        dto.setVerificationStatus(entity.getVerificationStatus());
        dto.setRejectionReason(entity.getRejectionReason());
        dto.setSuspensionReason(entity.getSuspensionReason());
        dto.setDeletionReason(entity.getDeletionReason());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }
}
