package com.example.lbos.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Map;
import java.util.UUID;

/**
 * S1's location-manager acknowledgement endpoint lives at
 * /internal/v1/location-managers/{managerId}/verifications, gated by the shared HTTP Basic
 * credential (see ServiceBasicAuthFeignConfig) - not the public, JWT-gated /api/** surface.
 * The previous version of this client called a nonexistent
 * "/api/location-managers/{managerId}/verifications" path with no credentials at all.
 */
@FeignClient(name = "lbos-platform", contextId = "partnerLocationManagerClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface LocationManagerClient {

    @PostMapping("/internal/v1/location-managers/{managerId}/verifications")
    Map<String, Object> submitVerificationRequest(
            @PathVariable("managerId") UUID managerId,
            @RequestBody Map<String, Object> verificationDetails
    );

    /**
     * Resolves the active Location Manager assigned to a zone. Verification requests must go to
     * this manager, not to the retailer/fleet-owner's Operations Manager - a City can have several
     * zones, each with its own Location Manager, and the Operations Manager oversees the whole city.
     */
    @GetMapping("/internal/v1/location-managers/active/by-zone/{zoneId}")
    ActiveLocationManagerResponse getActiveLocationManagerByZone(@PathVariable("zoneId") UUID zoneId);

    /** Every active Location Manager of a zone - a zone can have several, verification work is spread over them. */
    @GetMapping("/internal/v1/location-managers/active/by-zone/{zoneId}/all")
    java.util.List<ZoneLocationManager> getActiveLocationManagersByZone(@PathVariable("zoneId") UUID zoneId);

    /** The (latest) assignment of a Location Manager account - the zone every scoped read/write is checked against. */
    @GetMapping("/internal/v1/location-managers/by-user/{userAccountId}")
    LocationManagerSummary getByUser(@PathVariable("userAccountId") UUID userAccountId);

    record ZoneLocationManager(UUID locationManagerId, UUID userAccountId, UUID zoneId) {
    }

    record ActiveLocationManagerResponse(UUID locationManagerId, UUID zoneId, UUID operationsManagerId) {
    }

    record LocationManagerSummary(UUID locationManagerId, UUID userAccountId, String firstName, String lastName,
                                  String email, UUID zoneId, String zoneName, UUID cityId, String cityName,
                                  UUID stateId, UUID operationsManagerAccountId, String assignmentStatus) {
        public boolean isActive() {
            return "ACTIVE".equalsIgnoreCase(assignmentStatus);
        }

        public String displayName() {
            String name = ((firstName == null ? "" : firstName) + " " + (lastName == null ? "" : lastName)).trim();
            return name.isEmpty() ? (email == null ? "Location Manager" : email) : name;
        }
    }
}
