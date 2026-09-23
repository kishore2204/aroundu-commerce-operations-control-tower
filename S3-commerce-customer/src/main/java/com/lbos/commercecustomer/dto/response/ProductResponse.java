package com.lbos.commercecustomer.dto.response; import java.util.*;import java.time.*;import java.math.*;import com.lbos.commercecustomer.enums.ProductStatus;import com.lbos.commercecustomer.enums.InventoryStatus;
/** retailerName/retailerStatus/retailerLatitude/retailerLongitude identify the shop a product
 * is sold by, resolved from S2 (see CommerceMapper.product(Product,RetailerSummaryResponse)) -
 * every customer-facing product listing must show this so a product is never displayed
 * without its shop. Null when the S2 lookup failed (best-effort enrichment, never blocks the
 * product itself from rendering) or the product has no retailer id. There is no retailer
 * rating field here - GET /api/v1/retailers/{id}/rating-summary is a separate, lazily-fetched
 * endpoint since a per-product-card rating would mean a live aggregate query on every listing
 * page render. */
public record ProductResponse(Long id,String name,String sku,Long categoryId,String categoryName,UUID retailerId,String retailerName,String retailerStatus,BigDecimal retailerLatitude,BigDecimal retailerLongitude,BigDecimal unitPrice,int stock,ProductStatus status,InventoryStatus inventoryStatus,String description,String qualityFlag,Integer lowStockThreshold,BigDecimal weightKg) {}