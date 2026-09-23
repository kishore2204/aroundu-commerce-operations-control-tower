package com.example.lbos.repository;

import com.example.lbos.entity.VerificationDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface VerificationDocumentRepository extends JpaRepository<VerificationDocument, UUID> {
    List<VerificationDocument> findByVerificationQueueId(UUID verificationQueueId);
    List<VerificationDocument> findByDocumentStatus(String documentStatus);
    List<VerificationDocument> findByDocumentTypeName(String documentTypeName);
    List<VerificationDocument> findByIsCurrentVersion(Boolean isCurrentVersion);
    List<VerificationDocument> findByVerificationQueueIdAndIsCurrentVersion(UUID verificationQueueId, Boolean isCurrentVersion);
    List<VerificationDocument> findByVerificationQueueIdAndDocumentTypeName(UUID verificationQueueId, String documentTypeName);

    /** Every uploaded version of one document type, newest first - selected column by column so the file bytes are never loaded. */
    @Query("select d.documentId as documentId, d.versionNumber as versionNumber, d.fileName as fileName, "
            + "d.contentType as contentType, d.fileSizeBytes as fileSizeBytes, d.documentStatus as documentStatus, "
            + "d.isCurrentVersion as isCurrentVersion, d.createdAt as createdAt, d.updatedAt as updatedAt, "
            + "d.uploadedByAccountId as uploadedByAccountId, d.reviewedByAccountId as reviewedByAccountId, "
            + "d.reviewedAt as reviewedAt, d.reviewerComment as reviewerComment, d.rejectReason as rejectReason "
            + "from VerificationDocument d where d.verificationQueueId = :queueId and d.documentTypeName = :type "
            + "and d.fileContent is not null order by d.versionNumber desc")
    List<VersionRow> findVersionRows(@Param("queueId") UUID verificationQueueId, @Param("type") String documentTypeName);

    interface VersionRow {
        UUID getDocumentId();
        Integer getVersionNumber();
        String getFileName();
        String getContentType();
        Long getFileSizeBytes();
        String getDocumentStatus();
        Boolean getIsCurrentVersion();
        java.time.OffsetDateTime getCreatedAt();
        java.time.OffsetDateTime getUpdatedAt();
        UUID getUploadedByAccountId();
        UUID getReviewedByAccountId();
        java.time.OffsetDateTime getReviewedAt();
        String getReviewerComment();
        String getRejectReason();
    }
}
