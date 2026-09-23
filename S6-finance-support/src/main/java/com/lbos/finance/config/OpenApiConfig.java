package com.lbos.finance.config;
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
    public OpenAPI financeOpenApi() {
        SecurityScheme bearerAuthentication = new SecurityScheme()
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT");
        return new OpenAPI().info(new Info().title("LBOS Finance Integration API").version("1.0.0")
                .description("APIs for payment, settlement, refund, tax, support, notification, audit and customer invoice. Use POST /api/v1/auth/login on S1 to obtain a JWT, then Authorize Swagger with Bearer <token>."))
                .components(new Components().addSecuritySchemes("bearerAuth", bearerAuthentication))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }
}
