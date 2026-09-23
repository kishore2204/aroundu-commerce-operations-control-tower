package com.cbg.lbos.dto.client;

import java.math.BigDecimal;
import java.util.List;

/**
 * serviceable/deliveryCharge/estimate/reasonCode remain the whole-cart aggregate (serviceable
 * is true only when every line is serviceable) for callers that don't need per-line detail.
 * lines carries one LineServiceabilityResult per requested product, so a caller can show
 * "this product isn't serviceable" for one retailer while keeping others in the cart - see
 * InternalOrderLogisticsController.serviceability().
 */
public record ServiceabilityResponse(
        boolean serviceable,
        BigDecimal deliveryCharge,
        String estimate,
        String reasonCode,
        List<LineServiceabilityResult> lines) {
}
