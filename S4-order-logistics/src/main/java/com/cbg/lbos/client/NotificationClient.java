package com.cbg.lbos.client;

import com.cbg.lbos.client.dto.NotificationCreateRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/**
 * Fires order-status notifications to S6 (lbos-finance) - new order for the retailer,
 * accept/reject/timeout updates for the customer, and (from Phase 3 onward) the matched
 * fleet owner. S6 gates /api/v1/internal/** with hasRole("SERVICE"), so this client is
 * configured with HTTP Basic credentials, the same as every other internal client here.
 *
 * Every call site wraps this in a try/catch(FeignException) and logs-and-continues rather
 * than failing the calling order-status change - a notification-delivery failure must never
 * block an order's own state transition, matching restoreStockForCancelledOrder's existing
 * best-effort posture in OrderService.
 */
@FeignClient(
        name = "lbos-finance",
        contextId = "s4NotificationClient",
        configuration = ServiceBasicAuthFeignConfig.class)
public interface NotificationClient {

    @PostMapping("/api/v1/internal/notifications")
    void create(@RequestBody NotificationCreateRequest request);
}
