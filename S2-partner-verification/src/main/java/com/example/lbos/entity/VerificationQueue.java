package com.example.lbos.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Indexed on the columns findPendingWork/findVisibleToReviewer/countPendingByType/countDecidedByZone
 *  actually filter on - none of these had an index before (only the primary key did). */
@Entity
@Table(name = "verification_queue", indexes = {
        @Index(name = "idx_verification_queue_zone_id", columnList = "zone_id"),
        @Index(name = "idx_verification_queue_status", columnList = "verification_status"),
        @Index(name = "idx_verification_queue_reviewed_by", columnList = "reviewed_by_account_id"),
})
public class VerificationQueue {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "verification_queue_id", nullable = false)
    private UUID verificationQueueId;

    @Column(name = "subject_type", length = 30, nullable = false)
    private String subjectType;

    @Column(name = "subject_id", nullable = false)
    private UUID subjectId;

    /*
     * The zone the verification request should be routed to for Location Manager dispatch -
     * the subject's own zone for RETAILER/FLEET_OWNER, or the owning Fleet Owner's zone for
     * DRIVER/VEHICLE (which have no zone of their own). Nullable for backward compatibility
     * with rows created before this column existed; submitForVerification() requires it.
     */
    @Column(name = "zone_id")
    private UUID zoneId;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Column(name = "submitted_by_account_id", nullable = false)
    private UUID submittedByAccountId;

    @Column(name = "reviewed_by_account_id")
    private UUID reviewedByAccountId;

    @Column(name = "verification_status", length = 30, nullable = false)
    private String verificationStatus;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "suspension_reason", columnDefinition = "TEXT")
    private String suspensionReason;

    @Column(name = "deletion_reason", columnDefinition = "TEXT")
    private String deletionReason;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public VerificationQueue() {}

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
