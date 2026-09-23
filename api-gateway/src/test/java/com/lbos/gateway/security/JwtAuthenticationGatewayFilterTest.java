package com.lbos.gateway.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class JwtAuthenticationGatewayFilterTest {

    private final JwtAuthenticationGatewayFilter authenticationFilter =
            new JwtAuthenticationGatewayFilter(testJwtProperties());

    private static JwtProperties testJwtProperties() {
        JwtProperties properties = new JwtProperties();
        properties.setSecret("unit-test-shared-jwt-signing-secret-not-for-production-use-32b");
        return properties;
    }

    @Test
    void customerCanReachRetailCommerceRoutes() {
        assertTrue(authenticationFilter.isRoleAuthorizedForPath("/api/v1/products/42", "CUSTOMER"));
        assertTrue(authenticationFilter.isRoleAuthorizedForPath("/api/v1/cart/items", "CUSTOMER"));
    }

    @Test
    void customerCannotReachFleetOperationsRoutes() {
        assertFalse(authenticationFilter.isRoleAuthorizedForPath("/api/vehicles", "CUSTOMER"));
        assertFalse(authenticationFilter.isRoleAuthorizedForPath("/api/drivers/available", "CUSTOMER"));
    }

    @Test
    void fleetManagerCanReachFleetOperationsRoutesButNotAdminRoutes() {
        assertTrue(authenticationFilter.isRoleAuthorizedForPath("/api/vehicles", "FLEET_MANAGER"));
        assertTrue(authenticationFilter.isRoleAuthorizedForPath("/api/assignments", "FLEET_MANAGER"));
        assertFalse(authenticationFilter.isRoleAuthorizedForPath("/api/user-accounts/1", "FLEET_MANAGER"));
        // Not /api/states - that's deliberately in GEOGRAPHY_READERS (which includes
        // FLEET_MANAGER) so a fleet owner's onboarding form can populate its state/city/zone
        // dropdowns; see RouteAuthorizationRules' comment on that set. /api/analytics stays
        // PLATFORM_STAFF-only and correctly excludes FLEET_MANAGER, so it's the genuine
        // admin-only route this assertion is meant to cover.
        assertFalse(authenticationFilter.isRoleAuthorizedForPath("/api/analytics", "FLEET_MANAGER"));
    }

    @Test
    void locationManagerCanReachVerificationRoutesButNotFleetOperations() {
        assertTrue(authenticationFilter.isRoleAuthorizedForPath("/api/verification-queues/1", "LOCATION_MANAGER"));
        assertTrue(authenticationFilter.isRoleAuthorizedForPath("/api/retailers", "LOCATION_MANAGER"));
        assertTrue(authenticationFilter.isRoleAuthorizedForPath("/api/v1/cities", "LOCATION_MANAGER"));
        assertFalse(authenticationFilter.isRoleAuthorizedForPath("/api/vehicles", "LOCATION_MANAGER"));
    }

    @Test
    void superAdminCanReachEverySeenRule() {
        assertTrue(authenticationFilter.isRoleAuthorizedForPath("/api/user-accounts/1", "SUPER_ADMIN"));
        assertTrue(authenticationFilter.isRoleAuthorizedForPath("/api/vehicles", "SUPER_ADMIN"));
        assertTrue(authenticationFilter.isRoleAuthorizedForPath("/api/v1/products/1", "SUPER_ADMIN"));
        assertTrue(authenticationFilter.isRoleAuthorizedForPath("/api/audit-logs", "SUPER_ADMIN"));
    }

    @Test
    void missingRoleClaimIsDeniedOnAnyMatchedRoute() {
        assertFalse(authenticationFilter.isRoleAuthorizedForPath("/api/v1/products/1", null));
    }

    @Test
    void unmappedPathFailsClosed() {
        assertFalse(authenticationFilter.isRoleAuthorizedForPath("/api/v1/some-future-endpoint", "CUSTOMER"));
    }

    @Test
    void everyAuthenticatedRoleCanReachNotificationsAndSupport() {
        for (String role : new String[] {"CUSTOMER", "RETAILER", "LOCATION_MANAGER", "OPERATIONS_MANAGER", "FLEET_MANAGER", "SUPER_ADMIN"}) {
            assertTrue(authenticationFilter.isRoleAuthorizedForPath("/api/notifications", role), role + " should reach notifications");
            assertTrue(authenticationFilter.isRoleAuthorizedForPath("/api/support-tickets", role), role + " should reach support");
        }
    }
}
