package com.lbos.commercecustomer.dto.response;

/**
 * Aggregate payload for the customer product-details screen: the existing
 * {@link ProductResponse} (category, price, stock, inventory status) plus the
 * review {@link RatingSummaryResponse}, so the frontend needs one call instead
 * of two. The standalone contracts of both nested types are unchanged.
 */
public record ProductDetailsResponse(ProductResponse product, RatingSummaryResponse ratingSummary) {}
