package com.cbg.lbos.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
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

import com.cbg.lbos.security.JwtAuthenticationFilter;
import com.cbg.lbos.security.JwtService;

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
     * Service-to-service endpoints use Basic authentication only. Keeping this
     * in a separate filter chain prevents browsers and Swagger from receiving
     * a Basic Auth challenge on normal end-user APIs.
     */
    @Bean
    @Order(1)
    public SecurityFilterChain internalSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/internal/**")
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(authorize -> authorize
                        .anyRequest().hasRole("SERVICE"))
                .httpBasic(Customizer.withDefaults());

        return http.build();
    }

    /**
     * End-user APIs use JWT. There is intentionally no HTTP Basic challenge on
     * this chain; users obtain a token from /api/v1/auth/login.
     *
     * JwtAuthenticationFilter is constructed directly here rather than as a
     * separate @Bean - a plain Filter bean is auto-registered by Spring Boot
     * as a servlet filter across every URL (in addition to being added to
     * this chain via addFilterBefore), so it used to run twice per request.
     * The second pass reset/duplicated the authentication set by the first,
     * which was surfacing as 403s for otherwise-valid SUPER_ADMIN/OPERATIONS_
     * MANAGER/LOCATION_MANAGER JWTs.
     *
     * The explicit authenticationEntryPoint below makes an unauthenticated
     * request return 401 (no/invalid credentials) rather than Spring
     * Security's default 403 (valid credentials, insufficient permission),
     * which is what distinguishes anonymousUserIsBlocked from
     * operationsManagerCannotAccessAdminOperationsManagerApi in
     * SecurityIntegrationTest - without it, both cases returned 403 and were
     * indistinguishable from a client's point of view.
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
                                "/h2-console/**",
                                "/actuator/health",
                                "/error")
                        .permitAll()
                        .requestMatchers(
                                "/api/v1/auth/login",
                                "/api/v1/auth/register",
                                "/api/v1/auth/register/**",
                                "/api/v1/auth/forgot-password",
                                "/api/v1/auth/reset-password")
                        .permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/states/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER", "CUSTOMER", "RETAILER", "FLEET_MANAGER", "DRIVER")
                        .requestMatchers(
                                "/api/states/**",
                                "/api/user-accounts/**")
                        .hasRole("SUPER_ADMIN")
                        /*
                         * An Operations Manager needs to read the operations-manager list (e.g.
                         * to populate the "supervising operations manager" dropdown when
                         * assigning a Location Manager) even though only SUPER_ADMIN may create,
                         * reassign, or deactivate one - matched first (GET only), same pattern as
                         * the cities/zones GET carve-out below.
                         */
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/api/v1/operations-managers/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
                        .requestMatchers("/api/v1/operations-managers/**")
                        .hasRole("SUPER_ADMIN")
                        /*
                         * The Gateway's RouteAuthorizationRules already names this group
                         * GEOGRAPHY_READERS and includes LOCATION_MANAGER, but this
                         * SecurityConfig - the narrower of the two layers per
                         * docs/api-catalog.md's own rule ("treat the narrower as effective") -
                         * blocked LOCATION_MANAGER entirely, so a valid LOCATION_MANAGER JWT
                         * got 403'd here even after passing the Gateway. Matched first (GET
                         * only) so a Location Manager can browse cities/zones to do their job;
                         * creating/editing territory stays an OPERATIONS_MANAGER/SUPER_ADMIN
                         * action, matched by the narrower rule below for every other method.
                         *
                         * CUSTOMER and RETAILER are also allowed to GET here (added for the
                         * address-form city/zone dropdown - a customer creating a delivery
                         * address, or a retailer registering their store, both need to browse
                         * the same non-sensitive reference data; there was previously no way
                         * for either role to populate that dropdown at all, forcing free-text
                         * city/zone names on the address form instead).
                         */
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/api/v1/cities/**",
                                "/api/v1/zones/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER", "CUSTOMER", "RETAILER", "FLEET_MANAGER", "DRIVER")
                        /*
                         * Cities are the top-level territory unit an Operations Manager is
                         * themselves assigned INTO (see OperationsManager.city) - creating one is
                         * a platform-setup action reserved for SUPER_ADMIN. Zones and Location
                         * Managers are the level an Operations Manager actually manages day to
                         * day within their own city (Zone belongs to a City; LocationManager
                         * belongs to a Zone and an OperationsManager - see the entity classes),
                         * so those stay open to OPERATIONS_MANAGER as well.
                         */
                        .requestMatchers("/api/v1/cities/**")
                        .hasRole("SUPER_ADMIN")
                        /*
                         * Self-lookup for a Location Manager's own assignment - the general
                         * location-managers rule below stays OPERATIONS_MANAGER/SUPER_ADMIN-only.
                         */
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/location-managers/me")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER")
                        .requestMatchers(
                                "/api/v1/zones/**",
                                "/api/v1/location-managers/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
                        .anyRequest()
                        .authenticated())
                .addFilterBefore(
                        jwtAuthenticationFilter,
                        org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
