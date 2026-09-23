package com.lbos.finance.config;

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
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.lbos.finance.security.JwtAuthenticationFilter;
import com.lbos.finance.security.JwtService;
import org.springframework.security.web.access.AccessDeniedHandlerImpl;

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
     * Service-to-service calls (S3's FinanceClient hitting the tax-calculation endpoint) use
     * Basic authentication only, in its own filter chain so browsers/Swagger never see a
     * Basic Auth challenge on the normal end-user/staff APIs.
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
     * Every /api/** controller in this service (payments, refunds, settlements, audit logs,
     * support tickets, tax configuration, invoices, notifications, analytics) was a back-office
     * finance/support surface with no customer-facing read or write anywhere in this module -
     * that changed for exactly two routes: a CUSTOMER now creates and captures their own
     * (simulated) payment as part of placing an order (see PaymentTransactionController /
     * PaymentTransactionServiceImpl's ownership check on create, and OrderService.submit() in
     * S4 for the surrounding checkout flow). Every other route keeps the original
     * SUPER_ADMIN/OPERATIONS_MANAGER-only posture.
     *
     * JwtAuthenticationFilter is constructed directly here rather than as a separate @Bean -
     * a plain Filter bean is auto-registered by Spring Boot as a servlet filter across every
     * URL (in addition to being added to this chain via addFilterBefore), so it used to run
     * twice per request, which could surface as a valid JWT intermittently not being
     * recognized. The explicit authenticationEntryPoint makes an unauthenticated request
     * return 401 (no/invalid credentials) rather than Spring Security's default 403.
     *
     * Two things are required to make a WRONG-role (as opposed to no-token) request
     * actually come back as 403, confirmed live while integrating S1 (see
     * docs/SEED_DATA_CONTRACT.md's "critical shared bug" section - not caught by
     * @WithMockUser-based MockMvc tests, only by a real end-to-end curl call):
     *  1. An explicit accessDeniedHandler (AccessDeniedHandlerImpl), so Spring Security's
     *     AuthorizationFilter has something other than its default 403 body to call.
     *  2. "/error" in the permitAll list. AccessDeniedHandlerImpl calls
     *     response.sendError(403), which triggers the servlet container's error-page
     *     dispatch to GET /error (an internal forward, carrying no Authorization header).
     *     That forward re-enters THIS SAME filter chain; without "/error" permitted, it
     *     falls to anyRequest().authenticated(), fails auth on the token-less forward, and
     *     the authenticationEntryPoint overwrites the original 403 with 401 before the
     *     client ever sees it.
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
                        /*
                         * Payment transactions: CUSTOMER creates and captures their own
                         * simulated payment as part of placing an order.
                         */
                        .requestMatchers(HttpMethod.POST,
                                "/api/payment-transactions", "/api/payment-transactions/*/capture")
                        .hasAnyRole("CUSTOMER", "SUPER_ADMIN", "OPERATIONS_MANAGER")
                        /*
                         * Notifications: any authenticated user can read their own notifications,
                         * mark them read, and the system can create notifications for any user.
                         * The /mine endpoint filters by the caller's own userAccountId.
                         */
                        .requestMatchers(HttpMethod.GET,
                                "/api/notifications", "/api/notifications/mine", "/api/notifications/mine/popup", "/api/notifications/*")
                        .authenticated()
                        .requestMatchers(HttpMethod.PATCH,
                                "/api/notifications/*/read", "/api/notifications/read-all", "/api/notifications/mine/clear")
                        .authenticated()
                        /*
                         * Support tickets: any authenticated user (any of the 7 roles - the new
                         * SUPPORT_STAFF included) can create a ticket, list/view/update their
                         * OWN ticket (ownership enforced in SupportTicketController, since this
                         * matcher can't tell "my ticket" from "someone else's ticket" apart), and
                         * post/read messages on a ticket they have access to (same ownership
                         * check, in SupportTicketService.addMessage/getMessages). Listing EVERY
                         * ticket with no filter (bare GET, below) is staff-only - a customer/
                         * retailer/etc. must never be able to browse every other user's tickets.
                         */
                        .requestMatchers(HttpMethod.POST, "/api/support-tickets")
                        .authenticated()
                        .requestMatchers(HttpMethod.GET,
                                "/api/support-tickets/mine", "/api/support-tickets/escalated-to-me",
                                "/api/support-tickets/*", "/api/support-tickets/*/messages",
                                "/api/support-tickets/*/context", "/api/support-tickets/*/delivery-proof")
                        .authenticated()
                        /*
                         * A retailer's/fleet owner's own "escalated to me" queue - see
                         * SupportTicketController.getEscalatedToEntity / entity-ticket-queue.component.
                         */
                        .requestMatchers(HttpMethod.GET, "/api/support-tickets/escalated-to-entity")
                        .hasAnyRole("RETAILER", "FLEET_MANAGER", "SUPER_ADMIN", "OPERATIONS_MANAGER")
                        .requestMatchers(HttpMethod.PUT, "/api/support-tickets/*")
                        .authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/support-tickets/*/messages")
                        .authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/support-tickets")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "SUPPORT_STAFF", "LOCATION_MANAGER")
                        /*
                         * Ticket handling actions (assign/resolve/close/escalate) are staff-only -
                         * SUPPORT_STAFF is the new first-line "Support Admin" persona from the
                         * workflow doc; LOCATION_MANAGER is included because a ticket can be
                         * escalated TO them (see escalateTicket's ESCALATION_TARGET_ROLES) and
                         * they need to be able to resolve/close/re-escalate what lands in their
                         * queue, same as OPERATIONS_MANAGER/SUPER_ADMIN already could.
                         */
                        .requestMatchers(HttpMethod.POST,
                                "/api/support-tickets/*/assign", "/api/support-tickets/*/resolve",
                                "/api/support-tickets/*/close", "/api/support-tickets/*/escalate")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "SUPPORT_STAFF", "LOCATION_MANAGER")
                        /*
                         * Settlements: staff see everything; a RETAILER / FLEET_MANAGER reads only their OWN
                         * rows - SettlementController scopes the result to the caller (resolved from the JWT
                         * subject). This used to be `.authenticated()` while the controller returned every
                         * business's payouts, so any signed-in user (even a customer) could read all of them.
                         * Writes remain staff-only.
                         */
                        .requestMatchers(HttpMethod.GET,
                                "/api/settlements", "/api/settlements/*")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "RETAILER", "FLEET_MANAGER")
                        /*
                         * Damage-claim resolution: whichever staff role is handling an ITEM_DAMAGED
                         * support ticket (SUPPORT_STAFF first-line, or LOCATION_MANAGER once
                         * escalated) needs to look up the order's payment transaction and then
                         * create/approve/reject the refund - see TicketDetailComponent's refund
                         * panel. Scoped to just these routes/methods rather than widening the
                         * anyRequest() fallback below, which stays SUPER_ADMIN/OPERATIONS_MANAGER
                         * for every other finance-admin surface (settlements writes, tax config,
                         * audit logs, invoices).
                         */
                        .requestMatchers(HttpMethod.GET, "/api/payment-transactions/by-order/*")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "SUPPORT_STAFF", "LOCATION_MANAGER")
                        .requestMatchers(HttpMethod.GET,
                                "/api/customer-refunds/by-ticket/*",
                                "/api/customer-refunds/eligibility/by-ticket/*")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "SUPPORT_STAFF", "LOCATION_MANAGER")
                        .requestMatchers(HttpMethod.POST, "/api/customer-refunds",
                                "/api/customer-refunds/*/approve", "/api/customer-refunds/*/reject")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "SUPPORT_STAFF", "LOCATION_MANAGER")
                        .requestMatchers(HttpMethod.POST, "/api/customer-refunds/*/complete")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
                        /* Business-action audit entries are appended by INTERNAL roles only (customers/partners are
                         * never audited - see the frontend audit interceptor). GET audit-log access remains
                         * covered by the staff-only fallback below. */
                        .requestMatchers(HttpMethod.POST, "/api/audit-logs")
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER", "SUPPORT_STAFF")
                        /*
                         * Everything else (delete, audit-log reads, analytics, tax config,
                         * settlement writes, notification creates/deletes) stays staff-only.
                         */
                        .anyRequest()
                        .hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER"))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
