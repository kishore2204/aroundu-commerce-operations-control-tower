package com.lbos.commercecustomer.dto.client.order; import java.util.*;import java.math.*;
/** lines carries one per-product/per-retailer verdict - see S4's ServiceabilityResponse. */
public record ServiceabilityResponse(boolean serviceable,BigDecimal deliveryCharge,String estimate,String reasonCode,List<LineServiceabilityResult> lines) {}