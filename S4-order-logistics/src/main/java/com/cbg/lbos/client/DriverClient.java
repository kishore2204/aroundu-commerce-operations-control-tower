package com.cbg.lbos.client;

import com.cbg.lbos.client.dto.DriverSummary;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.math.BigDecimal;
import java.util.List;

/**
 * Reads driver data from S5 (lbos-fleet). S5 now gates this behind a real /internal/v1/**
 * endpoint with the shared HTTP Basic credential (see ServiceBasicAuthFeignConfig) - the
 * previous version called the public, unauthenticated /api/drivers/{id}. A distinct
 * contextId is required because VehicleClient shares the same Feign client name.
 */
@FeignClient(name = "lbos-fleet", contextId = "s4DriverClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface DriverClient {

    @GetMapping("/internal/v1/drivers/{id}")
    DriverSummary getDriver(@PathVariable("id") java.util.UUID id);

    @GetMapping("/internal/v1/drivers/by-user-account/{userAccountId}")
    DriverSummary getDriverByUserAccountId(@PathVariable("userAccountId") java.util.UUID userAccountId);

    /** See OrderService.retailerAccept() - finds the nearest available driver for a delivery. */
    @GetMapping("/internal/v1/drivers/nearest-available")
    List<DriverSummary> nearestAvailable(
            @RequestParam("lat") BigDecimal lat, @RequestParam("lon") BigDecimal lon,
            @RequestParam(value = "maxKm", required = false) Double maxKm);
}
