package com.lbos.commercecustomer.dto.response; import java.util.*;
/** Retailer-level rating, derived from CustomerReview across every one of the retailer's
 * products (there is no dedicated retailer-rating concept anywhere else in the system).
 * Computed lazily, only when a customer expands a shop card - never baked into
 * ProductResponse, which would mean this aggregate query ran on every product-list render. */
public record RetailerRatingSummaryResponse(UUID retailerId,double average,long count) {}
