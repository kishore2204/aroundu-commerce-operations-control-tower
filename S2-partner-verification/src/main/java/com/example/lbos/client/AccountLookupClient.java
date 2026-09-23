package com.example.lbos.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

/**
 * S2 -> S1 lookup of a user account's display name, used to show who uploaded / reviewed a document
 * version. Same internal endpoint and shared-credential setup S3/S5 use for account lookups; callers
 * treat a failure as "name unavailable" rather than failing the request.
 */
@FeignClient(name = "lbos-platform", contextId = "partnerAccountLookupClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface AccountLookupClient {

    @GetMapping("/internal/v1/user-accounts/{id}")
    AccountSummary get(@PathVariable("id") UUID id);

    /** Names/contacts for a whole page of partners in one call. */
    @org.springframework.web.bind.annotation.PostMapping("/internal/v1/user-accounts/batch")
    java.util.List<AccountSummary> batch(@org.springframework.web.bind.annotation.RequestBody java.util.List<UUID> ids);

    /** Ids of accounts of the given roles whose name, email or phone contains the term. */
    @GetMapping("/internal/v1/user-accounts/search-ids")
    java.util.List<UUID> searchIds(@org.springframework.web.bind.annotation.RequestParam("term") String term,
            @org.springframework.web.bind.annotation.RequestParam("roles") java.util.List<String> roles);

    /** Sets a user account's status in S1 (the value the admin Accounts page shows), e.g. after a Location Manager blocks a partner. POST, because Feign's default client cannot send PATCH. */
    @org.springframework.web.bind.annotation.PostMapping("/internal/v1/user-accounts/{id}/status")
    AccountSummary updateStatus(@PathVariable("id") UUID id, @org.springframework.web.bind.annotation.RequestBody java.util.Map<String, String> request);

    record AccountSummary(UUID id, String email, String firstName, String lastName, String role,
                          String phoneNumber, String accountStatus) {
    }
}
