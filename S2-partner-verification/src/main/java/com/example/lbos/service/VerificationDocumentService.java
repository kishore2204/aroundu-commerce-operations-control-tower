package com.example.lbos.service;

import com.example.lbos.dto.VerificationDocumentDTO;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;

public interface VerificationDocumentService {
    VerificationDocumentDTO createVerificationDocument(VerificationDocumentDTO dto);
    VerificationDocumentDTO getVerificationDocumentById(UUID id);
    List<VerificationDocumentDTO> getAllVerificationDocuments();
    VerificationDocumentDTO updateVerificationDocument(UUID id, VerificationDocumentDTO dto);
    void deleteVerificationDocument(UUID id);
    List<VerificationDocumentDTO> getVerificationDocumentsByQueueId(UUID queueId);
    List<VerificationDocumentDTO> getVerificationDocumentsByStatus(String status);
    List<VerificationDocumentDTO> getVerificationDocumentsByIsCurrent(Boolean isCurrent);

    /** Records a Location Manager decision for one current document. A rejection keeps the
     * application open in RESUBMISSION_REQUIRED so only that document can be uploaded again. */
    VerificationDocumentDTO decideVerificationDocument(UUID id, String result, String reason);

    /**
     * Validates and stores {@code file} on disk, then creates the next version of the named
     * document type for the given verification queue: the previous current version (if any)
     * is flipped to isCurrentVersion=false, and the new row is inserted as
     * versionNumber = previous max + 1, isCurrentVersion=true, documentStatus=PENDING.
     */
    VerificationDocumentDTO uploadVerificationDocument(UUID verificationQueueId, String documentTypeName,
            LocalDate expiryDate, MultipartFile file);

    /**
     * Returns the raw stored file (bytes + name + content-type) for the given document, or
     * empty if the document doesn't exist or has no stored content (e.g. one created via the
     * plain JSON CRUD endpoints rather than the upload endpoint).
     */
    Optional<DocumentFile> getVerificationDocumentFile(UUID id);

    /**
     * Full version history (newest first) of one document type in a verification queue: every upload
     * is its own immutable version, with who uploaded it, its status and the reviewer's note.
     * Reviewers (and the submitter, for their own queue) only.
     */
    java.util.List<com.example.lbos.dto.DocumentVersionDTO> getDocumentHistory(UUID verificationQueueId, String documentTypeName);

    /**
     * The raw content of a stored verification document, for the file-download endpoint.
     */
    record DocumentFile(byte[] content, String fileName, String contentType) {
    }
}
