package com.lbos.commercecustomer.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI api() {
        // The X-User-Account-Id header this used to advertise was removed along with
        // HeaderAuthenticatedUserProvider earlier in this hardening pass - S3 now resolves
        // identity from the JWT via SecurityContextHolder only, the same as every other
        // service, so this scheme now matches what the running SecurityConfig actually enforces.
        SecurityScheme bearerAuthentication = new SecurityScheme()
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT");

        return new OpenAPI()
                .info(new Info()
                        .title("AroundU Commerce & Customer API")
                        .version("v1.2")
                        .description("Product, category, customer, cart, order and review APIs. Use POST /api/v1/auth/login on S1 to obtain a JWT, then Authorize Swagger with Bearer <token>."))
                .components(new Components()
                        .addSecuritySchemes("bearerAuth", bearerAuthentication))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }
}
