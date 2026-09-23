package com.example.lbos.controller;

import com.example.lbos.dto.FleetOwnerDTO;
import com.example.lbos.exception.GlobalExceptionHandler;
import com.example.lbos.service.FleetOwnerService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class FleetOwnerControllerTest {

    private MockMvc mockMvc;

    @Mock
    private FleetOwnerService service;

    @InjectMocks
    private FleetOwnerController controller;

    private ObjectMapper objectMapper;
    private FleetOwnerDTO dto;
    private final UUID id = UUID.randomUUID();
    private final UUID ownerAccountId = UUID.randomUUID();

    private UsernamePasswordAuthenticationToken ownerAuth() {
        return new UsernamePasswordAuthenticationToken(ownerAccountId.toString(), null,
                List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER")));
    }

    private UsernamePasswordAuthenticationToken adminAuth() {
        return new UsernamePasswordAuthenticationToken(UUID.randomUUID().toString(), null,
                List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN")));
    }

    private UsernamePasswordAuthenticationToken otherUserAuth() {
        return new UsernamePasswordAuthenticationToken(UUID.randomUUID().toString(), null,
                List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER")));
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        objectMapper = new ObjectMapper();

        dto = new FleetOwnerDTO();
        dto.setFleetOwnerId(id);
        dto.setUserAccountId(ownerAccountId);
        dto.setCityId(UUID.randomUUID());
        dto.setBusinessName("ABC Logistics");
        dto.setProfileStatus("VERIFIED");
        dto.setOwnerStatus("ACTIVE");
    }

    @Test
    void testCreate() throws Exception {
        when(service.createFleetOwner(any(FleetOwnerDTO.class))).thenReturn(dto);

        mockMvc.perform(post("/api/fleet-owners")
                        .principal(ownerAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fleetOwnerId").value(id.toString()));
    }

    @Test
    void testCreateIgnoresAClientSuppliedUserAccountIdForANonStaffCaller() throws Exception {
        when(service.createFleetOwner(any(FleetOwnerDTO.class))).thenReturn(dto);
        dto.setUserAccountId(UUID.randomUUID());

        mockMvc.perform(post("/api/fleet-owners")
                        .principal(ownerAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated());

        verify(service, times(1)).createFleetOwner(argThat(sent -> sent.getUserAccountId().equals(ownerAccountId)));
    }

    @Test
    void testGetAll() throws Exception {
        when(service.getAllFleetOwners()).thenReturn(Arrays.asList(dto));

        mockMvc.perform(get("/api/fleet-owners")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    void testGetById() throws Exception {
        when(service.getFleetOwnerById(id)).thenReturn(dto);

        mockMvc.perform(get("/api/fleet-owners/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fleetOwnerId").value(id.toString()));
    }

    @Test
    void testUpdate() throws Exception {
        when(service.getFleetOwnerById(id)).thenReturn(dto);
        when(service.updateFleetOwner(eq(id), any(FleetOwnerDTO.class))).thenReturn(dto);

        mockMvc.perform(put("/api/fleet-owners/{id}", id)
                        .principal(ownerAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());
    }

    @Test
    void testUpdateRejectsANonOwningNonStaffCaller() throws Exception {
        when(service.getFleetOwnerById(id)).thenReturn(dto);

        mockMvc.perform(put("/api/fleet-owners/{id}", id)
                        .principal(otherUserAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isForbidden());

        verify(service, never()).updateFleetOwner(any(), any());
    }

    @Test
    void testUpdateAllowsStaffRegardlessOfOwnership() throws Exception {
        when(service.updateFleetOwner(eq(id), any(FleetOwnerDTO.class))).thenReturn(dto);

        mockMvc.perform(put("/api/fleet-owners/{id}", id)
                        .principal(adminAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());

        verify(service, never()).getFleetOwnerById(any());
    }

    @Test
    void testDelete() throws Exception {
        when(service.getFleetOwnerById(id)).thenReturn(dto);
        doNothing().when(service).deleteFleetOwner(id);

        mockMvc.perform(delete("/api/fleet-owners/{id}", id)
                        .principal(ownerAuth()))
                .andExpect(status().isOk());
    }

    @Test
    void testDeleteRejectsANonOwningNonStaffCaller() throws Exception {
        when(service.getFleetOwnerById(id)).thenReturn(dto);

        mockMvc.perform(delete("/api/fleet-owners/{id}", id)
                        .principal(otherUserAuth()))
                .andExpect(status().isForbidden());

        verify(service, never()).deleteFleetOwner(any());
    }
}
