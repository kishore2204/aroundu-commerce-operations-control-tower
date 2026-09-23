package com.lbos.finance.integration.client;

import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * HTTP Basic credentials for S1 (lbos-platform)'s internal API. Mirrors S3's and S4's
 * ServiceBasicAuthFeignConfig exactly (see either for the full rationale on why this is
 * deliberately not @Configuration-annotated).
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
