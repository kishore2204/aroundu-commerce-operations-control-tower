package com.example.lbos.controller;

import com.example.lbos.dto.AssignReviewerRequestDto;
import com.example.lbos.dto.VerificationQueueDTO;
import com.example.lbos.exception.GlobalExceptionHandler;
import com.example.lbos.exception.VerificationQueueNotFoundException;
import com.example.lbos.service.VerificationQueueService;
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
class VerificationQueueControllerTest {

    private MockMvc mockMvc;

    @Mock
    private VerificationQueueService service;

    @InjectMocks
    private VerificationQueueController controller;

    private ObjectMapper objectMapper;
    private VerificationQueueDTO dto;
    private final UUID id = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        dto = new VerificationQueueDTO();
        dto.setVerificationQueueId(id);
        dto.setSubjectType("RETAILER");
        dto.setSubjectId(UUID.randomUUID());
        dto.setIsActive(true);
        dto.setSubmittedByAccountId(UUID.randomUUID());
        dto.setVerificationStatus("PENDING");
    }

    @Test
    void testCreate() throws Exception {
        when(service.createVerificationQueue(any(VerificationQueueDTO.class))).thenReturn(dto);

        mockMvc.perform(post("/api/verification-queues")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.verificationQueueId").value(id.toString()));
    }

    @Test
    void testGetAll() throws Exception {
        when(service.getAllVerificationQueues()).thenReturn(Arrays.asList(dto));

        mockMvc.perform(get("/api/verification-queues")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    void testGetById() throws Exception {
        when(service.getVerificationQueueById(id)).thenReturn(dto);

        mockMvc.perform(get("/api/verification-queues/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificationQueueId").value(id.toString()));
    }

    @Test
    void testUpdate() throws Exception {
        when(service.updateVerificationQueue(eq(id), any(VerificationQueueDTO.class))).thenReturn(dto);

        mockMvc.perform(put("/api/verification-queues/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());
    }

    @Test
    void testDelete() throws Exception {
        doNothing().when(service).deleteVerificationQueue(id);

        mockMvc.perform(delete("/api/verification-queues/{id}", id))
                .andExpect(status().isOk());
    }

    @Test
    void testAssignReviewer() throws Exception {
        UUID reviewerAccountId = UUID.randomUUID();
        dto.setReviewedByAccountId(reviewerAccountId);
        when(service.assignReviewer(id, reviewerAccountId)).thenReturn(dto);

        mockMvc.perform(patch("/api/verification-queues/{id}/assign", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AssignReviewerRequestDto(reviewerAccountId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificationQueueId").value(id.toString()))
                .andExpect(jsonPath("$.reviewedByAccountId").value(reviewerAccountId.toString()));

        verify(service, times(1)).assignReviewer(id, reviewerAccountId);
    }

    @Test
    void testAssignReviewerNotFound() throws Exception {
        UUID reviewerAccountId = UUID.randomUUID();
        when(service.assignReviewer(eq(id), eq(reviewerAccountId)))
                .thenThrow(new VerificationQueueNotFoundException("VerificationQueue not found with id: " + id));

        mockMvc.perform(patch("/api/verification-queues/{id}/assign", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AssignReviewerRequestDto(reviewerAccountId))))
                .andExpect(status().isNotFound());
    }
}
