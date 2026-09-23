package com.example.lbos.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Indexed on verification_queue_id - the FK behind findVersionRows() and every other lookup of
 *  a queue entry's documents, which had no index before. */
@Entity
@Table(name = "verification_document", indexes = @Index(name = "idx_verification_document_queue_id", columnList = "verification_queue_id"))
public class VerificationDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "verification_queue_id", nullable = false)
    private UUID verificationQueueId;

    @Column(name = "document_type_name", length = 120, nullable = false)
    private String documentTypeName;

    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    /*
     * @Lob alone maps byte[] to Postgres's "oid" (Large Object) type on Hibernate, which
     * needs the separate large-object API and isn't a plain column value - not what we want
     * for a straightforward "store the file bytes" column. @JdbcTypeCode(SqlTypes.VARBINARY)
     * is the dialect-aware way to get a real bytea column instead, the same fix this codebase
     * already applies to JSON columns (@JdbcTypeCode(SqlTypes.JSON) instead of a literal
     * columnDefinition="jsonb") for the identical "don't hardcode a Postgres-specific type"
     * reason.
     */
    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(name = "file_content")
    private byte[] fileContent;

    @Column(name = "file_name", length = 255)
    private String fileName;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "document_status", length = 20, nullable = false)
    private String documentStatus;

    @Column(name = "reject_reason", columnDefinition = "TEXT")
    private String rejectReason;

    @Column(name = "is_current_version", nullable = false)
    private Boolean isCurrentVersion;

    /** Account that uploaded this version (null on versions created before re-upload tracking). */
    @Column(name = "uploaded_by_account_id")
    private UUID uploadedByAccountId;

    /** Location Manager who last reviewed this version; null while it is still awaiting review. */
    @Column(name = "reviewed_by_account_id")
    private UUID reviewedByAccountId;

    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    /** The reviewer's note on this version (the re-upload reason, or an optional approval comment). */
    @Column(name = "reviewer_comment", columnDefinition = "TEXT")
    private String reviewerComment;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public VerificationDocument() {}

    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }

    public UUID getVerificationQueueId() { return verificationQueueId; }
    public void setVerificationQueueId(UUID verificationQueueId) { this.verificationQueueId = verificationQueueId; }

    public String getDocumentTypeName() { return documentTypeName; }
    public void setDocumentTypeName(String documentTypeName) { this.documentTypeName = documentTypeName; }

    public Integer getVersionNumber() { return versionNumber; }
    public void setVersionNumber(Integer versionNumber) { this.versionNumber = versionNumber; }

    public byte[] getFileContent() { return fileContent; }
    public void setFileContent(byte[] fileContent) { this.fileContent = fileContent; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public Long getFileSizeBytes() { return fileSizeBytes; }
    public void setFileSizeBytes(Long fileSizeBytes) { this.fileSizeBytes = fileSizeBytes; }

    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }

    public String getDocumentStatus() { return documentStatus; }
    public void setDocumentStatus(String documentStatus) { this.documentStatus = documentStatus; }

    public String getRejectReason() { return rejectReason; }
    public void setRejectReason(String rejectReason) { this.rejectReason = rejectReason; }

    public Boolean getIsCurrentVersion() { return isCurrentVersion; }
    public void setIsCurrentVersion(Boolean isCurrentVersion) { this.isCurrentVersion = isCurrentVersion; }

    public UUID getUploadedByAccountId() { return uploadedByAccountId; }
    public void setUploadedByAccountId(UUID uploadedByAccountId) { this.uploadedByAccountId = uploadedByAccountId; }

    public UUID getReviewedByAccountId() { return reviewedByAccountId; }
    public void setReviewedByAccountId(UUID reviewedByAccountId) { this.reviewedByAccountId = reviewedByAccountId; }

    public OffsetDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(OffsetDateTime reviewedAt) { this.reviewedAt = reviewedAt; }

    public String getReviewerComment() { return reviewerComment; }
    public void setReviewerComment(String reviewerComment) { this.reviewerComment = reviewerComment; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
