package com.cbg.lbos.client;

import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * HTTP Basic credentials for other services' internal APIs (e.g. S2's /internal/v1/**).
 * Mirrors S3's/S4's/S6's ServiceBasicAuthFeignConfig exactly (see any of those for the full
 * rationale on why this is deliberately not @Configuration-annotated).
 */
public class ServiceBasicAuthFeignConfig {

    private static final String SERVICE_USERNAME = "lbos-service";

    @Bean
    public RequestInterceptor serviceBasicAuthRequestInterceptor(
            @Value("${app.security.service.password:service123}") String servicePassword) {
        String credentials = SERVICE_USERNAME + ":" + servicePassword;
        String encoded = Base64.getEncoder().encodeToString(
                credentials.getBytes(StandardCharsets.UTF_8));
        String headerValue = "Basic " + encoded;

        return requestTemplate -> requestTemplate.header("Authorization", headerValue);
    }
}
