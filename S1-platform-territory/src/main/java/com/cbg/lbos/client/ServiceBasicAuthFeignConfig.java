package com.cbg.lbos.client;

import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

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
