package com.lbos.finance.integration.client;

import java.util.UUID;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import com.lbos.finance.integration.dto.CustomerProfileResponse;
import com.lbos.finance.integration.dto.CustomerServiceAreaResponse;

@FeignClient(name = "lbos-commerce", contextId = "financeCustomerClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface CustomerServiceClient {

    @GetMapping("/api/v1/internal/customers/{customerProfileId}")
    CustomerProfileResponse getCustomerProfile(@PathVariable("customerProfileId") UUID customerProfileId);

    /** Used by the support-ticket clustering sweep to resolve a customer's territory. */
    @GetMapping("/api/v1/internal/customers/{customerProfileId}/service-area")
    CustomerServiceAreaResponse getCustomerServiceArea(@PathVariable("customerProfileId") UUID customerProfileId);
}
