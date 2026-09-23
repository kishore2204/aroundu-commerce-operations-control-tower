package com.cbg.lbos.client;

import com.cbg.lbos.client.dto.VehicleSummary;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.math.BigDecimal;
import java.util.List;

/**
 * Reads vehicle data from S5 (lbos-fleet). S5 now gates this behind a real /internal/v1/**
 * endpoint with the shared HTTP Basic credential (see ServiceBasicAuthFeignConfig) - the
 * previous version called the public, unauthenticated /api/vehicles/{id}. A distinct
 * contextId is required because DriverClient shares the same Feign client name.
 */
@FeignClient(name = "lbos-fleet", contextId = "s4VehicleClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface VehicleClient {

    @GetMapping("/internal/v1/vehicles/{id}")
    VehicleSummary getVehicle(@PathVariable("id") java.util.UUID id);

    /** See OrderService.retailerAccept() - finds the nearest available vehicle for a delivery. */
    @GetMapping("/internal/v1/vehicles/nearest-available")
    List<VehicleSummary> nearestAvailable(
            @RequestParam("lat") BigDecimal lat, @RequestParam("lon") BigDecimal lon,
            @RequestParam(value = "maxKm", required = false) Double maxKm);
}
