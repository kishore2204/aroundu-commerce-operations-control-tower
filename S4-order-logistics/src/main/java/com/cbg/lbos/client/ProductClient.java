package com.cbg.lbos.client;

import com.cbg.lbos.client.dto.ApiResponseEnvelope;
import com.cbg.lbos.client.dto.ProductSummary;
import java.util.List;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * Reads product data from S3 (lbos-commerce). The endpoint is public in S3,
 * so no authentication header is required.
 */
@FeignClient(name = "lbos-commerce", contextId = "s4ProductClient")
public interface ProductClient {

    @GetMapping("/api/v1/products/{id}")
    ApiResponseEnvelope<ProductSummary> getProduct(@PathVariable("id") Long id);

    /** Batched form of {@link #getProduct(Long)} - see InternalOrderLogisticsController.serviceability(). */
    @GetMapping("/api/v1/products/by-ids")
    ApiResponseEnvelope<List<ProductSummary>> getProductsByIds(@RequestParam("ids") List<Long> ids);
}
