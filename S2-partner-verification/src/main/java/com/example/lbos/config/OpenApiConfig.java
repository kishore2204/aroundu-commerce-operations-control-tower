package com.example.lbos.config;

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
        SecurityScheme bearerAuthentication = new SecurityScheme()
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT");

        return new OpenAPI()
                .info(new Info()
                        .title("AroundU Partner Verification API")
                        .version("v1.2")
                        .description("Retailer, fleet-owner and verification-queue APIs. Use POST /api/v1/auth/login on S1 to obtain a JWT, then Authorize Swagger with Bearer <token>."))
                .components(new Components().addSecuritySchemes("bearerAuth", bearerAuthentication))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }
}
