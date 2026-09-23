package com.lbos.commercecustomer.service.impl;

import com.lbos.commercecustomer.client.PartnerVerificationClient;
import com.lbos.commercecustomer.dto.client.partner.RetailerSummaryResponse;
import com.lbos.commercecustomer.entity.Product;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Batch-resolves S2 retailer summaries (name, verification status, location) for a set of
 * products, so customer-facing product listings can show the owning shop without an N+1 Feign
 * call per product on the page. A failure resolving any individual retailer id is swallowed -
 * this is best-effort enrichment, since a lookup failure must never stop the product itself
 * from rendering (it only means that one product's card is missing its shop badge until the
 * next refresh).
 */
@Component
public class RetailerEnrichmentSupport {

    private final PartnerVerificationClient partnerVerificationClient;
    private final FeignCallSupport feignCallSupport;

    public RetailerEnrichmentSupport(
            PartnerVerificationClient partnerVerificationClient, FeignCallSupport feignCallSupport) {
        this.partnerVerificationClient = partnerVerificationClient;
        this.feignCallSupport = feignCallSupport;
    }

    public Map<UUID, RetailerSummaryResponse> resolve(Collection<Product> products) {
        Set<UUID> retailerIds = products.stream()
                .map(Product::getRetailerId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<UUID, RetailerSummaryResponse> byRetailerId = new HashMap<>();
        for (UUID retailerId : retailerIds) {
            RetailerSummaryResponse retailer = resolveOne(retailerId);
            if (retailer != null) {
                byRetailerId.put(retailerId, retailer);
            }
        }
        return byRetailerId;
    }

    /**
     * The retailer ids serviceable in a zone, for the customer-facing zone-based catalogue
     * filter (see ProductDiscoveryServiceImpl.search()). Null (not empty) on a lookup failure -
     * the caller treats null as "no filter" (same best-effort, fail-open posture as the rest of
     * this class: a downed S2 degrades to the unfiltered catalogue rather than showing the
     * customer nothing at all) while an empty list correctly means "this zone has zero
     * serviceable retailers right now."
     */
    public java.util.List<UUID> retailerIdsForZone(UUID zoneId) {
        try {
            return feignCallSupport.call("lbos-partner", () -> partnerVerificationClient.retailerIdsByZone(zoneId));
        } catch (RuntimeException failure) {
            return null;
        }
    }

    /**
     * Retailer ids currently open for orders, for the customer catalogue. This check is
     * availability-critical, so it fails closed: if S2 cannot confirm that a store is open,
     * customer-facing discovery must not expose that store's products as orderable.
     */
    public java.util.List<UUID> openRetailerIds() {
        try {
            return feignCallSupport.call("lbos-partner", partnerVerificationClient::openRetailerIds);
        } catch (RuntimeException failure) {
            return java.util.List.of();
        }
    }

    /**
     * A retailer's summary is display-only here (shop name / verification badge / location on
     * product cards, cart lines and the shop-detail view) - nothing gates on it; whether a store
     * is currently open is answered live by {@link #openRetailerIds()}, which is deliberately not
     * cached. Without this, every product page, cart read, cart mutation and serviceability check
     * made one sequential S2 round trip per distinct retailer, each of which is a Feign hop plus a
     * database query. A short TTL keeps the badge fresh enough while collapsing those repeats;
     * failed lookups are never cached, so a recovered S2 is picked up on the next request.
     */
    private static final long SUMMARY_TTL_NANOS = TimeUnit.SECONDS.toNanos(30);
    private static final int MAX_CACHED_SUMMARIES = 1_000;

    private record CachedSummary(RetailerSummaryResponse summary, long expiresAtNanos) {
    }

    private final Map<UUID, CachedSummary> summaryCache = new ConcurrentHashMap<>();

    public RetailerSummaryResponse resolveOne(UUID retailerId) {
        if (retailerId == null) {
            return null;
        }
        long now = System.nanoTime();
        CachedSummary cached = summaryCache.get(retailerId);
        if (cached != null && now < cached.expiresAtNanos()) {
            return cached.summary();
        }
        try {
            RetailerSummaryResponse fresh =
                    feignCallSupport.call("lbos-partner", () -> partnerVerificationClient.get(retailerId));
            if (fresh != null) {
                if (summaryCache.size() >= MAX_CACHED_SUMMARIES) {
                    summaryCache.clear();
                }
                summaryCache.put(retailerId, new CachedSummary(fresh, now + SUMMARY_TTL_NANOS));
            }
            return fresh;
        } catch (RuntimeException failure) {
            return null;
        }
    }
}
