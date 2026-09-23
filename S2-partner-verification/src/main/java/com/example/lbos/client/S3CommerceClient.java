package com.example.lbos.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * S2 -> S3 (lbos-commerce): the EXISTING customer reviews, grouped by retailer, for the Location Manager
 * dashboard. S2 only asks after it has checked the retailers belong to the caller's zone.
 */
@FeignClient(name = "lbos-commerce", contextId = "partnerCommerceClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface S3CommerceClient {

    /** Average rating and review count for many retailers in one call (retailers without reviews are absent). */
    @PostMapping("/api/v1/internal/retailers/rating-summaries")
    List<RetailerRating> ratingSummaries(@RequestBody RatingSummariesRequest request);

    @GetMapping("/api/v1/internal/retailers/{retailerId}/reviews")
    RetailerReviewPage reviewsOf(@PathVariable("retailerId") UUID retailerId,
            @RequestParam("page") int page, @RequestParam("size") int size);

    record RatingSummariesRequest(Collection<UUID> retailerIds) {
    }

    record RetailerRating(UUID retailerId, double average, long count) {
    }

    record RetailerReview(short rating, String comment, String productName, OffsetDateTime createdAt) {
    }

    record RetailerReviewPage(List<RetailerReview> items, long totalElements, int page, int size) {
    }
}
