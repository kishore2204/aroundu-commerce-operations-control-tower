package com.cbg.lbos.config;

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
     * Service-to-service lookups (S4 resolving driver/vehicle summaries via
     * InternalFleetController) use Basic authentication only, in its own filter chain so
     * browsers/Swagger never see a Basic Auth challenge on the normal end-user APIs.
     */
    @Bean
    @Order(1)
    public SecurityFilterChain internalSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/internal/v1/**")
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(authorize -> authorize
                        .anyRequest().hasRole("SERVICE"))
                .httpBasic(Customizer.withDefaults());

        return http.build();
    }

    /**
     * End-user/staff APIs use the JWT issued by S1's /api/v1/auth/login - there is
     * intentionally no HTTP Basic challenge on this chain.
     *
     * Driver/Vehicle/Assignment/Expense records are all keyed by fleetOwnerId, not by
     * userAccountId directly - resolving "does this JWT's user own this fleet owner" would
     * need the same kind of cross-service identity-resolution infrastructure that the S4
     * checkpoint deliberately left out of scope (see SecurityConfig there for the full
     * rationale). Until that exists, listing everything and every mutating fleet-management
     * action here is staff-only (SUPER_ADMIN/OPERATIONS_MANAGER); true fleet-owner/driver
     * self-service is a follow-up.
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
                                "/h2-console/**",
                                "/actuator/health",
                                "/error")
                        .permitAll()
                        .requestMatchers(HttpMethod.GET,
                                "/api/drivers", "/api/vehicles", "/api/assignments", "/api/expenses")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
                        /*
                         * Fleet-owner self-service reads: a FLEET_MANAGER's own drivers/vehicles/
                         * assignments/expenses, scoped by fleetOwnerId query param - mirrors S4's
                         * GET /api/orders/mine?retailerId= pattern (see OrderController there).
                         * Same trust model as that endpoint: the caller must be authenticated but
                         * fleetOwnerId itself isn't cross-checked against the JWT subject here,
                         * consistent with how mineForRetailer() already works.
                         */
                        .requestMatchers(HttpMethod.GET,
                                "/api/drivers/mine", "/api/vehicles/mine", "/api/assignments/mine", "/api/expenses/mine")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "FLEET_MANAGER")
                        /*
                         * A Fleet Manager's own JWT could never call their own driver/vehicle
                         * submit-for-verification (used to resubmit after a rejection, per the
                         * verification workflow) - confirmed live, 403 even though the Gateway's
                         * RouteAuthorizationRules already lets a FLEET_MANAGER token through to
                         * /api/vehicles/**. Scoped narrowly to this one sub-path rather than all
                         * of POST /api/drivers|vehicles/**: create() and status changes there
                         * take fleetOwnerId/target status with no caller-ownership check against
                         * the driver/vehicle's actual fleet owner, so widening those too would let
                         * any Fleet Manager mutate another fleet owner's driver/vehicle - a
                         * separate gap, not fixed here. Onboarding's own create path
                         * (FleetOwnerDriverController/FleetOwnerVehicleController in S2) already
                         * enforces ownership before it ever reaches S5's SERVICE-gated internal
                         * creation endpoint, so it doesn't depend on this rule at all.
                         */
                        .requestMatchers(HttpMethod.POST,
                                "/api/drivers/*/submit-for-verification", "/api/vehicles/*/submit-for-verification")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "FLEET_MANAGER")
                        /*
                         * A driver records their own trip expenses (fuel, toll) from the driver
                         * dashboard - see DriverDashboardComponent - so DRIVER needs POST here too.
                         * Scoped to /api/expenses/** only, matched before the general POST rule
                         * below so a DRIVER token doesn't also get drivers/vehicles/assignments.
                         */
                        .requestMatchers(HttpMethod.POST, "/api/expenses/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "FLEET_MANAGER", "DRIVER")
                        .requestMatchers(HttpMethod.POST, "/api/drivers/**", "/api/vehicles/**", "/api/assignments/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "FLEET_MANAGER")
                        .requestMatchers(HttpMethod.PATCH, "/api/drivers/**", "/api/vehicles/**",
                                "/api/assignments/**", "/api/expenses/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "FLEET_MANAGER")
                        .requestMatchers(HttpMethod.DELETE, "/api/drivers/**", "/api/vehicles/**",
                                "/api/assignments/**", "/api/expenses/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "FLEET_MANAGER")
                        .anyRequest()
                        .authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
