package com.example.lbos.service;

import com.example.lbos.client.AccountLookupClient;
import com.example.lbos.client.NotificationClient;
import com.example.lbos.dto.DocumentVersionDTO;
import com.example.lbos.dto.VerificationDocumentDTO;
import com.example.lbos.entity.VerificationDocument;
import com.example.lbos.entity.VerificationQueue;
import com.example.lbos.exception.ForbiddenActionException;
import com.example.lbos.exception.InvalidVerificationTransitionException;
import com.example.lbos.repository.VerificationDocumentRepository;
import com.example.lbos.repository.VerificationDocumentRepository.VersionRow;
import com.example.lbos.repository.VerificationQueueRepository;
import com.example.lbos.storage.DocumentStorageService;
import com.example.lbos.storage.DocumentStorageService.StoredDocument;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** CR 10 - document re-upload workflow, immutable versions and per-document history. */
@ExtendWith(MockitoExtension.class)
class VerificationDocumentReuploadWorkflowTest {

    @Mock private VerificationDocumentRepository documents;
    @Mock private VerificationQueueRepository queues;
    @Mock private DocumentStorageService storage;
    @Mock private NotificationClient notifications;
    @Mock private AccountLookupClient accounts;
    @InjectMocks private VerificationDocumentServiceImpl service;

    private final UUID queueId = UUID.randomUUID();
    private final UUID submitterId = UUID.randomUUID();
    private final UUID reviewerId = UUID.randomUUID();
    private VerificationQueue queue;

    @BeforeEach
    void setUp() {
        queue = new VerificationQueue();
        queue.setVerificationQueueId(queueId);
        queue.setSubjectType("RETAILER");
        queue.setSubmittedByAccountId(submitterId);
        queue.setVerificationStatus("SENT_TO_LOCATION_MANAGER");
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private void signInAs(UUID accountId, String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                accountId.toString(), null, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    private VerificationDocument version(int number, String status, boolean current) {
        VerificationDocument document = new VerificationDocument();
        document.setDocumentId(UUID.randomUUID());
        document.setVerificationQueueId(queueId);
        document.setDocumentTypeName("GST_CERTIFICATE");
        document.setVersionNumber(number);
        document.setFileContent(new byte[] {1, 2, 3});
        document.setFileName("gst-v" + number + ".pdf");
        document.setDocumentStatus(status);
        document.setIsCurrentVersion(current);
        document.setCreatedAt(OffsetDateTime.now().minusDays(5 - number));
        document.setUpdatedAt(OffsetDateTime.now());
        return document;
    }

    // ------------------------------------------------------------------ requesting a re-upload

    @Test
    void reuploadRequestNeedsAReason() {
        VerificationDocument current = version(1, "PENDING", true);
        when(documents.findById(current.getDocumentId())).thenReturn(Optional.of(current));

        InvalidVerificationTransitionException failure = assertThrows(InvalidVerificationTransitionException.class,
                () -> service.decideVerificationDocument(current.getDocumentId(), "REJECTED", "  "));

        assertEquals("A reason is required when requesting a re-upload", failure.getMessage());
        verify(documents, never()).save(any());
        verifyNoInteractions(notifications);
    }

    @Test
    void reuploadRequestRecordsTheReviewerReopensTheApplicationAndNotifiesTheSubmitter() {
        signInAs(reviewerId, "LOCATION_MANAGER");
        VerificationDocument current = version(1, "PENDING", true);
        when(documents.findById(current.getDocumentId())).thenReturn(Optional.of(current));
        when(documents.save(any(VerificationDocument.class))).thenAnswer(call -> call.getArgument(0));
        when(queues.findById(queueId)).thenReturn(Optional.of(queue));

        VerificationDocumentDTO result = service.decideVerificationDocument(
                current.getDocumentId(), "REJECTED", "  Image is blurred  ");

        assertEquals("REJECTED", result.getDocumentStatus());
        assertEquals("Image is blurred", result.getRejectReason());
        assertEquals(reviewerId, current.getReviewedByAccountId());
        assertNotNull(current.getReviewedAt());
        assertEquals("Image is blurred", current.getReviewerComment());
        assertEquals("RESUBMISSION_REQUIRED", queue.getVerificationStatus());

        ArgumentCaptor<NotificationClient.NotificationCreateRequest> sent =
                ArgumentCaptor.forClass(NotificationClient.NotificationCreateRequest.class);
        verify(notifications).create(sent.capture());
        assertEquals(submitterId, sent.getValue().userAccountId());
        assertEquals("RETAILER", sent.getValue().role());
        assertEquals("DOCUMENT_REUPLOAD_REQUIRED", sent.getValue().notificationType());
        assertEquals("GST Certificate needs to be uploaded again. Reason: Image is blurred", sent.getValue().message());
    }

    @Test
    void aFailedNotificationNeverBlocksTheReviewDecision() {
        VerificationDocument current = version(1, "PENDING", true);
        when(documents.findById(current.getDocumentId())).thenReturn(Optional.of(current));
        when(documents.save(any(VerificationDocument.class))).thenAnswer(call -> call.getArgument(0));
        when(queues.findById(queueId)).thenReturn(Optional.of(queue));
        doThrow(new RuntimeException("S6 unreachable")).when(notifications).create(any());

        assertEquals("REJECTED", service.decideVerificationDocument(
                current.getDocumentId(), "REJECTED", "Expired").getDocumentStatus());
    }

    @Test
    void approvalRecordsTheReviewerAndSendsNoNotification() {
        signInAs(reviewerId, "LOCATION_MANAGER");
        VerificationDocument current = version(2, "RESUBMITTED", true);
        when(documents.findById(current.getDocumentId())).thenReturn(Optional.of(current));
        when(documents.save(any(VerificationDocument.class))).thenAnswer(call -> call.getArgument(0));

        assertEquals("APPROVED", service.decideVerificationDocument(current.getDocumentId(), "APPROVED", null).getDocumentStatus());
        assertEquals(reviewerId, current.getReviewedByAccountId());
        assertNull(current.getRejectReason());
        verifyNoInteractions(notifications);
    }

    // ------------------------------------------------------------------ uploading a new version

    private void stubUpload(List<VerificationDocument> existing) {
        when(queues.existsById(queueId)).thenReturn(true);
        when(storage.store(any())).thenReturn(new StoredDocument(new byte[] {9, 9}, "gst-new.pdf", "application/pdf", 2));
        when(documents.findByVerificationQueueIdAndDocumentTypeName(queueId, "GST_CERTIFICATE")).thenReturn(existing);
        when(documents.save(any(VerificationDocument.class))).thenAnswer(call -> call.getArgument(0));
    }

    private MockMultipartFile pdf() {
        return new MockMultipartFile("file", "gst-new.pdf", "application/pdf", new byte[] {9, 9});
    }

    @Test
    void uploadingAfterAReuploadRequestAddsANewVersionAndKeepsTheOldOneUntouched() {
        signInAs(submitterId, "RETAILER");
        VerificationDocument v1 = version(1, "REJECTED", true);
        v1.setRejectReason("Image is blurred");
        stubUpload(List.of(v1));

        VerificationDocumentDTO created = service.uploadVerificationDocument(queueId, "GST_CERTIFICATE", null, pdf());

        assertEquals(2, created.getVersionNumber());
        assertEquals("RESUBMITTED", created.getDocumentStatus());
        assertTrue(created.getIsCurrentVersion());
        // version 1 is history now: superseded, but its file, status and reason are exactly as they were
        assertFalse(v1.getIsCurrentVersion());
        assertEquals("REJECTED", v1.getDocumentStatus());
        assertEquals("Image is blurred", v1.getRejectReason());
        assertArrayEquals(new byte[] {1, 2, 3}, v1.getFileContent());
        assertEquals("gst-v1.pdf", v1.getFileName());

        ArgumentCaptor<VerificationDocument> saved = ArgumentCaptor.forClass(VerificationDocument.class);
        verify(documents, atLeastOnce()).save(saved.capture());
        VerificationDocument v2 = saved.getAllValues().stream().filter(doc -> doc != v1).findFirst().orElseThrow();
        assertNotSame(v1, v2);
        assertEquals(submitterId, v2.getUploadedByAccountId());
        assertNull(v2.getReviewedByAccountId());
    }

    @Test
    void aFirstUploadIsPendingReviewAndEveryLaterCycleGetsTheNextVersionNumber() {
        stubUpload(List.of());
        assertEquals("PENDING", service.uploadVerificationDocument(queueId, "GST_CERTIFICATE", null, pdf()).getDocumentStatus());

        VerificationDocument v1 = version(1, "REJECTED", false);
        VerificationDocument v2 = version(2, "REJECTED", false);
        VerificationDocument v3 = version(3, "REJECTED", true);
        when(documents.findByVerificationQueueIdAndDocumentTypeName(queueId, "GST_CERTIFICATE")).thenReturn(List.of(v1, v2, v3));
        assertEquals(4, service.uploadVerificationDocument(queueId, "GST_CERTIFICATE", null, pdf()).getVersionNumber());
    }

    @Test
    void anApprovedVersionIsNotReplacedUntilAReuploadIsRequested() {
        VerificationDocument approved = version(1, "APPROVED", true);
        when(queues.existsById(queueId)).thenReturn(true);
        when(storage.store(any())).thenReturn(new StoredDocument(new byte[] {9}, "gst-new.pdf", "application/pdf", 1));
        when(documents.findByVerificationQueueIdAndDocumentTypeName(queueId, "GST_CERTIFICATE")).thenReturn(List.of(approved));

        assertThrows(InvalidVerificationTransitionException.class,
                () -> service.uploadVerificationDocument(queueId, "GST_CERTIFICATE", null, pdf()));
        verify(documents, never()).save(any());
    }

    @Test
    void anUploadedVersionCannotBeEditedOrDeletedThroughTheCrudEndpoints() {
        VerificationDocument stored = version(1, "PENDING", true);
        when(documents.findById(stored.getDocumentId())).thenReturn(Optional.of(stored));
        when(documents.existsById(stored.getDocumentId())).thenReturn(true);

        assertThrows(InvalidVerificationTransitionException.class,
                () -> service.updateVerificationDocument(stored.getDocumentId(), new VerificationDocumentDTO()));
        assertThrows(InvalidVerificationTransitionException.class,
                () -> service.deleteVerificationDocument(stored.getDocumentId()));
        verify(documents, never()).save(any());
        verify(documents, never()).deleteById(any());
    }

    // ------------------------------------------------------------------ history

    private record Row(UUID id, int version, String status, UUID uploadedBy, UUID reviewedBy, String comment, String reason,
            boolean current) implements VersionRow {
        public UUID getDocumentId() { return id; }
        public Integer getVersionNumber() { return version; }
        public String getFileName() { return "gst-v" + version + ".pdf"; }
        public String getContentType() { return "application/pdf"; }
        public Long getFileSizeBytes() { return 3L; }
        public String getDocumentStatus() { return status; }
        public Boolean getIsCurrentVersion() { return current; }
        public OffsetDateTime getCreatedAt() { return OffsetDateTime.now().minusDays(5 - version); }
        public OffsetDateTime getUpdatedAt() { return OffsetDateTime.now(); }
        public UUID getUploadedByAccountId() { return uploadedBy; }
        public UUID getReviewedByAccountId() { return reviewedBy; }
        public OffsetDateTime getReviewedAt() { return reviewedBy == null ? null : OffsetDateTime.now(); }
        public String getReviewerComment() { return comment; }
        public String getRejectReason() { return reason; }
    }

    @Test
    void historyListsEveryVersionWithNamesStatusesAndTheReviewersNote() {
        signInAs(reviewerId, "LOCATION_MANAGER");
        when(queues.findById(queueId)).thenReturn(Optional.of(queue));
        when(documents.findVersionRows(queueId, "GST_CERTIFICATE")).thenReturn(List.of(
                new Row(UUID.randomUUID(), 3, "RESUBMITTED", submitterId, null, null, null, true),
                new Row(UUID.randomUUID(), 2, "REJECTED", submitterId, reviewerId, "Stamp missing", "Stamp missing", false),
                new Row(UUID.randomUUID(), 1, "REJECTED", submitterId, reviewerId, "Image is blurred", "Image is blurred", false)));
        when(accounts.get(submitterId)).thenReturn(new AccountLookupClient.AccountSummary(submitterId, "r@x.com", "Ravi", "Kumar", "RETAILER", null, "ACTIVE"));
        when(accounts.get(reviewerId)).thenReturn(new AccountLookupClient.AccountSummary(reviewerId, "lm@x.com", "Latha", "Menon", "LOCATION_MANAGER", null, "ACTIVE"));

        List<DocumentVersionDTO> history = service.getDocumentHistory(queueId, "GST_CERTIFICATE");

        assertEquals(List.of(3, 2, 1), history.stream().map(DocumentVersionDTO::getVersionNumber).toList());
        DocumentVersionDTO latest = history.get(0);
        assertEquals("RESUBMITTED", latest.getDocumentStatus());
        assertEquals("Ravi Kumar", latest.getUploadedByName());
        assertNull(latest.getReviewerName(), "still awaiting review - the screen shows Pending");
        assertNull(latest.getReviewedAt());
        DocumentVersionDTO earlier = history.get(1);
        assertEquals("Latha Menon", earlier.getReviewerName());
        assertEquals("Stamp missing", earlier.getReuploadReason());
        assertEquals("Stamp missing", earlier.getReviewerComment());
        verify(accounts, times(1)).get(submitterId); // each person is looked up once per history request
    }

    @Test
    void historyStillWorksWhenNamesCannotBeResolved() {
        when(queues.findById(queueId)).thenReturn(Optional.of(queue));
        when(documents.findVersionRows(queueId, "GST_CERTIFICATE")).thenReturn(List.of(
                new Row(UUID.randomUUID(), 1, "APPROVED", null, null, null, null, true)));
        queue.setReviewedByAccountId(reviewerId);
        when(accounts.get(any())).thenThrow(new RuntimeException("S1 unreachable"));

        DocumentVersionDTO only = service.getDocumentHistory(queueId, "GST_CERTIFICATE").get(0);

        assertEquals("Submitter", only.getUploadedByName());
        assertEquals("Reviewer", only.getReviewerName()); // decided with the whole application: falls back to the queue's reviewer
    }

    @Test
    void aSubmitterSeesTheirOwnHistoryButNotSomeoneElses() {
        when(queues.findById(queueId)).thenReturn(Optional.of(queue));
        when(documents.findVersionRows(queueId, "GST_CERTIFICATE")).thenReturn(List.of());

        signInAs(submitterId, "RETAILER");
        assertTrue(service.getDocumentHistory(queueId, "GST_CERTIFICATE").isEmpty());

        signInAs(UUID.randomUUID(), "RETAILER");
        assertThrows(ForbiddenActionException.class, () -> service.getDocumentHistory(queueId, "GST_CERTIFICATE"));
    }

    @Test
    void documentLabelsAreReadableAndKeepShortAcronymsUpperCase() {
        assertEquals("GST Certificate", VerificationDocumentServiceImpl.documentLabel("GST_CERTIFICATE"));
        assertEquals("PAN Card", VerificationDocumentServiceImpl.documentLabel("PAN_CARD"));
        assertEquals("Driving License", VerificationDocumentServiceImpl.documentLabel("DRIVING_LICENSE"));
    }
}
