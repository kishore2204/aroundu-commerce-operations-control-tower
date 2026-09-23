package com.cbg.lbos.controller;

import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.cbg.lbos.service.LoginEligibilityService;
import com.cbg.lbos.service.UserAccountService;

/**
 * Feign's default HTTP client cannot send PATCH, so S2/S5 could never reach the status endpoint that way and an account's status
 * silently stayed unchanged. The endpoint must answer to POST as well as PATCH.
 */
@ExtendWith(MockitoExtension.class)
class InternalUserAccountControllerStatusTest {
    @Mock private UserAccountService userAccountService;
    @Mock private LoginEligibilityService loginEligibilityService;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new InternalUserAccountController(userAccountService, loginEligibilityService)).build();
    }

    @Test
    void thePartnerAndFleetServicesCanSetAnAccountStatusWithPost() throws Exception {
        UUID id = UUID.randomUUID();
        mvc.perform(post("/internal/v1/user-accounts/" + id + "/status").contentType(MediaType.APPLICATION_JSON).content("{\"accountStatus\":\"SUSPENDED\"}"))
                .andExpect(status().isOk());
        verify(userAccountService).updateAccountStatus(id, "SUSPENDED");
    }

    @Test
    void patchStillWorks() throws Exception {
        UUID id = UUID.randomUUID();
        mvc.perform(patch("/internal/v1/user-accounts/" + id + "/status").contentType(MediaType.APPLICATION_JSON).content("{\"accountStatus\":\"ACTIVE\"}"))
                .andExpect(status().isOk());
        verify(userAccountService, times(1)).updateAccountStatus(id, "ACTIVE");
    }
}
