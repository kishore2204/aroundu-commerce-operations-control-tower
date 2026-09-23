package com.cbg.lbos.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/**
 * Atomically deducts/restores product stock in S3 (lbos-commerce) when S4 creates or cancels
 * an order item. Unlike ProductClient above (which reads S3's public product endpoint), this
 * calls S3's trusted internal namespace ("/api/v1/internal/**", see S3's SecurityConfig /
 * InternalInventoryController), so it needs the shared HTTP Basic credential - same
 * ServiceBasicAuthFeignConfig pattern DriverClient/VehicleClient already use for S5. A distinct
 * contextId is required because ProductClient already uses the "lbos-commerce" Feign client
 * name.
 */
@FeignClient(name = "lbos-commerce", contextId = "s4InventoryClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface InventoryClient {

    record StockMutationRequest(Integer quantity) {
    }

    record StockMutationResponse(Long productId, int stock, String inventoryStatus) {
    }

    @PostMapping("/api/v1/internal/products/{id}/deduct-stock")
    StockMutationResponse deductStock(@PathVariable("id") Long productId, @RequestBody StockMutationRequest request);

    @PostMapping("/api/v1/internal/products/{id}/restore-stock")
    StockMutationResponse restoreStock(@PathVariable("id") Long productId, @RequestBody StockMutationRequest request);
}
