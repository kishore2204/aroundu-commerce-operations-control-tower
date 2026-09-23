package com.lbos.commercecustomer.dto.response; import java.util.*;import com.lbos.commercecustomer.dto.client.order.LineServiceabilityResult;
/** Result of checking the current cart's lines against a candidate delivery address - used by
 * the Cart's address-change flow, and again (via CheckoutServiceImpl) right before checkout. */
public record CartServiceabilityResponse(UUID addressId,boolean allServiceable,List<LineServiceabilityResult> lines) {}
