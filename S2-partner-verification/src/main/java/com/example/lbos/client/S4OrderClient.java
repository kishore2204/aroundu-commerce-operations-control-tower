package com.example.lbos.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;
import java.util.UUID;

/**
 * S2 -> S4 direction, the retailer/fleet-owner counterpart of {@link S5FleetClient}'s
 * driver/vehicle suspend calls: S2 owns Retailer/FleetOwner status but S4 owns the Orders those
 * partners are in the middle of fulfilling, so suspending a partner has to tell S4 or every
 * in-flight order for that partner keeps running (no halt, no customer notification). Targets
 * S4's {@code /api/v1/internal/**} surface, gated by the shared HTTP Basic credential (see
 * ServiceBasicAuthFeignConfig) - not the public, JWT-gated {@code /api/**} surface. POST rather
 * than PATCH for the same reason S5FleetClient uses POST: Feign's default client cannot issue
 * the PATCH verb at all.
 */
@FeignClient(name = "lbos-order", contextId = "partnerOrderClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface S4OrderClient {

    /**
     * Cancels every in-flight order belonging to a retailer that has just been suspended.
     *
     * @param retailerId the suspended retailer
     * @param request the suspension reason recorded on each cancelled order
     * @return a summary of which orders S4 cancelled
     */
    @PostMapping("/api/v1/internal/partners/retailers/{retailerId}/suspended")
    PartnerSuspensionCancellationResponse retailerSuspended(
            @PathVariable("retailerId") UUID retailerId,
            @RequestBody PartnerSuspensionRequest request);

    /**
     * Cancels every in-flight order whose dispatched trip belongs to a fleet owner that has
     * just been suspended.
     *
     * @param fleetOwnerId the suspended fleet owner
     * @param request the suspension reason recorded on each cancelled order
     * @return a summary of which orders S4 cancelled
     */
    @PostMapping("/api/v1/internal/partners/fleet-owners/{fleetOwnerId}/suspended")
    PartnerSuspensionCancellationResponse fleetOwnerSuspended(
            @PathVariable("fleetOwnerId") UUID fleetOwnerId,
            @RequestBody PartnerSuspensionRequest request);

    /**
     * Request payload naming why the partner was suspended; S4 records it as each cancelled
     * order's cancellationReason.
     *
     * @param reason the operator-supplied suspension reason
     */
    /** Orders in progress / delivered in the window for a set of retailers (one zone's retailers). */
    @PostMapping("/api/v1/internal/orders/stats")
    OrderStatsResponse orderStats(@RequestBody OrderStatsRequest request);

    record OrderStatsRequest(java.util.Collection<UUID> retailerIds, java.time.LocalDateTime from, java.time.LocalDateTime to) {
    }

    record OrderStatsResponse(long activeOrders, long completedOrders) {
    }

    record PartnerSuspensionRequest(String reason) {
    }

    /**
     * Response payload summarising what the suspension took down on S4's side. Field names
     * match S4's own {@code PartnerSuspensionCancellationResponse} exactly - Jackson silently
     * nulls out any field it cannot match by name.
     *
     * @param cancelledOrderCount how many in-flight orders were cancelled
     * @param cancelledOrderIds the ids of those orders
     */
    record PartnerSuspensionCancellationResponse(int cancelledOrderCount, List<Long> cancelledOrderIds) {
    }
}
