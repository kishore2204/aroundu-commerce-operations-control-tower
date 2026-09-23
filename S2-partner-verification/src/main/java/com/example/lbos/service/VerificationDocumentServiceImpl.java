package com.example.lbos.service;

import com.example.lbos.client.AccountLookupClient;
import com.example.lbos.client.NotificationClient;
import com.example.lbos.dto.DocumentVersionDTO;
import com.example.lbos.exception.ForbiddenActionException;
import com.example.lbos.exception.InvalidVerificationTransitionException;
import com.example.lbos.repository.VerificationDocumentRepository;
import com.example.lbos.repository.VerificationQueueRepository;
import com.example.lbos.dto.VerificationDocumentDTO;
import com.example.lbos.entity.VerificationDocument;
import com.example.lbos.exception.VerificationDocumentNotFoundException;
import com.example.lbos.exception.VerificationQueueNotFoundException;
import com.example.lbos.storage.DocumentStorageService;
import com.example.lbos.storage.DocumentStorageService.StoredDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class VerificationDocumentServiceImpl implements VerificationDocumentService {

    private static final Logger log = LoggerFactory.getLogger(VerificationDocumentServiceImpl.class);

    private final VerificationDocumentRepository verificationDocumentRepository;
    private final VerificationQueueRepository verificationQueueRepository;
    private final DocumentStorageService documentStorageService;
    private final NotificationClient notificationClient;
    private final AccountLookupClient accountLookupClient;

    public VerificationDocumentServiceImpl(VerificationDocumentRepository verificationDocumentRepository,
            VerificationQueueRepository verificationQueueRepository,
            DocumentStorageService documentStorageService,
            NotificationClient notificationClient,
            AccountLookupClient accountLookupClient) {
        this.verificationDocumentRepository = verificationDocumentRepository;
        this.verificationQueueRepository = verificationQueueRepository;
        this.documentStorageService = documentStorageService;
        this.notificationClient = notificationClient;
        this.accountLookupClient = accountLookupClient;
    }

    @Override
    public VerificationDocumentDTO createVerificationDocument(VerificationDocumentDTO dto) {
        VerificationDocument entity = mapToEntity(dto);
        
        if (entity.getCreatedAt() == null) {
            entity.setCreatedAt(OffsetDateTime.now());
        }
        entity.setUpdatedAt(OffsetDateTime.now());
        
        VerificationDocument saved = verificationDocumentRepository.save(entity);
        return mapToDTO(saved);
    }

    @Override
    public VerificationDocumentDTO getVerificationDocumentById(UUID id) {
        VerificationDocument entity = verificationDocumentRepository.findById(id)
                .orElseThrow(() -> new VerificationDocumentNotFoundException("VerificationDocument not found with id: " + id));
        return mapToDTO(entity);
    }

    @Override
    public List<VerificationDocumentDTO> getAllVerificationDocuments() {
        return verificationDocumentRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public VerificationDocumentDTO updateVerificationDocument(UUID id, VerificationDocumentDTO dto) {
        VerificationDocument existing = verificationDocumentRepository.findById(id)
                .orElseThrow(() -> new VerificationDocumentNotFoundException("VerificationDocument not found with id: " + id));
        assertNotSubmittedVersion(existing);

        existing.setVerificationQueueId(dto.getVerificationQueueId());
        existing.setDocumentTypeName(dto.getDocumentTypeName());
        existing.setVersionNumber(dto.getVersionNumber());
        existing.setFileName(dto.getFileName());
        existing.setContentType(dto.getContentType());
        existing.setFileSizeBytes(dto.getFileSizeBytes());
        existing.setExpiryDate(dto.getExpiryDate());
        existing.setDocumentStatus(dto.getDocumentStatus());
        existing.setRejectReason(dto.getRejectReason());
        existing.setIsCurrentVersion(dto.getIsCurrentVersion());
        existing.setUpdatedAt(OffsetDateTime.now());

        VerificationDocument updated = verificationDocumentRepository.save(existing);
        return mapToDTO(updated);
    }

    @Override
    public void deleteVerificationDocument(UUID id) {
        if (!verificationDocumentRepository.existsById(id)) {
            throw new VerificationDocumentNotFoundException("VerificationDocument not found with id: " + id);
        }
        verificationDocumentRepository.findById(id).ifPresent(this::assertNotSubmittedVersion);
        verificationDocumentRepository.deleteById(id);
    }

    @Override
    public List<VerificationDocumentDTO> getVerificationDocumentsByQueueId(UUID queueId) {
        // Reviewer screens must show exactly one row per document type. Historical metadata
        // placeholders and superseded upload versions are intentionally excluded here.
        return verificationDocumentRepository.findByVerificationQueueIdAndIsCurrentVersion(queueId, true).stream()
                .collect(java.util.stream.Collectors.toMap(
                        VerificationDocument::getDocumentTypeName,
                        java.util.function.Function.identity(),
                        (left, right) -> preferredCurrentDocument(left, right)))
                .values().stream()
                .sorted(Comparator.comparing(VerificationDocument::getDocumentTypeName))
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<VerificationDocumentDTO> getVerificationDocumentsByStatus(String status) {
        return verificationDocumentRepository.findByDocumentStatus(status).stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public List<VerificationDocumentDTO> getVerificationDocumentsByIsCurrent(Boolean isCurrent) {
        return verificationDocumentRepository.findByIsCurrentVersion(isCurrent).stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public VerificationDocumentDTO uploadVerificationDocument(UUID verificationQueueId, String documentTypeName,
            LocalDate expiryDate, MultipartFile file) {
        if (!verificationQueueRepository.existsById(verificationQueueId)) {
            throw new VerificationQueueNotFoundException("VerificationQueue not found with id: " + verificationQueueId);
        }

        // Validates the file (type/size/emptiness) and reads its bytes before touching the DB.
        StoredDocument storedDocument = documentStorageService.store(file);

        List<VerificationDocument> existingVersions = verificationDocumentRepository
                .findByVerificationQueueIdAndDocumentTypeName(verificationQueueId, documentTypeName);

        Optional<VerificationDocument> placeholder = existingVersions.stream()
                .filter(doc -> Boolean.TRUE.equals(doc.getIsCurrentVersion()) && doc.getFileContent() == null)
                .max(Comparator.comparing(doc -> doc.getVersionNumber() == null ? 0 : doc.getVersionNumber()));

        int nextVersionNumber = existingVersions.stream()
                .map(VerificationDocument::getVersionNumber)
                .filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(0) + 1;

        // Every upload is a NEW version; the one it replaces is kept as history. A version that is
        // already approved is only replaced after the Location Manager asks for a re-upload.
        Optional<VerificationDocument> previousCurrent = existingVersions.stream()
                .filter(doc -> Boolean.TRUE.equals(doc.getIsCurrentVersion()) && doc.getFileContent() != null)
                .max(Comparator.comparing(doc -> doc.getVersionNumber() == null ? 0 : doc.getVersionNumber()));
        if (previousCurrent.isPresent() && "APPROVED".equalsIgnoreCase(previousCurrent.get().getDocumentStatus())) {
            throw new InvalidVerificationTransitionException(
                    "This document is already approved. A new version can only be uploaded after a re-upload is requested.");
        }
        boolean answersReuploadRequest = previousCurrent.isPresent()
                && "REJECTED".equalsIgnoreCase(previousCurrent.get().getDocumentStatus());

        VerificationDocument entity;
        if (placeholder.isPresent()) {
            // Older onboarding code created a metadata-only row first. Fill that row instead of
            // inserting a second phantom document that cannot be previewed.
            entity = placeholder.get();
            if (entity.getVersionNumber() == null) entity.setVersionNumber(Math.max(1, nextVersionNumber - 1));
            entity.setCreatedAt(OffsetDateTime.now()); // the moment this version's file was actually uploaded
        } else {
            entity = new VerificationDocument();
            entity.setVerificationQueueId(verificationQueueId);
            entity.setDocumentTypeName(documentTypeName);
            entity.setVersionNumber(nextVersionNumber);
            entity.setCreatedAt(OffsetDateTime.now());
        }
        // Guarantee one current row per document type. This also repairs older duplicate-current
        // rows lazily without deleting any data.
        VerificationDocument selectedEntity = entity;
        existingVersions.stream()
                .filter(doc -> Boolean.TRUE.equals(doc.getIsCurrentVersion()) && doc != selectedEntity)
                .forEach(doc -> {
                    doc.setIsCurrentVersion(false);
                    doc.setUpdatedAt(OffsetDateTime.now());
                    verificationDocumentRepository.save(doc);
                });

        entity.setFileContent(storedDocument.content());
        entity.setFileName(storedDocument.fileName());
        entity.setContentType(storedDocument.contentType());
        entity.setFileSizeBytes(storedDocument.sizeBytes());
        entity.setExpiryDate(expiryDate);
        entity.setDocumentStatus(answersReuploadRequest ? "RESUBMITTED" : "PENDING");
        entity.setRejectReason(null);
        entity.setUploadedByAccountId(resolveAuthenticatedAccountId());
        entity.setReviewedByAccountId(null);
        entity.setReviewedAt(null);
        entity.setReviewerComment(null);
        entity.setIsCurrentVersion(true);
        if (entity.getCreatedAt() == null) entity.setCreatedAt(OffsetDateTime.now());
        entity.setUpdatedAt(OffsetDateTime.now());

        VerificationDocument saved = verificationDocumentRepository.save(entity);
        return mapToDTO(saved);
    }

    @Override
    @Transactional
    public VerificationDocumentDTO decideVerificationDocument(UUID id, String result, String reason) {
        if (!"APPROVED".equalsIgnoreCase(result) && !"REJECTED".equalsIgnoreCase(result)) {
            throw new InvalidVerificationTransitionException("result must be APPROVED or REJECTED");
        }
        VerificationDocument document = verificationDocumentRepository.findById(id)
                .orElseThrow(() -> new VerificationDocumentNotFoundException("VerificationDocument not found with id: " + id));
        if (!Boolean.TRUE.equals(document.getIsCurrentVersion())) {
            throw new InvalidVerificationTransitionException("Only the current document version can be reviewed");
        }
        if ("REJECTED".equalsIgnoreCase(result) && (reason == null || reason.isBlank())) {
            throw new InvalidVerificationTransitionException("A reason is required when requesting a re-upload");
        }
        boolean reuploadRequested = "REJECTED".equalsIgnoreCase(result);
        OffsetDateTime now = OffsetDateTime.now();
        document.setDocumentStatus(result.toUpperCase());
        document.setRejectReason(reuploadRequested ? reason.trim() : null);
        document.setReviewerComment(reason == null || reason.isBlank() ? null : reason.trim());
        document.setReviewedByAccountId(resolveAuthenticatedAccountId());
        document.setReviewedAt(now);
        document.setUpdatedAt(now);
        VerificationDocument saved = verificationDocumentRepository.save(document);

        if ("REJECTED".equalsIgnoreCase(result)) {
            com.example.lbos.entity.VerificationQueue queue = verificationQueueRepository.findById(document.getVerificationQueueId())
                    .orElseThrow(() -> new VerificationQueueNotFoundException("VerificationQueue not found with id: " + document.getVerificationQueueId()));
            queue.setVerificationStatus("RESUBMISSION_REQUIRED");
            queue.setRejectionReason(document.getDocumentTypeName() + ": " + reason.trim());
            queue.setIsActive(true);
            queue.setUpdatedAt(OffsetDateTime.now());
            verificationQueueRepository.save(queue);
            notifyReuploadRequested(queue, document, reason.trim());
        }
        return mapToDTO(saved);
    }

    // ------------------------------------------------------------------ history

    @Override
    @Transactional(readOnly = true)
    public List<DocumentVersionDTO> getDocumentHistory(UUID verificationQueueId, String documentTypeName) {
        com.example.lbos.entity.VerificationQueue queue = verificationQueueRepository.findById(verificationQueueId)
                .orElseThrow(() -> new VerificationQueueNotFoundException("VerificationQueue not found with id: " + verificationQueueId));
        assertCanViewHistory(queue);

        java.util.Map<UUID, String> names = new java.util.HashMap<>();
        return verificationDocumentRepository.findVersionRows(verificationQueueId, documentTypeName).stream().map(row -> {
            String status = row.getDocumentStatus() == null ? "PENDING" : row.getDocumentStatus().toUpperCase();
            boolean decided = "APPROVED".equals(status) || "REJECTED".equals(status);
            // Versions decided as part of the whole-application decision carry no reviewer of their own.
            UUID reviewerId = row.getReviewedByAccountId() != null ? row.getReviewedByAccountId()
                    : decided ? queue.getReviewedByAccountId() : null;
            UUID uploaderId = row.getUploadedByAccountId() != null ? row.getUploadedByAccountId() : queue.getSubmittedByAccountId();

            DocumentVersionDTO dto = new DocumentVersionDTO();
            dto.setDocumentId(row.getDocumentId());
            dto.setVersionNumber(row.getVersionNumber());
            dto.setFileName(row.getFileName());
            dto.setContentType(row.getContentType());
            dto.setFileSizeBytes(row.getFileSizeBytes());
            dto.setDocumentStatus(status);
            dto.setIsCurrentVersion(row.getIsCurrentVersion());
            dto.setUploadedAt(row.getCreatedAt());
            dto.setUploadedByName(displayName(uploaderId, names, "Submitter"));
            dto.setReviewerName(reviewerId == null ? null : displayName(reviewerId, names, "Reviewer"));
            dto.setReviewedAt(row.getReviewedAt() != null ? row.getReviewedAt() : decided ? row.getUpdatedAt() : null);
            dto.setReviewerComment(row.getReviewerComment() != null ? row.getReviewerComment()
                    : "REJECTED".equals(status) ? row.getRejectReason() : null);
            dto.setReuploadReason("REJECTED".equals(status) ? row.getRejectReason() : null);
            return dto;
        }).collect(Collectors.toList());
    }

    /** Reviewers see any queue's history; anyone else only the history of a queue they submitted themselves. */
    private void assertCanViewHistory(com.example.lbos.entity.VerificationQueue queue) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return;
        }
        boolean reviewer = authentication.getAuthorities().stream().anyMatch(authority -> java.util.Set.of(
                "ROLE_SUPER_ADMIN", "ROLE_OPERATIONS_MANAGER", "ROLE_LOCATION_MANAGER").contains(authority.getAuthority()));
        UUID caller = resolveAuthenticatedAccountId();
        if (!reviewer && (caller == null || !caller.equals(queue.getSubmittedByAccountId()))) {
            throw new ForbiddenActionException("You do not have access to this document's history");
        }
    }

    private String displayName(UUID accountId, java.util.Map<UUID, String> cache, String fallback) {
        if (accountId == null || accountLookupClient == null) {
            return fallback;
        }
        return cache.computeIfAbsent(accountId, id -> {
            try {
                AccountLookupClient.AccountSummary account = accountLookupClient.get(id);
                String name = ((account.firstName() == null ? "" : account.firstName()) + " "
                        + (account.lastName() == null ? "" : account.lastName())).trim();
                if (!name.isEmpty()) return name;
                return account.email() == null || account.email().isBlank() ? fallback : account.email();
            } catch (Exception lookupFailure) {
                log.warn("Could not resolve the display name of account {}: {}", id, lookupFailure.getMessage());
                return fallback;
            }
        });
    }

    // ------------------------------------------------------------------ notification / helpers

    /**
     * In-app notification (S6's existing notification inbox) telling the submitter which document has
     * to be uploaded again and why. Sent after the decision commits and best-effort: a delivery failure
     * is logged and never rolls back the review decision.
     */
    private void notifyReuploadRequested(com.example.lbos.entity.VerificationQueue queue,
            VerificationDocument document, String reason) {
        if (notificationClient == null || queue.getSubmittedByAccountId() == null) {
            return;
        }
        NotificationClient.NotificationCreateRequest request = new NotificationClient.NotificationCreateRequest(
                queue.getSubmittedByAccountId(),
                "RETAILER".equalsIgnoreCase(queue.getSubjectType()) ? "RETAILER" : "FLEET_MANAGER",
                "DOCUMENT_REUPLOAD_REQUIRED",
                "VERIFICATION_QUEUE",
                String.valueOf(queue.getVerificationQueueId()),
                "Document re-upload required",
                documentLabel(document.getDocumentTypeName()) + " needs to be uploaded again. Reason: " + reason);
        Runnable send = () -> {
            try {
                notificationClient.create(request);
            } catch (Exception deliveryFailure) {
                log.warn("Could not notify account {} about the re-upload request for {}: {}",
                        request.userAccountId(), document.getDocumentTypeName(), deliveryFailure.getMessage());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }

    /** GST_CERTIFICATE -> "GST Certificate" (short words such as GST/PAN stay upper-case). */
    static String documentLabel(String documentTypeName) {
        if (documentTypeName == null || documentTypeName.isBlank()) {
            return "The document";
        }
        return java.util.Arrays.stream(documentTypeName.split("_"))
                .filter(word -> !word.isEmpty())
                .map(word -> word.length() <= 3 ? word.toUpperCase()
                        : word.substring(0, 1).toUpperCase() + word.substring(1).toLowerCase())
                .collect(Collectors.joining(" "));
    }

    /** A stored version (one with file bytes) is history: it can be superseded by a new version, never edited or deleted. */
    private void assertNotSubmittedVersion(VerificationDocument document) {
        if (document.getFileContent() != null) {
            throw new InvalidVerificationTransitionException(
                    "An uploaded document version cannot be changed or deleted. Upload a new version instead.");
        }
    }

    private UUID resolveAuthenticatedAccountId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException notAnAccountId) {
            return null;
        }
    }

    @Override
    public Optional<DocumentFile> getVerificationDocumentFile(UUID id) {
        return verificationDocumentRepository.findById(id)
                .filter(entity -> entity.getFileContent() != null)
                .map(entity -> new DocumentFile(entity.getFileContent(), entity.getFileName(), entity.getContentType()));
    }

    /**
     * Legacy data can contain more than one row marked current for the same document type.
     * Prefer a real uploaded file over a metadata-only placeholder, then the highest version and
     * most recently updated row. This keeps reviewer screens deterministic without deleting any
     * historical database row.
     */
    private VerificationDocument preferredCurrentDocument(VerificationDocument left, VerificationDocument right) {
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

    private VerificationDocument mapToEntity(VerificationDocumentDTO dto) {
        VerificationDocument entity = new VerificationDocument();
        entity.setDocumentId(dto.getDocumentId());
        entity.setVerificationQueueId(dto.getVerificationQueueId());
        entity.setDocumentTypeName(dto.getDocumentTypeName());
        entity.setVersionNumber(dto.getVersionNumber());
        entity.setFileName(dto.getFileName());
        entity.setContentType(dto.getContentType());
        entity.setFileSizeBytes(dto.getFileSizeBytes());
        entity.setExpiryDate(dto.getExpiryDate());
        entity.setDocumentStatus(dto.getDocumentStatus());
        entity.setRejectReason(dto.getRejectReason());
        entity.setIsCurrentVersion(dto.getIsCurrentVersion());
        entity.setCreatedAt(dto.getCreatedAt());
        entity.setUpdatedAt(dto.getUpdatedAt());
        return entity;
    }

    private VerificationDocumentDTO mapToDTO(VerificationDocument entity) {
        VerificationDocumentDTO dto = new VerificationDocumentDTO();
        dto.setDocumentId(entity.getDocumentId());
        dto.setVerificationQueueId(entity.getVerificationQueueId());
        dto.setDocumentTypeName(entity.getDocumentTypeName());
        dto.setVersionNumber(entity.getVersionNumber());
        dto.setFileName(entity.getFileName());
        dto.setContentType(entity.getContentType());
        dto.setFileSizeBytes(entity.getFileSizeBytes());
        dto.setExpiryDate(entity.getExpiryDate());
        dto.setDocumentStatus(entity.getDocumentStatus());
        dto.setRejectReason(entity.getRejectReason());
        dto.setIsCurrentVersion(entity.getIsCurrentVersion());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }
}
