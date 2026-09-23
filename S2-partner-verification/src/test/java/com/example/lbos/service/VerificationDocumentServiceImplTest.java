package com.example.lbos.service;

import com.example.lbos.repository.VerificationDocumentRepository;
import com.example.lbos.dto.VerificationDocumentDTO;
import com.example.lbos.entity.VerificationDocument;
import com.example.lbos.exception.VerificationDocumentNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VerificationDocumentServiceImplTest {

    @Mock
    private VerificationDocumentRepository repository;

    @InjectMocks
    private VerificationDocumentServiceImpl service;

    private VerificationDocument entity;
    private VerificationDocumentDTO dto;
    private final UUID id = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        entity = new VerificationDocument();
        entity.setDocumentId(id);
        entity.setVerificationQueueId(UUID.randomUUID());
        entity.setDocumentTypeName("DRIVING_LICENSE");
        entity.setVersionNumber(1);
        entity.setFileName("test.pdf");
        entity.setContentType("application/pdf");
        entity.setFileSizeBytes(1024L);
        entity.setExpiryDate(LocalDate.of(2030, 12, 31));
        entity.setDocumentStatus("PENDING");
        entity.setIsCurrentVersion(true);
        entity.setCreatedAt(OffsetDateTime.now());
        entity.setUpdatedAt(OffsetDateTime.now());

        dto = new VerificationDocumentDTO();
        dto.setVerificationQueueId(entity.getVerificationQueueId());
        dto.setDocumentTypeName("DRIVING_LICENSE");
        dto.setVersionNumber(1);
        dto.setFileName("test.pdf");
        dto.setContentType("application/pdf");
        dto.setFileSizeBytes(1024L);
        dto.setDocumentStatus("PENDING");
        dto.setIsCurrentVersion(true);
    }

    @Test
    void createTest() {
        when(repository.save(any(VerificationDocument.class))).thenReturn(entity);
        VerificationDocumentDTO result = service.createVerificationDocument(dto);
        assertNotNull(result);
        verify(repository, times(1)).save(any(VerificationDocument.class));
    }

    @Test
    void getByIdTest() {
        when(repository.findById(id)).thenReturn(Optional.of(entity));
        VerificationDocumentDTO result = service.getVerificationDocumentById(id);
        assertNotNull(result);
    }

    @Test
    void getByIdNotFoundTest() {
        when(repository.findById(id)).thenReturn(Optional.empty());
        assertThrows(VerificationDocumentNotFoundException.class, () -> service.getVerificationDocumentById(id));
    }

    @Test
    void getAllTest() {
        when(repository.findAll()).thenReturn(Arrays.asList(entity));
        List<VerificationDocumentDTO> result = service.getAllVerificationDocuments();
        assertEquals(1, result.size());
    }

    @Test
    void updateTest() {
        when(repository.findById(id)).thenReturn(Optional.of(entity));
        when(repository.save(any(VerificationDocument.class))).thenReturn(entity);
        VerificationDocumentDTO result = service.updateVerificationDocument(id, dto);
        assertNotNull(result);
    }

    @Test
    void deleteTest() {
        when(repository.existsById(id)).thenReturn(true);
        doNothing().when(repository).deleteById(id);
        service.deleteVerificationDocument(id);
        verify(repository, times(1)).deleteById(id);
    }

    @Test
    void deleteNotFoundTest() {
        when(repository.existsById(id)).thenReturn(false);
        assertThrows(VerificationDocumentNotFoundException.class, () -> service.deleteVerificationDocument(id));
    }

    @Test
    void getByQueueIdTest() {
        // getVerificationDocumentsByQueueId() returns only current-version documents (see
        // VerificationDocumentServiceImpl - reviewers must see one row per document type, never
        // a superseded upload or a byte-less metadata placeholder alongside the real file).
        when(repository.findByVerificationQueueIdAndIsCurrentVersion(any(UUID.class), eq(true)))
                .thenReturn(Arrays.asList(entity));
        List<VerificationDocumentDTO> result = service.getVerificationDocumentsByQueueId(UUID.randomUUID());
        assertFalse(result.isEmpty());
    }

    @Test
    void getByStatusTest() {
        when(repository.findByDocumentStatus("PENDING")).thenReturn(Arrays.asList(entity));
        List<VerificationDocumentDTO> result = service.getVerificationDocumentsByStatus("PENDING");
        assertFalse(result.isEmpty());
    }
}
