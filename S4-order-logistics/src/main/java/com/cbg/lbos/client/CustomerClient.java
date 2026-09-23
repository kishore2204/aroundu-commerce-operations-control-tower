package com.cbg.lbos.client;

import com.cbg.lbos.client.dto.CustomerSummary;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

/**
 * Reads customer profile data from S3 (lbos-commerce). Unlike ProductClient, S3's
 * /api/v1/internal/** prefix requires the shared HTTP Basic credential (see
 * ServiceBasicAuthFeignConfig), the same as S2/S5's internal endpoints.
 */
@FeignClient(
        name = "lbos-commerce",
        contextId = "s4CustomerClient",
        configuration = ServiceBasicAuthFeignConfig.class)
public interface CustomerClient {

    @GetMapping("/api/v1/internal/customers/{id}")
    CustomerSummary getCustomer(@PathVariable("id") UUID id);
}
