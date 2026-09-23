package com.lbos.finance.integration.client;
import java.util.UUID;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
import com.lbos.finance.integration.dto.DriverSummaryResponse;

/**
 * S5 (lbos-fleet) gates /internal/v1/** with the shared HTTP Basic credential, same as every
 * other internal client here. Used to resolve a driver's own id from their userAccountId (the
 * JWT subject) - support tickets have no driverId of their own, so "my complaints" first needs
 * to know which driver is asking.
 */
@FeignClient(name = "lbos-fleet", contextId = "fleetServiceClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface FleetServiceClient {
    @GetMapping("/internal/v1/drivers/by-user-account/{userAccountId}")
    DriverSummaryResponse getDriverByUserAccountId(@PathVariable("userAccountId") UUID userAccountId);
}
