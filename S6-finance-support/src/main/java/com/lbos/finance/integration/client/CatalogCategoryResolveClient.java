package com.lbos.finance.integration.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import com.lbos.finance.integration.dto.ProductCategoryResponse;

/**
 * S3 owns {@code ProductCategory}. The admin's "new tax rule" form takes a typed category name; S3 finds that
 * category (trimmed, case-insensitive) or creates it ACTIVE and returns it, so S6 only ever stores the category id.
 * Service-to-service only (S3's {@code /api/v1/internal/**} sits behind the shared Basic credential), separate from
 * {@link CatalogServiceClient} whose calls are public reads.
 */
@FeignClient(name = "lbos-commerce", contextId = "financeCategoryResolveClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface CatalogCategoryResolveClient {

    @PostMapping("/api/v1/internal/product-categories/resolve")
    CategoryResolution resolve(@RequestBody ResolveRequest request);

    record ResolveRequest(String name, boolean createIfMissing) { }

    record CategoryResolution(ProductCategoryResponse category, boolean created) { }
}
