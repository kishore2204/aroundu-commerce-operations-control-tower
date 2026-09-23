package com.cbg.lbos.dto.client;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Per-product/per-retailer serviceability verdict - a multi-retailer cart must be checked
 * one line at a time (a product from an unserviceable retailer must not silently fail the
 * whole cart's check), so the aggregate ServiceabilityResponse now carries one of these per
 * requested product alongside its overall serviceable flag.
 */
public record LineServiceabilityResult(
        Long productId,
        UUID retailerId,
        boolean serviceable,
        String reasonCode,
        BigDecimal deliveryCharge,
        String estimate) {
}
