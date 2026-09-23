package com.lbos.gateway.security;

import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Service-discovery-aware WebClient builder used only by {@link PlatformAccountEligibility} to
 * reach S1 by its Eureka name. Named explicitly so it never replaces or is confused with any other
 * WebClient.Builder in the application context.
 */
@Configuration
public class AccountEligibilityConfig {

    @Bean("loadBalancedWebClientBuilder")
    @LoadBalanced
    WebClient.Builder loadBalancedWebClientBuilder() {
        return WebClient.builder();
    }
}
