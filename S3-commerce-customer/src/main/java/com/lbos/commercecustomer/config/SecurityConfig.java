package com.lbos.commercecustomer.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandlerImpl;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.lbos.commercecustomer.security.JwtAuthenticationFilter;
import com.lbos.commercecustomer.security.JwtService;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new ServiceSecretCachingPasswordEncoder(PasswordEncoderFactories.createDelegatingPasswordEncoder());
    }

    @Bean
    public InMemoryUserDetailsManager internalServiceUser(
            @Value("${app.security.service.password:service123}") String servicePassword,
            PasswordEncoder passwordEncoder) {
        return new InMemoryUserDetailsManager(
                User.withUsername("lbos-service")
                        .password(passwordEncoder instanceof ServiceSecretCachingPasswordEncoder cachingEncoder
                                ? cachingEncoder.encodeServiceSecret(servicePassword)
                                : passwordEncoder.encode(servicePassword))
                        .roles("SERVICE")
                        .build());
    }

    /**
     * Service-to-service lookups (S6 resolving a customer profile, etc.) use Basic
     * authentication only, in its own filter chain so browsers/Swagger never see a Basic Auth
     * challenge on the normal end-user APIs. Note this service's internal namespace is
     * "/api/v1/internal/**" (see InternalCustomerController), not "/internal/**" like S1/S2/S6.
     */
    @Bean
    @Order(1)
    public SecurityFilterChain internalSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/api/v1/internal/**")
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(authorize -> authorize
                        .anyRequest().hasRole("SERVICE"))
                .httpBasic(Customizer.withDefaults());

        return http.build();
    }

    /**
     * End-user APIs use the JWT issued by S1's /api/v1/auth/login - there is intentionally no
     * HTTP Basic challenge on this chain. Product/category browsing stays public; everything
     * that acts on "the current user" (cart, wishlist, checkout, addresses, reviews, retailer
     * self-service catalogue/inventory, customer profile) requires a valid token - identity is
     * always taken from the token subject, never from a client-supplied value.
     *
     * JwtAuthenticationFilter is constructed directly here rather than as a separate @Bean -
     * a plain Filter bean is auto-registered by Spring Boot as a servlet filter across every
     * URL (in addition to being added to this chain via addFilterBefore), so it used to run
     * twice per request, which could surface as a valid JWT intermittently not being
     * recognized. The explicit authenticationEntryPoint makes an unauthenticated request
     * return 401 (no/invalid credentials) rather than Spring Security's default 403.
     */
    @Bean
    @Order(2)
    public SecurityFilterChain apiSecurityFilterChain(
            HttpSecurity http,
            JwtService jwtService) throws Exception {

        JwtAuthenticationFilter jwtAuthenticationFilter = new JwtAuthenticationFilter(jwtService);

        http
                .csrf(csrf -> csrf.disable())
                .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                        .accessDeniedHandler(new AccessDeniedHandlerImpl()))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(
                                "/swagger-ui.html",
                                "/swagger-ui/**",
                                "/v3/api-docs/**",
                                "/actuator/health",
                                "/error")
                        .permitAll()
                        /*
                         * Depends on the caller's own identity (ctx.customer(), resolved from
                         * the JWT subject) - must be matched before the broad GET
                         * /api/v1/reviews/** permitAll rule below, which would otherwise let an
                         * unauthenticated request reach it with no customer to resolve.
                         */
                        .requestMatchers(HttpMethod.GET, "/api/v1/reviews/eligibility")
                        .authenticated()
                        .requestMatchers(HttpMethod.GET,
                                "/api/v1/products/**",
                                "/api/v1/product-categories/**",
                                "/api/v1/reviews/**")
                        .permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/customers")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
                        .requestMatchers(
                                "/api/v1/product-categories/**")
                        .hasRole("SUPER_ADMIN")
                        .requestMatchers("/api/v1/retailers/me/**")
                        .hasRole("RETAILER")
                        .anyRequest()
                        .authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
