package com.example.lbos.controller;

import com.example.lbos.dto.AssignReviewerRequestDto;
import com.example.lbos.dto.VerificationQueueDTO;
import com.example.lbos.service.VerificationQueueService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/verification-queues")
@Tag(name = "Verification Queue", description = "APIs for managing verification queues")
public class VerificationQueueController {

    private final VerificationQueueService service;
    private final com.example.lbos.security.ZoneScope zoneScope;

    public VerificationQueueController(VerificationQueueService service, com.example.lbos.security.ZoneScope zoneScope) {
        this.service = service;
        this.zoneScope = zoneScope;
    }

    @PostMapping
    @Operation(summary = "Create verification queue", description = "Creates a new verification queue")
    @ApiResponse(responseCode = "201", description = "Verification queue created successfully")
    @ApiResponse(responseCode = "400", description = "Invalid request")
    public ResponseEntity<VerificationQueueDTO> createVerificationQueue(@Valid @RequestBody VerificationQueueDTO dto) {
        VerificationQueueDTO created = service.createVerificationQueue(dto);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "Get all verification queues", description = "Retrieves a list of all verification queues, optionally scoped to a single zone (e.g. for a Location Manager who must only see their own zone's requests)")
    @ApiResponse(responseCode = "200", description = "Successful operation")
    public ResponseEntity<List<VerificationQueueDTO>> getAllVerificationQueues(
            @RequestParam(required = false) UUID zoneId) {
        if (com.example.lbos.security.ZoneScope.isLocationManager()) {
            return ResponseEntity.ok(service.getVerificationQueuesForReviewer(
                    com.example.lbos.security.ZoneScope.callerAccountId(), zoneScope.zoneId(), null));
        }
        return ResponseEntity.ok(zoneId != null ? service.getVerificationQueuesByZone(zoneId) : service.getAllVerificationQueues());
    }

    @GetMapping("/{verificationQueueId}")
    @Operation(summary = "Get a verification queue by ID", description = "Retrieves a single verification queue by its ID")
    @ApiResponse(responseCode = "200", description = "Successful operation")
    @ApiResponse(responseCode = "404", description = "Verification queue not found")
    public ResponseEntity<VerificationQueueDTO> getVerificationQueueById(@PathVariable UUID verificationQueueId) {
        VerificationQueueDTO queue = service.getVerificationQueueById(verificationQueueId);
        if (com.example.lbos.security.ZoneScope.isLocationManager()) {
            zoneScope.requireVisible(queue);
        }
        return ResponseEntity.ok(queue);
    }

    @PutMapping("/{verificationQueueId}")
    @Operation(summary = "Update a verification queue", description = "Updates an existing verification queue by its ID")
    @ApiResponse(responseCode = "200", description = "Verification queue updated successfully")
    @ApiResponse(responseCode = "404", description = "Verification queue not found")
    public ResponseEntity<VerificationQueueDTO> updateVerificationQueue(@PathVariable UUID verificationQueueId, @Valid @RequestBody VerificationQueueDTO dto) {
        return ResponseEntity.ok(service.updateVerificationQueue(verificationQueueId, dto));
    }

    @DeleteMapping("/{verificationQueueId}")
    @Operation(summary = "Delete a verification queue", description = "Deletes an existing verification queue by its ID")
    @ApiResponse(responseCode = "200", description = "VerificationQueue deleted successfully")
    @ApiResponse(responseCode = "404", description = "VerificationQueue not found")
    public ResponseEntity<Void> deleteVerificationQueue(@PathVariable UUID verificationQueueId) {
        service.deleteVerificationQueue(verificationQueueId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{verificationQueueId}/submit-for-verification")
    @Operation(summary = "Submit for verification", description = "Common submit-verification step for any subject type (RETAILER, FLEET_OWNER, DRIVER, VEHICLE): flips a DOCUMENTS_SUBMITTED queue to SENT_TO_LOCATION_MANAGER and dispatches it to the Location Manager active in the queue's zone")
    @ApiResponse(responseCode = "200", description = "Submitted successfully")
    @ApiResponse(responseCode = "409", description = "Queue is not in DOCUMENTS_SUBMITTED status")
    public ResponseEntity<Void> submitForVerification(@PathVariable UUID verificationQueueId) {
        service.submitForVerification(verificationQueueId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{verificationQueueId}/process-result")
    @Operation(summary = "Process verification result", description = "Processes the result of a verification from Location Manager")
    @ApiResponse(responseCode = "200", description = "Result processed successfully")
    public ResponseEntity<Void> processVerificationResult(
            @PathVariable UUID verificationQueueId,
            @RequestBody java.util.Map<String, String> payload) {
        String result = payload.get("result");
        String reason = payload.get("reason");
        if (com.example.lbos.security.ZoneScope.isLocationManager()) {
            zoneScope.requireVisible(service.getVerificationQueueById(verificationQueueId));
        }
        service.processVerificationResult(verificationQueueId, result, reason);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{verificationQueueId}/revoke")
    @Operation(summary = "Revoke a previously-approved verification", description = "Blocks a subject that was previously APPROVED - allowed at any later time, unlike process-result which is a one-time terminal decision")
    @ApiResponse(responseCode = "200", description = "Revoked successfully")
    @ApiResponse(responseCode = "409", description = "Queue is not currently APPROVED")
    public ResponseEntity<Void> revokeApproval(
            @PathVariable UUID verificationQueueId,
            @RequestBody java.util.Map<String, String> payload) {
        service.revokeApproval(verificationQueueId, payload.get("reason"));
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{verificationQueueId}/assign")
    @Operation(summary = "Assign a reviewer", description = "Assigns a reviewing officer to a verification queue entry before a decision is made")
    @ApiResponse(responseCode = "200", description = "Reviewer assigned successfully")
    @ApiResponse(responseCode = "404", description = "Verification queue not found")
    public ResponseEntity<VerificationQueueDTO> assignReviewer(
            @PathVariable UUID verificationQueueId,
            @Valid @RequestBody AssignReviewerRequestDto request) {
        return ResponseEntity.ok(service.assignReviewer(verificationQueueId, request.reviewerAccountId()));
    }

    @GetMapping("/pending-work/{reviewerAccountId}")
    @Operation(summary = "Pending verification work of a Location Manager",
            description = "The requests that must be handed to another Location Manager before this one can be disabled, deactivated or moved")
    public ResponseEntity<List<com.example.lbos.dto.PendingWorkItemDTO>> getPendingWork(@PathVariable UUID reviewerAccountId) {
        return ResponseEntity.ok(service.getPendingWork(reviewerAccountId));
    }

    @PostMapping("/transfer-work")
    @Operation(summary = "Transfer pending verification work to another Location Manager",
            description = "Individual or bulk. Each request moves or fails on its own; the result says what moved and how much is still pending.")
    public ResponseEntity<com.example.lbos.dto.TransferWorkResultDTO> transferWork(
            @Valid @RequestBody com.example.lbos.dto.TransferWorkRequestDTO request) {
        return ResponseEntity.ok(service.transferWork(request));
    }

    @GetMapping("/subject/{subjectId}")
    @Operation(summary = "Get verification queues by Subject ID", description = "Retrieves all verification queues for a specific subject")
    public ResponseEntity<List<VerificationQueueDTO>> getVerificationQueuesBySubjectId(@PathVariable UUID subjectId) {
        return ResponseEntity.ok(service.getVerificationQueuesBySubjectId(subjectId));
    }

    @GetMapping("/status/{status}")
    @Operation(summary = "Get verification queues by Status", description = "Retrieves all verification queues by their status, optionally scoped to a single zone (e.g. for a Location Manager who must only see their own zone's requests)")
    public ResponseEntity<List<VerificationQueueDTO>> getVerificationQueuesByStatus(
            @PathVariable String status,
            @RequestParam(required = false) UUID zoneId) {
        if (com.example.lbos.security.ZoneScope.isLocationManager()) {
            return ResponseEntity.ok(service.getVerificationQueuesForReviewer(
                    com.example.lbos.security.ZoneScope.callerAccountId(), zoneScope.zoneId(), status));
        }
        return ResponseEntity.ok(zoneId != null
                ? service.getVerificationQueuesByStatusAndZone(status, zoneId)
                : service.getVerificationQueuesByStatus(status));
    }

    @GetMapping("/active/{active}")
    @Operation(summary = "Get active verification queues", description = "Retrieves all verification queues by their active flag")
    public ResponseEntity<List<VerificationQueueDTO>> getVerificationQueuesByIsActive(@PathVariable Boolean active) {
        return ResponseEntity.ok(service.getVerificationQueuesByIsActive(active));
    }
}
