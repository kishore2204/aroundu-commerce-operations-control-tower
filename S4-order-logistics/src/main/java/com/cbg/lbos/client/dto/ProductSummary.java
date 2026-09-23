package com.cbg.lbos.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * S4-local mirror of S3's ProductResponse payload.
 * Used to snapshot product data onto an OrderItem at creation time.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ProductSummary(
        Long id,
        String name,
        String sku,
        Long categoryId,
        String categoryName,
        UUID retailerId,
        BigDecimal unitPrice,
        int stock,
        String status,
        String inventoryStatus,
        String description,
        /** Weight of one unit in kg - null when S3 has none stored (treated as 1 kg). */
        BigDecimal weightKg) {

    public ProductSummary(Long id, String name, String sku, Long categoryId, String categoryName, UUID retailerId,
            BigDecimal unitPrice, int stock, String status, String inventoryStatus, String description) {
        this(id, name, sku, categoryId, categoryName, retailerId, unitPrice, stock, status, inventoryStatus, description, null);
    }
}
