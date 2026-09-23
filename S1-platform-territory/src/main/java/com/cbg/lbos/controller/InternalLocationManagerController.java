package com.cbg.lbos.controller;

import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.cbg.lbos.dto.LocationManagerDto;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.service.LocationManagerService;

@RestController
@RequestMapping("/internal/v1/location-managers")
public class InternalLocationManagerController {

    private final LocationManagerService locationManagerService;

    public InternalLocationManagerController(LocationManagerService locationManagerService) {
        this.locationManagerService = locationManagerService;
    }

    @PostMapping("/{managerId}/verifications")
    public ResponseEntity<Map<String, Object>> acknowledgeVerificationRequest(
            @PathVariable UUID managerId,
            @RequestBody Map<String, Object> verificationDetails) {

        LocationManagerDto locationManager = locationManagerService.getLocationManagerById(managerId);
        if (locationManager == null) {
            throw new ResourceNotFoundException("Location manager not found: " + managerId);
        }

        return ResponseEntity.accepted().body(Map.of(
                "accepted", true,
                "locationManagerId", managerId,
                "verificationDetailsReceived", verificationDetails != null));
    }

    /**
     * Service-to-service equivalent of the JWT-gated GET /api/v1/location-managers/active/by-zone/{zoneId}.
     * S2 calls this (with the shared Basic-auth credential) to resolve the active Location Manager
     * for a retailer/fleet-owner's zone before dispatching a verification request - it previously
     * sent the request straight to the retailer/fleet-owner's Operations Manager ID instead.
     */
    /** The (latest) assignment of a Location Manager account - S2 resolves the caller's zone, and a transfer target's
     *  eligibility, from this so it never has to trust a zone sent by the browser. */
    @GetMapping("/by-user/{userAccountId}")
    public ResponseEntity<LocationManagerDto> byUser(@PathVariable UUID userAccountId) {
        return ResponseEntity.ok(locationManagerService.getByUserAccountId(userAccountId));
    }

    /** Every active Location Manager of a zone - a zone may have several; S2 spreads verification work over them. */
    @GetMapping("/active/by-zone/{zoneId}/all")
    public ResponseEntity<java.util.List<LocationManagerDto>> activeAllByZone(@PathVariable UUID zoneId) {
        return ResponseEntity.ok(locationManagerService.getActiveLocationManagersByZone(zoneId));
    }

    @GetMapping("/active/by-zone/{zoneId}")
    public ResponseEntity<LocationManagerDto> activeByZone(@PathVariable UUID zoneId) {
        return ResponseEntity.ok(locationManagerService.getActiveLocationManagerByZone(zoneId));
    }
}
