package com.example.lbos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(description = "Verification Document Data Transfer Object")
public class VerificationDocumentDTO {

    @Schema(description = "Unique identifier of the verification document", example = "123e4567-e89b-12d3-a456-426614174000", accessMode = Schema.AccessMode.READ_ONLY)
    private UUID documentId;

    @NotNull(message = "verificationQueueId cannot be null")
    @Schema(description = "ID of the verification queue this document belongs to", example = "123e4567-e89b-12d3-a456-426614174001")
    private UUID verificationQueueId;

    @NotBlank(message = "documentTypeName cannot be empty")
    @Schema(description = "Type name of the document", example = "DRIVING_LICENSE")
    private String documentTypeName;

    @NotNull(message = "versionNumber cannot be null")
    @Schema(description = "Version number of the document", example = "1")
    private Integer versionNumber;

    @Schema(description = "Original/generated name of the stored file", example = "b3f1c2a4-1234-4a5b-9c1d-abcdef123456.pdf")
    private String fileName;

    @Schema(description = "MIME content-type of the stored file", example = "application/pdf")
    private String contentType;

    @Schema(description = "Size in bytes of the stored file", example = "245678")
    private Long fileSizeBytes;

    @Schema(description = "Expiry date of the document", example = "2030-12-31")
    private LocalDate expiryDate;

    @NotBlank(message = "documentStatus cannot be empty")
    @Schema(description = "Current status of the document", example = "PENDING")
    private String documentStatus;

    @Schema(description = "Reason for rejection, if applicable", example = "Image is blurred")
    private String rejectReason;

    @NotNull(message = "isCurrentVersion cannot be null")
    @Schema(description = "Flag indicating if this is the current version of the document", example = "true")
    private Boolean isCurrentVersion;

    @Schema(description = "Timestamp when the record was created")
    private OffsetDateTime createdAt;
    @Schema(description = "Timestamp when the record was last updated")
    private OffsetDateTime updatedAt;

    public VerificationDocumentDTO() {}

    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }

    public UUID getVerificationQueueId() { return verificationQueueId; }
    public void setVerificationQueueId(UUID verificationQueueId) { this.verificationQueueId = verificationQueueId; }

    public String getDocumentTypeName() { return documentTypeName; }
    public void setDocumentTypeName(String documentTypeName) { this.documentTypeName = documentTypeName; }

    public Integer getVersionNumber() { return versionNumber; }
    public void setVersionNumber(Integer versionNumber) { this.versionNumber = versionNumber; }

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

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
