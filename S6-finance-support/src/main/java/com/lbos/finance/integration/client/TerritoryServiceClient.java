package com.lbos.finance.integration.client;

import java.util.List;
import java.util.UUID;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Read-only S1 territory lookup (shared HTTP Basic credential, like S1's other /internal/v1 endpoints).
 * Every active city with the state it belongs to - the city-to-state mapping tax is decided by.
 */
@FeignClient(name = "lbos-platform", contextId = "financeTerritoryClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface TerritoryServiceClient {
    record CitySummary(UUID cityId, String cityName, UUID stateId, String stateName) { }

    @GetMapping("/internal/v1/territories/cities")
    List<CitySummary> activeCities();
}
