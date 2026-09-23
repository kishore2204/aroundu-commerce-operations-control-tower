package com.cbg.lbos.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@FeignClient(name = "lbos-platform", contextId = "s1PlatformClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface S1PlatformClient {

    record CreateUserAccountRequest(
            String email,
            String phoneNumber,
            String password,
            String firstName,
            String lastName,
            String role,
            String accountStatus
    ) {}

    record UserAccountResponse(
            UUID id,
            String email,
            String phoneNumber,
            String firstName,
            String lastName,
            String role,
            String accountStatus
    ) {}

    @PostMapping("/internal/v1/user-accounts")
    UserAccountResponse createUserAccount(@RequestBody CreateUserAccountRequest request);

    @GetMapping("/internal/v1/user-accounts/{id}")
    UserAccountResponse getUserAccount(@PathVariable("id") UUID id);

    /** POST, not PATCH: Feign's default HTTP client cannot send PATCH, so the old PATCH call never reached S1. */
    @PostMapping("/internal/v1/user-accounts/{id}/status")
    UserAccountResponse updateAccountStatus(@PathVariable("id") UUID id, @RequestBody java.util.Map<String, String> request);
}
