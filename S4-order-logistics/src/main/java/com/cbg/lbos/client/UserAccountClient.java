package com.cbg.lbos.client;

import com.cbg.lbos.client.dto.UserAccountSummary;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

/**
 * Reads user-account data from S1 (lbos-platform).
 * S1 protects /internal/** with hasRole("SERVICE"), so this client - and only
 * this client - is configured with HTTP Basic credentials.
 */
@FeignClient(
        name = "lbos-platform",
        contextId = "s4UserAccountClient",
        configuration = ServiceBasicAuthFeignConfig.class)
public interface UserAccountClient {

    @GetMapping("/internal/v1/user-accounts/{id}")
    UserAccountSummary getUserAccount(@PathVariable("id") UUID id);

    /** Same endpoint, read for a driver's display name and phone number (order tracking). */
    @GetMapping("/internal/v1/user-accounts/{id}")
    com.cbg.lbos.client.dto.UserContactSummary getUserContact(@PathVariable("id") UUID id);
}
