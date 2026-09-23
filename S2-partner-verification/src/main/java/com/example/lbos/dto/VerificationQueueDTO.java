package com.example.lbos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(description = "Verification Queue Data Transfer Object")
public class VerificationQueueDTO {

    @Schema(description = "Unique identifier of the verification queue", example = "123e4567-e89b-12d3-a456-426614174000", accessMode = Schema.AccessMode.READ_ONLY)
    private UUID verificationQueueId;

    @NotBlank(message = "subjectType cannot be empty")
    @Schema(description = "Type of the subject being verified", example = "RETAILER")
    private String subjectType;

    @NotNull(message = "subjectId cannot be null")
    @Schema(description = "ID of the subject being verified", example = "123e4567-e89b-12d3-a456-426614174001")
    private UUID subjectId;

    @Schema(description = "Zone this request routes to for Location Manager dispatch - the subject's own zone for RETAILER/FLEET_OWNER, or the owning Fleet Owner's zone for DRIVER/VEHICLE", example = "123e4567-e89b-12d3-a456-426614174006")
    private UUID zoneId;

    @NotNull(message = "isActive cannot be null")
    @Schema(description = "Flag indicating if the verification is currently active", example = "true")
    private Boolean isActive;

    @NotNull(message = "submittedByAccountId cannot be null")
    @Schema(description = "Account ID of the user who submitted the verification", example = "123e4567-e89b-12d3-a456-426614174002")
    private UUID submittedByAccountId;

    @Schema(description = "Account ID of the user who reviewed the verification", example = "123e4567-e89b-12d3-a456-426614174003")
    private UUID reviewedByAccountId;

    @NotBlank(message = "verificationStatus cannot be empty")
    @Schema(description = "Current status of the verification", example = "PENDING")
    private String verificationStatus;

    @Schema(description = "Reason for rejection, if applicable", example = "Incomplete documents")
    private String rejectionReason;
    @Schema(description = "Reason for suspension, if applicable", example = "Fraud suspicion")
    private String suspensionReason;
    @Schema(description = "Reason for deletion, if applicable", example = "Duplicate entry")
    private String deletionReason;

    @Schema(description = "Timestamp when the record was created")
    private OffsetDateTime createdAt;
    @Schema(description = "Timestamp when the record was last updated")
    private OffsetDateTime updatedAt;

    public VerificationQueueDTO() {}

    public UUID getVerificationQueueId() { return verificationQueueId; }
    public void setVerificationQueueId(UUID verificationQueueId) { this.verificationQueueId = verificationQueueId; }

    public String getSubjectType() { return subjectType; }
    public void setSubjectType(String subjectType) { this.subjectType = subjectType; }

    public UUID getSubjectId() { return subjectId; }
    public void setSubjectId(UUID subjectId) { this.subjectId = subjectId; }

    public UUID getZoneId() { return zoneId; }
    public void setZoneId(UUID zoneId) { this.zoneId = zoneId; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public UUID getSubmittedByAccountId() { return submittedByAccountId; }
    public void setSubmittedByAccountId(UUID submittedByAccountId) { this.submittedByAccountId = submittedByAccountId; }

    public UUID getReviewedByAccountId() { return reviewedByAccountId; }
    public void setReviewedByAccountId(UUID reviewedByAccountId) { this.reviewedByAccountId = reviewedByAccountId; }

    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }

    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }

    public String getSuspensionReason() { return suspensionReason; }
    public void setSuspensionReason(String suspensionReason) { this.suspensionReason = suspensionReason; }

    public String getDeletionReason() { return deletionReason; }
    public void setDeletionReason(String deletionReason) { this.deletionReason = deletionReason; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
