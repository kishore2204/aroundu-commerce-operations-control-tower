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
     * Service-to-service lookups (S3 checking delivery serviceability / review eligibility,
     * via InternalOrderLogisticsController) use Basic authentication only, in its own filter
     * chain so browsers/Swagger never see a Basic Auth challenge on the normal end-user APIs.
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
     * End-user/staff APIs use the JWT issued by S1's /api/v1/auth/login - there is
     * intentionally no HTTP Basic challenge on this chain.
     *
     * Order/OrderItem endpoints require a valid token but are not further restricted by
     * ownership here: S4 stores customerProfileId as an unvalidated scalar FK from S3 by
     * deliberate design (see OrderService.copyDtoToEntity), the same way every cross-service
     * reference in this system is stored - resolving "does this JWT's user own this order"
     * would mean adding new cross-service identity-resolution infrastructure that doesn't
     * exist anywhere else in the codebase, which is out of scope for closing the "no
     * authentication at all" gap this class exists to fix.
     *
     * Listing everything (GET with no id) and Trip/LogisticsBookingDetail mutations
     * (dispatch assigning vehicles/drivers, lifecycle transitions) are staff-only for now;
     * true driver-self-service (a driver acting on their own trip) needs the same kind of
     * identity resolution against S5, which owns Driver - that belongs to the S5 checkpoint.
     *
     * JwtAuthenticationFilter is constructed directly here rather than as a separate @Bean -
     * a plain Filter bean is auto-registered by Spring Boot as a servlet filter across every
     * URL (in addition to being added to this chain via addFilterBefore), so it used to run
     * twice per request, which could surface as a valid JWT intermittently not being
     * recognized. The explicit authenticationEntryPoint makes an unauthenticated request
     * return 401 (no/invalid credentials) rather than Spring Security's default 403.
     *
     * The explicit accessDeniedHandler and the "/error" permitAll below fix a bug where a
     * role-restricted endpoint hit with valid-but-wrong-role credentials returned 401 instead
     * of 403: AccessDeniedHandlerImpl calls response.sendError(403), which triggers the
     * servlet container's internal forward to GET /error (Spring Boot's BasicErrorController).
     * That forward carries no Authorization header and re-enters this same filter chain: since
     * "/error" wasn't permitAll, it failed authentication and the entryPoint overwrote the
     * original 403 with 401 before it reached the client. See docs/SEED_DATA_CONTRACT.md.
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
                        .requestMatchers(HttpMethod.GET,
                                "/api/orders", "/api/order-items", "/api/trips", "/api/logistics-bookings")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
                        /*
                         * Fleet-owner self-service read: a FLEET_MANAGER's own trips, scoped by
                         * fleetOwnerId query param - mirrors GET /api/orders/mine?retailerId= just
                         * above and the equivalent /mine routes added to S5 (drivers/vehicles/
                         * assignments/expenses).
                         */
                        .requestMatchers(HttpMethod.GET, "/api/trips/mine")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "FLEET_MANAGER")
                        /*
                         * FLEET_MANAGER included on POST/PUT: accepting a delivery request IS
                         * creating a Trip (POST /api/trips, see FleetAssignmentsComponent on the
                         * frontend). DRIVER included on the same two: a driver does have their own
                         * login (DRIVER role, created by DriverServiceImpl), and the driver-app
                         * lifecycle actions (pickup/confirm/complete under /api/trips/{id}/**, plus
                         * the generic PUT the driver dashboard uses to record distanceKm alongside
                         * the pickup status change) are performed from that driver's own session -
                         * the fleet manager's job stops at assigning driver+vehicle. DELETE stays
                         * staff-only (destructive, not part of the accept/lifecycle flow).
                         */
                        .requestMatchers(HttpMethod.POST, "/api/trips/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "FLEET_MANAGER", "DRIVER")
                        .requestMatchers(HttpMethod.PUT, "/api/trips/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "FLEET_MANAGER", "DRIVER")
                        .requestMatchers(HttpMethod.DELETE, "/api/trips/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
                        /*
                         * CUSTOMER included: a customer creates their own logistics booking
                         * (POST) and can amend it before pickup (PUT) directly from the
                         * /logistics booking flow - there is no staff step in between, unlike a
                         * RETAIL order's retailer-accept. Without this, the Gateway's
                         * LOGISTICS_PARTICIPANTS (which already includes CUSTOMER) let the
                         * request through, but it 403'd here.
                         */
                        .requestMatchers(HttpMethod.PUT, "/api/logistics-rates/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
                        .requestMatchers(HttpMethod.POST, "/api/logistics-bookings/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "CUSTOMER")
                        .requestMatchers(HttpMethod.PUT, "/api/logistics-bookings/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "CUSTOMER")
                        .requestMatchers(HttpMethod.DELETE, "/api/logistics-bookings/**")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
                        .anyRequest()
                        .authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
