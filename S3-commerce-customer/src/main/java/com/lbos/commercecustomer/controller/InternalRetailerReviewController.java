package com.lbos.commercecustomer.controller;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.lbos.commercecustomer.repository.CustomerReviewRepository;

/**
 * Service-to-service read of the EXISTING customer reviews, grouped by retailer, for S2's Location Manager
 * dashboard (which has already checked that the retailers belong to the caller's zone). Same review data the
 * customer-facing retailer rating summary uses - no second rating mechanism. Gated by the shared Basic-auth
 * credential like every /api/v1/internal/** route here.
 */
@RestController
@RequestMapping("/api/v1/internal/retailers")
public class InternalRetailerReviewController {

    public record RatingSummariesRequest(Collection<UUID> retailerIds) { }

    public record RetailerRating(UUID retailerId, double average, long count) { }

    public record RetailerReview(short rating, String comment, String productName, OffsetDateTime createdAt) { }

    public record RetailerReviewPage(List<RetailerReview> items, long totalElements, int page, int size) { }

    private final CustomerReviewRepository reviews;

    public InternalRetailerReviewController(CustomerReviewRepository reviews) {
        this.reviews = reviews;
    }

    /** One grouped query for a whole page of retailers. Retailers with no reviews are simply absent. */
    @PostMapping("/rating-summaries")
    public List<RetailerRating> ratingSummaries(@RequestBody RatingSummariesRequest request) {
        if (request.retailerIds() == null || request.retailerIds().isEmpty()) {
            return List.of();
        }
        return reviews.ratingsByRetailerIds(request.retailerIds()).stream()
                .map(row -> new RetailerRating(row.getRetailerId(), row.getAverage() == null ? 0 : row.getAverage(),
                        row.getTotal() == null ? 0 : row.getTotal()))
                .toList();
    }

    /** Individual customer reviews of the retailer's products, newest first. No customer identity is returned. */
    @GetMapping("/{retailerId}/reviews")
    public RetailerReviewPage reviewsOf(@PathVariable UUID retailerId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        Page<com.lbos.commercecustomer.entity.CustomerReview> result =
                reviews.pageByRetailerId(retailerId, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50)));
        return new RetailerReviewPage(
                result.getContent().stream()
                        .map(review -> new RetailerReview(review.getRating(), review.getText(),
                                review.getProduct() == null ? null : review.getProduct().getName(), review.getCreatedAt()))
                        .toList(),
                result.getTotalElements(), result.getNumber(), result.getSize());
    }
}
