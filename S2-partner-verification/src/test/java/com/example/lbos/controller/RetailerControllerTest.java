package com.example.lbos.controller;

import com.example.lbos.dto.RetailerDTO;
import com.example.lbos.exception.GlobalExceptionHandler;
import com.example.lbos.service.RetailerService;
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

import java.math.BigDecimal;
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
class RetailerControllerTest {

    private MockMvc mockMvc;

    @Mock
    private RetailerService retailerService;

    @InjectMocks
    private RetailerController retailerController;

    private ObjectMapper objectMapper;

    private RetailerDTO retailerDTO;
    private final UUID retailerId = UUID.randomUUID();
    private final UUID cityId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID ownerAccountId = UUID.fromString("11111111-1111-1111-1111-111111111111");

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
        mockMvc = MockMvcBuilders.standaloneSetup(retailerController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        objectMapper = new ObjectMapper();

        retailerDTO = new RetailerDTO();
        retailerDTO.setRetailerId(retailerId);
        retailerDTO.setUserAccountId(ownerAccountId);
        retailerDTO.setOperationsManagerId(UUID.fromString("22222222-2222-2222-2222-222222222222"));
        retailerDTO.setCityId(cityId);
        retailerDTO.setLongitude(new BigDecimal("78.1234567"));
        retailerDTO.setLatitude(new BigDecimal("11.2345678"));
        retailerDTO.setBusinessName("ABC Retail Store");
        retailerDTO.setRegistrationNumber("REG12345");
        retailerDTO.setGstNumber("33ABCDE1234F1Z5");
        retailerDTO.setRetailerStatus("ACTIVE");
    }

    @Test
    void testCreateRetailer() throws Exception {
        when(retailerService.createRetailer(any(RetailerDTO.class))).thenReturn(retailerDTO);

        mockMvc.perform(post("/api/retailers")
                        .principal(ownerAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(retailerDTO)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.retailerId").value(retailerId.toString()))
                .andExpect(jsonPath("$.businessName").value("ABC Retail Store"));

        verify(retailerService, times(1)).createRetailer(any(RetailerDTO.class));
    }

    @Test
    void testCreateRetailerIgnoresAClientSuppliedUserAccountIdForANonStaffCaller() throws Exception {
        when(retailerService.createRetailer(any(RetailerDTO.class))).thenReturn(retailerDTO);
        RetailerDTO spoofed = retailerDTO;
        spoofed.setUserAccountId(UUID.randomUUID());

        mockMvc.perform(post("/api/retailers")
                        .principal(ownerAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(spoofed)))
                .andExpect(status().isCreated());

        verify(retailerService, times(1)).createRetailer(argThat(sent -> sent.getUserAccountId().equals(ownerAccountId)));
    }

    @Test
    void testGetAllRetailers() throws Exception {
        when(retailerService.getAllRetailers()).thenReturn(Arrays.asList(retailerDTO));

        mockMvc.perform(get("/api/retailers")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].retailerId").value(retailerId.toString()));

        verify(retailerService, times(1)).getAllRetailers();
    }

    @Test
    void testGetRetailerById() throws Exception {
        when(retailerService.getRetailerById(retailerId)).thenReturn(retailerDTO);

        mockMvc.perform(get("/api/retailers/{retailerId}", retailerId)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.retailerId").value(retailerId.toString()));

        verify(retailerService, times(1)).getRetailerById(retailerId);
    }

    @Test
    void testUpdateRetailer() throws Exception {
        when(retailerService.getRetailerById(retailerId)).thenReturn(retailerDTO);
        when(retailerService.updateRetailer(eq(retailerId), any(RetailerDTO.class))).thenReturn(retailerDTO);

        mockMvc.perform(put("/api/retailers/{retailerId}", retailerId)
                        .principal(ownerAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(retailerDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.retailerId").value(retailerId.toString()));

        verify(retailerService, times(1)).updateRetailer(eq(retailerId), any(RetailerDTO.class));
    }

    @Test
    void testUpdateRetailerRejectsANonOwningNonStaffCaller() throws Exception {
        when(retailerService.getRetailerById(retailerId)).thenReturn(retailerDTO);

        mockMvc.perform(put("/api/retailers/{retailerId}", retailerId)
                        .principal(otherUserAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(retailerDTO)))
                .andExpect(status().isForbidden());

        verify(retailerService, never()).updateRetailer(any(), any());
    }

    @Test
    void testUpdateRetailerAllowsStaffRegardlessOfOwnership() throws Exception {
        when(retailerService.updateRetailer(eq(retailerId), any(RetailerDTO.class))).thenReturn(retailerDTO);

        mockMvc.perform(put("/api/retailers/{retailerId}", retailerId)
                        .principal(adminAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(retailerDTO)))
                .andExpect(status().isOk());

        verify(retailerService, never()).getRetailerById(any());
        verify(retailerService, times(1)).updateRetailer(eq(retailerId), any(RetailerDTO.class));
    }

    @Test
    void testDeleteRetailer() throws Exception {
        when(retailerService.getRetailerById(retailerId)).thenReturn(retailerDTO);
        doNothing().when(retailerService).deleteRetailer(retailerId);

        mockMvc.perform(delete("/api/retailers/{retailerId}", retailerId)
                        .principal(ownerAuth()))
                .andExpect(status().isOk());

        verify(retailerService, times(1)).deleteRetailer(retailerId);
    }

    @Test
    void testDeleteRetailerRejectsANonOwningNonStaffCaller() throws Exception {
        when(retailerService.getRetailerById(retailerId)).thenReturn(retailerDTO);

        mockMvc.perform(delete("/api/retailers/{retailerId}", retailerId)
                        .principal(otherUserAuth()))
                .andExpect(status().isForbidden());

        verify(retailerService, never()).deleteRetailer(any());
    }

    @Test
    void testGetRetailersByCity() throws Exception {
        when(retailerService.getRetailersByCity(cityId)).thenReturn(Arrays.asList(retailerDTO));

        mockMvc.perform(get("/api/retailers/city/{cityId}", cityId)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].cityId").value(cityId.toString()));

        verify(retailerService, times(1)).getRetailersByCity(cityId);
    }

    @Test
    void testGetRetailersByStatus() throws Exception {
        String status = "ACTIVE";
        when(retailerService.getRetailersByStatus(status)).thenReturn(Arrays.asList(retailerDTO));

        mockMvc.perform(get("/api/retailers/status/{status}", status)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].retailerStatus").value(status));

        verify(retailerService, times(1)).getRetailersByStatus(status);
    }

    @Test
    void testSearchRetailers() throws Exception {
        String businessName = "ABC";
        when(retailerService.searchRetailers(businessName)).thenReturn(Arrays.asList(retailerDTO));

        mockMvc.perform(get("/api/retailers/search")
                        .param("businessName", businessName)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].businessName").value("ABC Retail Store"));

        verify(retailerService, times(1)).searchRetailers(businessName);
    }
}
