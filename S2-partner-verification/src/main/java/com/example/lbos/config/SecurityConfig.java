package com.example.lbos.config;

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

import com.example.lbos.security.JwtAuthenticationFilter;
import com.example.lbos.security.JwtService;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    public InMemoryUserDetailsManager internalServiceUser(
            @Value("${app.security.service.password:service123}") String servicePassword,
            PasswordEncoder passwordEncoder) {
        return new InMemoryUserDetailsManager(
                User.withUsername("lbos-service")
                        .password(passwordEncoder.encode(servicePassword))
                        .roles("SERVICE")
                        .build());
    }

    /**
     * Service-to-service endpoints (S1/S3/S5 looking up retailer, fleet-owner, and
     * verification-acknowledgement data) use Basic authentication only, in its own filter
     * chain so browsers/Swagger never see a Basic Auth challenge on the normal end-user APIs.
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
     * End-user APIs use the JWT issued by S1's /api/v1/auth/login - there is intentionally
     * no HTTP Basic challenge on this chain.
     *
     * JwtAuthenticationFilter is constructed directly here rather than as a separate @Bean -
     * a plain Filter bean is auto-registered by Spring Boot as a servlet filter across every
     * URL (in addition to being added to this chain via addFilterBefore), so it used to run
     * twice per request, which could surface as a valid JWT intermittently not being
     * recognized. The explicit authenticationEntryPoint makes an unauthenticated request
     * return 401 (no/invalid credentials) rather than Spring Security's default 403.
     *
     * The explicit accessDeniedHandler makes a request from an authenticated-but-wrong-role
     * user return 403 - AccessDeniedHandlerImpl calls response.sendError(403), which triggers
     * the servlet container's error-page dispatch to GET /error (an internal forward, no
     * Authorization header). That forward re-enters this SAME filter chain, so /error MUST be
     * permitAll()'d - otherwise it falls through to anyRequest().authenticated(), fails
     * authentication on the forward (no token), and the authenticationEntryPoint overwrites
     * the original 403 with 401 before it ever reaches the client. Confirmed live in S1 - see
     * docs/SEED_DATA_CONTRACT.md "Critical shared bug found in S1".
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
                                "/error",
                                "/swagger-ui.html",
                                "/swagger-ui/**",
                                "/v3/api-docs/**",
                                "/h2-console/**",
                                "/actuator/health")
                        .permitAll()
                        /*
                         * submit-for-verification is the common step any authenticated subject
                         * owner (retailer/fleet owner, or a fleet owner adding a driver/vehicle)
                         * triggers themselves - it must NOT fall under the admin-only POST rule
                         * below. Matched first since requestMatchers are evaluated in
                         * declaration order (first match wins).
                         */
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                                "/api/verification-queues/*/submit-for-verification")
                        .authenticated()
                        /*
                         * A Location Manager reviews and decides submissions routed to them, and
                         * may assign a reviewer to a pending item - LOCATION_MANAGER is a real
                         * seeded S1 role that previously had no write access here at all despite
                         * being the intended reviewer for this whole workflow.
                         */
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                                "/api/verification-queues/*/process-result",
                                "/api/verification-documents/*/decision")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER")
                        .requestMatchers(org.springframework.http.HttpMethod.PATCH,
                                "/api/verification-queues/*/assign")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER")
                        /*
                         * Revoking a previously-APPROVED subject (blocking them later) is the
                         * same reviewer population as process-result above, not an admin-only
                         * CRUD action - matched first for the same reason.
                         */
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                                "/api/verification-queues/*/revoke")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER")
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                                "/api/verification-queues/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
                        .requestMatchers(org.springframework.http.HttpMethod.PUT,
                                "/api/verification-queues/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
                        .requestMatchers(org.springframework.http.HttpMethod.PATCH,
                                "/api/verification-queues/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
                        .requestMatchers(org.springframework.http.HttpMethod.DELETE,
                                "/api/verification-queues/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
                        /*
                         * Work transfer: which pending requests a Location Manager still holds is Operations Manager /
                         * Super Admin information (the transfer POST is already covered by the POST rule above).
                         */
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/api/verification-queues/pending-work/*")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
                        /* The Location Manager's own zone dashboard - the zone itself is resolved server-side from the JWT. */
                        .requestMatchers("/api/location-dashboard/**")
                        .hasRole("LOCATION_MANAGER")
                        .requestMatchers(
                                "/api/retailers/**",
                                "/api/fleet-owners/**",
                                "/api/verification-queues/**",
                                "/api/verification-documents/**")
                        .authenticated()
                        .anyRequest()
                        .authenticated())
                .addFilterBefore(
                        jwtAuthenticationFilter,
                        org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
