package com.cbg.lbos.client;

import com.cbg.lbos.client.dto.RetailerContextSummary;
import com.cbg.lbos.client.dto.RetailerSummary;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

/**
 * Reads retailer data from S2 (lbos-partner). S2 protects /internal/** with
 * hasRole("SERVICE"), so this client is configured with HTTP Basic credentials,
 * the same as DriverClient/VehicleClient/UserAccountClient.
 */
@FeignClient(
        name = "lbos-partner",
        contextId = "s4RetailerClient",
        configuration = ServiceBasicAuthFeignConfig.class)
public interface RetailerClient {

    @GetMapping("/internal/v1/retailers/{id}")
    RetailerSummary getRetailer(@PathVariable("id") UUID id);

    /**
     * Resolves which retailer a RETAILER-role JWT subject (S1 user account id) owns - used to
     * verify a retailer-accept/reject caller actually owns the order they're acting on.
     */
    @GetMapping("/internal/v1/retailers/by-user/{userAccountId}")
    RetailerContextSummary getRetailerByUserAccount(@PathVariable("userAccountId") UUID userAccountId);
}
