package com.example.lbos.controller;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.lbos.dto.FleetOwnerDTO;
import com.example.lbos.service.FleetOwnerService;

/**
 * Service-to-service lookup of fleet-owner validation data (e.g. S5 checking whether a fleet
 * owner is verified/active before letting them onboard a vehicle or driver). Gated by
 * hasRole("SERVICE") like the other /internal/** endpoints - not for browser/end-user use.
 */
@RestController
@RequestMapping("/internal/v1/fleet-owners")
public class InternalFleetOwnerController {

    /** userAccountId was added so S4 can notify a fleet owner (see requirement that the
     * nearest fleet/bike owner is notified once a retailer accepts an order) without a second
     * round trip - S4's FleetOwnerClient already calls this endpoint for validation. */
    public record FleetOwnerValidationResponse(UUID fleetOwnerId, UUID userAccountId, String businessName, UUID zoneId, String profileStatus, String ownerStatus, String verificationStatus) {
    }

    private final FleetOwnerService fleetOwnerService;

    public InternalFleetOwnerController(FleetOwnerService fleetOwnerService) {
        this.fleetOwnerService = fleetOwnerService;
    }

    @GetMapping("/{id}/validation")
    public ResponseEntity<FleetOwnerValidationResponse> validate(@PathVariable UUID id) {
        FleetOwnerDTO fleetOwner = fleetOwnerService.getFleetOwnerById(id);
        return ResponseEntity.ok(new FleetOwnerValidationResponse(
                fleetOwner.getFleetOwnerId(), fleetOwner.getUserAccountId(), fleetOwner.getBusinessName(), fleetOwner.getZoneId(),
                fleetOwner.getProfileStatus(), fleetOwner.getOwnerStatus(),
                fleetOwner.getProfileStatus()));
    }

    @GetMapping("/by-user-account/{userAccountId}")
    public ResponseEntity<FleetOwnerValidationResponse> getByUserAccountId(@PathVariable UUID userAccountId) {
        FleetOwnerDTO fleetOwner = fleetOwnerService.getFleetOwnerByUserAccountId(userAccountId);
        return ResponseEntity.ok(new FleetOwnerValidationResponse(
                fleetOwner.getFleetOwnerId(), fleetOwner.getUserAccountId(), fleetOwner.getBusinessName(), fleetOwner.getZoneId(),
                fleetOwner.getProfileStatus(), fleetOwner.getOwnerStatus(),
                fleetOwner.getProfileStatus()));
    }
}

