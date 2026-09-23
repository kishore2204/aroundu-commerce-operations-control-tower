package com.cbg.lbos.client;

import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * HTTP Basic credentials for the S1 (lbos-platform) internal API.
 *
 * <p>Deliberately NOT annotated with {@code @Configuration}: Spring Cloud OpenFeign
 * treats a {@code @Configuration}-annotated class that sits inside a component-scanned
 * package as the DEFAULT configuration for every Feign client. Leaving the annotation
 * off keeps this interceptor scoped to the single client that names it via
 * {@code @FeignClient(configuration = ServiceBasicAuthFeignConfig.class)}, so the
 * credentials are never sent to S3 (lbos-commerce) or S5 (lbos-fleet).
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
