package com.cbg.lbos.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

/**
 * Triggers S6's retailer/fleet-owner/platform escrow split once a trip completes and its
 * order reaches DELIVERED. Best-effort like NotificationClient - every call site wraps this
 * in a try/catch and logs-and-continues rather than failing the trip-completion transaction.
 */
@FeignClient(
        name = "lbos-finance",
        contextId = "s4SettlementClient",
        configuration = ServiceBasicAuthFeignConfig.class)
public interface SettlementClient {

    @PostMapping("/api/v1/internal/settlements/order-delivered/{orderId}")
    void orderDelivered(@PathVariable("orderId") Long orderId);
}
