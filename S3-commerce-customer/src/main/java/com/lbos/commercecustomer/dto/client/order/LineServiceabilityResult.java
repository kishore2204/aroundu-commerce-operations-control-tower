package com.lbos.commercecustomer.dto.client.order; import java.util.*;import java.math.*;
/** S3-local mirror of S4's LineServiceabilityResult - kept field-for-field in sync. */
public record LineServiceabilityResult(Long productId,UUID retailerId,boolean serviceable,String reasonCode,BigDecimal deliveryCharge,String estimate) {}
