package com.lbos.finance.integration.client;
import java.util.List;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
import com.lbos.finance.integration.dto.*;
/**
 * S3's real mappings are /api/v1/products/** and /api/v1/product-categories/** (both public,
 * permitAll GET - no credentials needed here, same as S4's ProductClient). The previous
 * version of this client called "/api/products/{id}" and "/api/product-categories/{id}" -
 * missing the "/v1/" segment - which never matched any real S3 route.
 *
 * S3 wraps every response in its ApiResponse envelope ({timestamp, correlationId, message, data}),
 * so the raw calls return {@link CatalogEnvelope} and the getX(...) methods callers use unwrap it.
 */
@FeignClient(name = "lbos-commerce")
public interface CatalogServiceClient {
    @GetMapping("/api/v1/products/{productId}") CatalogEnvelope<ProductResponse> fetchProduct(@PathVariable("productId") Long productId);
    @GetMapping("/api/v1/product-categories/{categoryId}") CatalogEnvelope<ProductCategoryResponse> fetchProductCategory(@PathVariable("categoryId") Long categoryId);
    @GetMapping("/api/v1/product-categories/active") CatalogEnvelope<List<ProductCategoryResponse>> fetchActiveProductCategories();

    default ProductResponse getProduct(Long productId) {
        CatalogEnvelope<ProductResponse> envelope = fetchProduct(productId);
        return envelope == null ? null : envelope.data();
    }

    default ProductCategoryResponse getProductCategory(Long categoryId) {
        CatalogEnvelope<ProductCategoryResponse> envelope = fetchProductCategory(categoryId);
        return envelope == null ? null : envelope.data();
    }

    default List<ProductCategoryResponse> getActiveProductCategories() {
        CatalogEnvelope<List<ProductCategoryResponse>> envelope = fetchActiveProductCategories();
        return envelope == null || envelope.data() == null ? List.of() : envelope.data();
    }
}
