package com.lbos.finance.integration.dto;
import java.util.UUID;
import java.math.BigDecimal;
/** Field names match S3's actual ProductResponse JSON shape (id/name/stock, not
 *  productId/productName/stockQuantity) - Jackson deserializes unmatched fields as null
 *  rather than erroring, so a name mismatch here fails silently, not loudly. */
public record ProductResponse(Long id, Long categoryId, UUID retailerId, String sku, String name, BigDecimal unitPrice, Integer stock, String status) { }
