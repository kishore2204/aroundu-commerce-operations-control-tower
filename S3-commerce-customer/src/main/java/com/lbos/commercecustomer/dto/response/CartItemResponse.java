package com.lbos.commercecustomer.dto.response; import java.util.*;import java.time.*;import java.math.*;
/** retailerId/retailerName identify which shop this line belongs to - needed so the Cart's
 * address-change flow can group/check serviceability per retailer (a multi-retailer cart must
 * be checked one shop at a time, never silently treated as a single unit). retailerName is
 * best-effort (null if the S2 lookup failed) - see CartServiceImpl. */
public record CartItemResponse(UUID cartItemId,Long productId,String productName,UUID retailerId,String retailerName,int quantity,BigDecimal unitPrice,BigDecimal lineTotal,int availableStock,boolean productActive) {}