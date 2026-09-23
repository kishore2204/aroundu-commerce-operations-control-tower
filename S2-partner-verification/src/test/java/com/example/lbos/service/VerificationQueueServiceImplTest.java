package com.example.lbos.service;

import com.example.lbos.repository.FleetOwnerRepository;
import com.example.lbos.repository.RetailerRepository;
import com.example.lbos.repository.VerificationDocumentRepository;
import com.example.lbos.repository.VerificationQueueRepository;
import com.example.lbos.dto.VerificationQueueDTO;
import com.example.lbos.entity.Retailer;
import com.example.lbos.entity.VerificationQueue;
import com.example.lbos.exception.InvalidVerificationTransitionException;
import com.example.lbos.exception.VerificationQueueNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VerificationQueueServiceImplTest {

    @Mock
    private VerificationQueueRepository repository;

    @Mock
    private RetailerRepository retailerRepository;

    @Mock
    private FleetOwnerRepository fleetOwnerRepository;

    @Mock
    private VerificationDocumentRepository verificationDocumentRepository;

    @InjectMocks
    private VerificationQueueServiceImpl service;

    private VerificationQueue entity;
    private VerificationQueueDTO dto;
    private final UUID id = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        entity = new VerificationQueue();
        entity.setVerificationQueueId(id);
        entity.setSubjectType("RETAILER");
        entity.setSubjectId(UUID.randomUUID());
        entity.setIsActive(true);
        entity.setSubmittedByAccountId(UUID.randomUUID());
        entity.setVerificationStatus("PENDING");
        entity.setCreatedAt(OffsetDateTime.now());
        entity.setUpdatedAt(OffsetDateTime.now());

        dto = new VerificationQueueDTO();
        dto.setSubjectType("RETAILER");
        dto.setSubjectId(entity.getSubjectId());
        dto.setIsActive(true);
        dto.setSubmittedByAccountId(entity.getSubmittedByAccountId());
        dto.setVerificationStatus("PENDING");
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createTest() {
        when(repository.save(any(VerificationQueue.class))).thenReturn(entity);
        VerificationQueueDTO result = service.createVerificationQueue(dto);
        assertNotNull(result);
        verify(repository, times(1)).save(any(VerificationQueue.class));
    }

    @Test
    void getByIdTest() {
        when(repository.findById(id)).thenReturn(Optional.of(entity));
        VerificationQueueDTO result = service.getVerificationQueueById(id);
        assertNotNull(result);
    }

    @Test
    void getByIdNotFoundTest() {
        when(repository.findById(id)).thenReturn(Optional.empty());
        assertThrows(VerificationQueueNotFoundException.class, () -> service.getVerificationQueueById(id));
    }

    @Test
    void getAllTest() {
        when(repository.findAll()).thenReturn(Arrays.asList(entity));
        List<VerificationQueueDTO> result = service.getAllVerificationQueues();
        assertEquals(1, result.size());
    }

    @Test
    void updateTest() {
        when(repository.findById(id)).thenReturn(Optional.of(entity));
        when(repository.save(any(VerificationQueue.class))).thenReturn(entity);
        VerificationQueueDTO result = service.updateVerificationQueue(id, dto);
        assertNotNull(result);
    }

    @Test
    void deleteTest() {
        when(repository.existsById(id)).thenReturn(true);
        doNothing().when(repository).deleteById(id);
        service.deleteVerificationQueue(id);
        verify(repository, times(1)).deleteById(id);
    }

    @Test
    void deleteNotFoundTest() {
        when(repository.existsById(id)).thenReturn(false);
        assertThrows(VerificationQueueNotFoundException.class, () -> service.deleteVerificationQueue(id));
    }

    @Test
    void getBySubjectIdTest() {
        when(repository.findBySubjectId(any(UUID.class))).thenReturn(Arrays.asList(entity));
        List<VerificationQueueDTO> result = service.getVerificationQueuesBySubjectId(UUID.randomUUID());
        assertFalse(result.isEmpty());
    }

    @Test
    void getByStatusTest() {
        when(repository.findByVerificationStatus("PENDING")).thenReturn(Arrays.asList(entity));
        List<VerificationQueueDTO> result = service.getVerificationQueuesByStatus("PENDING");
        assertFalse(result.isEmpty());
    }

    @Test
    void assignReviewerTest() {
        UUID reviewerAccountId = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.of(entity));
        when(repository.save(any(VerificationQueue.class))).thenReturn(entity);

        VerificationQueueDTO result = service.assignReviewer(id, reviewerAccountId);

        assertNotNull(result);
        assertEquals(reviewerAccountId, result.getReviewedByAccountId());
        assertEquals(reviewerAccountId, entity.getReviewedByAccountId());
        verify(repository, times(1)).save(entity);
    }

    @Test
    void assignReviewerNotFoundTest() {
        UUID reviewerAccountId = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThrows(VerificationQueueNotFoundException.class, () -> service.assignReviewer(id, reviewerAccountId));
        verify(repository, never()).save(any(VerificationQueue.class));
    }

    @Test
    void getByIsActiveTest() {
        when(repository.findByIsActive(true)).thenReturn(Arrays.asList(entity));
        List<VerificationQueueDTO> result = service.getVerificationQueuesByIsActive(true);
        assertFalse(result.isEmpty());
    }

    @Test
    void processVerificationResultApprovesAPendingRetailerQueueAndVerifiesTheRetailer() {
        Retailer retailer = new Retailer();
        retailer.setRetailerId(entity.getSubjectId());
        retailer.setRetailerStatus("PENDING_VERIFICATION");

        // Approving a retailer application now requires every required document type
        // (ADDRESS_PROOF, BUSINESS_LICENSE, GST_CERTIFICATE, PAN_CARD) to already be an
        // APPROVED current-version document - see VerificationQueueServiceImpl.processVerificationResult().
        List<com.example.lbos.entity.VerificationDocument> approvedDocuments = List.of(
                "ADDRESS_PROOF", "BUSINESS_LICENSE", "GST_CERTIFICATE", "PAN_CARD").stream()
                .map(type -> {
                    var doc = new com.example.lbos.entity.VerificationDocument();
                    doc.setVerificationQueueId(id);
                    doc.setDocumentTypeName(type);
                    doc.setDocumentStatus("APPROVED");
                    doc.setIsCurrentVersion(true);
                    return doc;
                }).toList();

        when(repository.findById(id)).thenReturn(Optional.of(entity));
        when(retailerRepository.findById(entity.getSubjectId())).thenReturn(Optional.of(retailer));
        when(verificationDocumentRepository.findByVerificationQueueIdAndIsCurrentVersion(id, true))
                .thenReturn(approvedDocuments);
        when(repository.save(any(VerificationQueue.class))).thenReturn(entity);

        service.processVerificationResult(id, "APPROVED", null);

        assertEquals("APPROVED", entity.getVerificationStatus());
        assertFalse(entity.getIsActive());
        assertEquals("VERIFIED", retailer.getRetailerStatus());
        verify(retailerRepository, times(1)).save(retailer);
    }

    @Test
    void processVerificationResultRejectsAnAlreadyDecidedQueue() {
        entity.setVerificationStatus("APPROVED");
        when(repository.findById(id)).thenReturn(Optional.of(entity));

        assertThrows(InvalidVerificationTransitionException.class,
                () -> service.processVerificationResult(id, "REJECTED", "too late"));

        verify(repository, never()).save(any());
    }

    @Test
    void processVerificationResultRejectsAnUnrecognizedResultValue() {
        assertThrows(InvalidVerificationTransitionException.class,
                () -> service.processVerificationResult(id, "MAYBE", null));

        verify(repository, never()).findById(any());
    }

    @Test
    void processVerificationResultRejectsAReviewerDecidingOnTheirOwnSubmission() {
        when(repository.findById(id)).thenReturn(Optional.of(entity));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(entity.getSubmittedByAccountId().toString(), null, List.of()));

        assertThrows(InvalidVerificationTransitionException.class,
                () -> service.processVerificationResult(id, "APPROVED", null));

        verify(repository, never()).save(any());
    }
}
