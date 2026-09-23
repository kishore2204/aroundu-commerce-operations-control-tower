package com.cbg.lbos;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
class SecurityIntegrationTest {
    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
    }

    @Test
    void anonymousUserIsBlocked() throws Exception {
        mockMvc.perform(get("/api/v1/cities"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "OPERATIONS_MANAGER")
    void operationsManagerCanReadCities() throws Exception {
        mockMvc.perform(get("/api/v1/cities"))
                .andExpect(status().isOk());
    }

    /**
     * GET on the operations-manager list is deliberately open to OPERATIONS_MANAGER
     * (see the carve-out and its rationale in SecurityConfig#apiSecurityFilterChain,
     * mirrored by PLATFORM_STAFF on this path in the Gateway's
     * RouteAuthorizationRules) - an Operations Manager needs to read the list to
     * populate the "supervising operations manager" dropdown. Only the writes below
     * stay SUPER_ADMIN-only.
     */
    @Test
    @WithMockUser(roles = "OPERATIONS_MANAGER")
    void operationsManagerCanReadOperationsManagerList() throws Exception {
        mockMvc.perform(get("/api/v1/operations-managers"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "OPERATIONS_MANAGER")
    void operationsManagerCannotWriteAdminOperationsManagerApi() throws Exception {
        mockMvc.perform(delete("/api/v1/operations-managers/99999999-9999-9999-9999-999999999999"))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/v1/operations-managers/99999999-9999-9999-9999-999999999999/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"INACTIVE\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/operations-managers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "SERVICE")
    void serviceUserCanCallInternalResolveEndpoint() throws Exception {
        mockMvc.perform(get("/internal/v1/operations-managers/resolve")
                        .param("userAccountId", "99999999-9999-9999-9999-999999999999"))
                .andExpect(status().isNotFound());
    }
}
