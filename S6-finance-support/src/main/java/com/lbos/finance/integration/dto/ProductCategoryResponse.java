package com.lbos.finance.integration.dto;

/** Field names match S3's actual CategoryResponse JSON shape (id/name, not
 *  categoryId/categoryName) - Jackson deserializes unmatched fields as null rather than
 *  erroring, so a name mismatch here fails silently, not loudly. */
public record ProductCategoryResponse(Long id, String name, String description, String status) { }
