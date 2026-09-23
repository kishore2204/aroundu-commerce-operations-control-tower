package com.example.lbos.controller;

import com.example.lbos.dto.VerificationDocumentDTO;
import com.example.lbos.service.VerificationDocumentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Arrays;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class VerificationDocumentControllerTest {

    private MockMvc mockMvc;

    @Mock
    private VerificationDocumentService service;

    @InjectMocks
    private VerificationDocumentController controller;

    private ObjectMapper objectMapper;
    private VerificationDocumentDTO dto;
    private final UUID id = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        dto = new VerificationDocumentDTO();
        dto.setDocumentId(id);
        dto.setVerificationQueueId(UUID.randomUUID());
        dto.setDocumentTypeName("DRIVING_LICENSE");
        dto.setVersionNumber(1);
        dto.setFileName("test.pdf");
        dto.setContentType("application/pdf");
        dto.setFileSizeBytes(1024L);
        dto.setDocumentStatus("PENDING");
        dto.setIsCurrentVersion(true);
    }

    @Test
    void testCreate() throws Exception {
        when(service.createVerificationDocument(any(VerificationDocumentDTO.class))).thenReturn(dto);

        mockMvc.perform(post("/api/verification-documents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.documentId").value(id.toString()));
    }

    @Test
    void testGetAll() throws Exception {
        when(service.getAllVerificationDocuments()).thenReturn(Arrays.asList(dto));

        mockMvc.perform(get("/api/verification-documents")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    void testGetById() throws Exception {
        when(service.getVerificationDocumentById(id)).thenReturn(dto);

        mockMvc.perform(get("/api/verification-documents/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentId").value(id.toString()));
    }

    @Test
    void testUpdate() throws Exception {
        when(service.updateVerificationDocument(eq(id), any(VerificationDocumentDTO.class))).thenReturn(dto);

        mockMvc.perform(put("/api/verification-documents/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());
    }

    @Test
    void testDelete() throws Exception {
        doNothing().when(service).deleteVerificationDocument(id);

        mockMvc.perform(delete("/api/verification-documents/{id}", id))
                .andExpect(status().isOk());
    }
}
