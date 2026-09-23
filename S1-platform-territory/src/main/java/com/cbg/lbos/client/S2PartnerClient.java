package com.cbg.lbos.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

@FeignClient(name = "lbos-partner", contextId = "platformPartnerClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface S2PartnerClient {

    @GetMapping("/internal/v1/verification-queues/reviewer/{reviewerAccountId}/pending-count")
    PendingReviewCountResponse getPendingReviewCount(@PathVariable("reviewerAccountId") UUID reviewerAccountId,
            @org.springframework.web.bind.annotation.RequestParam("zoneId") UUID zoneId);

    /** Mirrors S2's InternalRetailerController.RetailerContextResponse - used by
     *  SubjectVerificationGate to read a retailer's approval status at login. */
    @GetMapping("/internal/v1/retailers/by-user/{userAccountId}")
    RetailerContextResponse getRetailerByUserAccountId(@PathVariable("userAccountId") UUID userAccountId);

    /** Mirrors S2's InternalFleetOwnerController.FleetOwnerValidationResponse - used by
     *  SubjectVerificationGate to read a fleet owner's approval status at login. */
    @GetMapping("/internal/v1/fleet-owners/by-user-account/{userAccountId}")
    FleetOwnerValidationResponse getFleetOwnerByUserAccountId(@PathVariable("userAccountId") UUID userAccountId);

    /** Same S2 endpoint S5 already uses - resolves a fleet owner id (a driver's parent) to the
     *  owner's user account, for LoginEligibilityService's parent-account check. */
    @GetMapping("/internal/v1/fleet-owners/{fleetOwnerId}/validation")
    FleetOwnerValidationResponse getFleetOwnerById(@PathVariable("fleetOwnerId") UUID fleetOwnerId);

    record PendingReviewCountResponse(long pendingCount) {
    }

    record RetailerContextResponse(
            UUID retailerId, UUID userAccountId, String businessName, UUID cityId, String retailerStatus) {
    }

    record FleetOwnerValidationResponse(
            UUID fleetOwnerId, UUID userAccountId, String businessName, UUID zoneId,
            String profileStatus, String ownerStatus, String verificationStatus) {
    }
}
