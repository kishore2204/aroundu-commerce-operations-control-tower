package com.lbos.finance.integration.client;

import java.util.UUID;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/** Read-only S2 business-name lookups used to present support escalation targets without exposing UUIDs. */
@FeignClient(name = "lbos-partner", contextId = "supportPartnerServiceClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface PartnerServiceClient {
    record RetailerSummary(UUID retailerId, UUID userAccountId, String businessName) {}
    record FleetOwnerSummary(UUID fleetOwnerId, UUID userAccountId, String businessName) {}

    @GetMapping("/internal/v1/retailers/{id}")
    RetailerSummary getRetailer(@PathVariable("id") UUID id);

    @GetMapping("/internal/v1/fleet-owners/{id}/validation")
    FleetOwnerSummary getFleetOwner(@PathVariable("id") UUID id);

    /** The retailer profile owned by a logged-in user account (404 when the account has none) - lets a
     *  caller's own retailerId be resolved server-side from their JWT subject instead of trusting the client. */
    @GetMapping("/internal/v1/retailers/by-user/{userAccountId}")
    RetailerSummary getRetailerByUser(@PathVariable("userAccountId") UUID userAccountId);

    @GetMapping("/internal/v1/fleet-owners/by-user-account/{userAccountId}")
    FleetOwnerSummary getFleetOwnerByUser(@PathVariable("userAccountId") UUID userAccountId);
}
