package com.example.lbos.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One immutable version of one document, as shown in "View Document History". People are shown by
 * name (never by account id); {@code reviewerName} is null while the version is still awaiting review.
 * {@code documentId} is only the handle the existing file endpoint needs to view/download that version.
 */
@Schema(description = "One version in a document's history")
public class DocumentVersionDTO {

    private UUID documentId;
    private Integer versionNumber;
    private String fileName;
    private String contentType;
    private Long fileSizeBytes;
    /** PENDING, RESUBMITTED, APPROVED or REJECTED (REJECTED = "Re-upload Required"). */
    private String documentStatus;
    private Boolean isCurrentVersion;
    private OffsetDateTime uploadedAt;
    private String uploadedByName;
    private OffsetDateTime reviewedAt;
    private String reviewerName;
    private String reviewerComment;
    /** Why a new upload was requested for this version (only set when it is Re-upload Required). */
    private String reuploadReason;

    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }

    public Integer getVersionNumber() { return versionNumber; }
    public void setVersionNumber(Integer versionNumber) { this.versionNumber = versionNumber; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public Long getFileSizeBytes() { return fileSizeBytes; }
    public void setFileSizeBytes(Long fileSizeBytes) { this.fileSizeBytes = fileSizeBytes; }

    public String getDocumentStatus() { return documentStatus; }
    public void setDocumentStatus(String documentStatus) { this.documentStatus = documentStatus; }

    public Boolean getIsCurrentVersion() { return isCurrentVersion; }
    public void setIsCurrentVersion(Boolean isCurrentVersion) { this.isCurrentVersion = isCurrentVersion; }

    public OffsetDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(OffsetDateTime uploadedAt) { this.uploadedAt = uploadedAt; }

    public String getUploadedByName() { return uploadedByName; }
    public void setUploadedByName(String uploadedByName) { this.uploadedByName = uploadedByName; }

    public OffsetDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(OffsetDateTime reviewedAt) { this.reviewedAt = reviewedAt; }

    public String getReviewerName() { return reviewerName; }
    public void setReviewerName(String reviewerName) { this.reviewerName = reviewerName; }

    public String getReviewerComment() { return reviewerComment; }
    public void setReviewerComment(String reviewerComment) { this.reviewerComment = reviewerComment; }

    public String getReuploadReason() { return reuploadReason; }
    public void setReuploadReason(String reuploadReason) { this.reuploadReason = reuploadReason; }
}
