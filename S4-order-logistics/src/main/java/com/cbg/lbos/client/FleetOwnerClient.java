package com.cbg.lbos.client;

import com.cbg.lbos.client.dto.FleetOwnerSummary;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

/**
 * Reads fleet-owner validation data from S2 (lbos-partner). S2 protects /internal/** with
 * hasRole("SERVICE"), so this client is configured with HTTP Basic credentials, the same as
 * DriverClient/VehicleClient/UserAccountClient. A distinct contextId is required because
 * RetailerClient shares the same Feign client name.
 */
@FeignClient(
        name = "lbos-partner",
        contextId = "s4FleetOwnerClient",
        configuration = ServiceBasicAuthFeignConfig.class)
public interface FleetOwnerClient {

    @GetMapping("/internal/v1/fleet-owners/{id}/validation")
    FleetOwnerSummary getFleetOwner(@PathVariable("id") UUID id);
}
