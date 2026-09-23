package com.lbos.gateway.security;

import java.util.List;
import java.util.Set;

/**
 * Coarse, route-group-level role authorization table for the whole platform. This is the
 * Gateway's sole enforcement point for role-based access control - none of S2/S4/S5/S6 (and
 * only part of S1) enforce roles themselves, so this table is what actually keeps, for
 * example, a CUSTOMER token off fleet-management endpoints.
 *
 * <p>Deliberately coarse: it authorizes by route group (matching the Gateway's own route
 * definitions in application.yml), not by individual verb or by resource ownership. Per-owner
 * checks ("this is YOUR cart", "this is YOUR order") remain the responsibility of the owning
 * service, which already does this in several places (S1's JWT-derived identity, S3's
 * X-User-Account-Id trust). See docs/architecture.md for the full list of what is and is not
 * enforced at each layer.
 *
 * <p>The seven platform roles: CUSTOMER, RETAILER, LOCATION_MANAGER, OPERATIONS_MANAGER,
 * FLEET_MANAGER, SUPER_ADMIN, SUPPORT_STAFF. LOCATION_MANAGER absorbs what was previously a
 * separate Fleet Verification Officer role (retailer/fleet-owner/driver verification);
 * FLEET_MANAGER is the separate, purely operational fleet role (vehicles, drivers, assignments,
 * trips, expenses); SUPPORT_STAFF is the first-line support-ticket handler (S6 only).
 */
public final class RouteAuthorizationRules {

    private static final Set<String> SUPER_ADMIN_ONLY = Set.of("SUPER_ADMIN");
    private static final Set<String> PLATFORM_STAFF = Set.of("SUPER_ADMIN", "OPERATIONS_MANAGER");
    /*
     * CUSTOMER and RETAILER are included here even though this whole group's *writes* stay
     * OPERATIONS_MANAGER/SUPER_ADMIN-only - this rule doesn't distinguish HTTP verb (this table
     * is deliberately coarse, see the class doc comment), so S1's own SecurityConfig is what
     * actually narrows those two roles to GET-only on cities/zones. Added so a customer's
     * address form / a retailer's onboarding form can populate a city/zone dropdown at all -
     * there was previously no role that could read this reference data other than platform
     * staff, which is why those forms fell back to free-text city/zone names.
     */
    private static final Set<String> GEOGRAPHY_READERS =
            Set.of("SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER", "CUSTOMER", "RETAILER", "DRIVER", "FLEET_MANAGER");
    private static final Set<String> VERIFICATION_STAFF = Set.of("SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER");
    /*
     * Retailers and Fleet Owners (and, for driver/vehicle onboarding, Fleet Owners specifically)
     * are the ones actually uploading their own verification documents and triggering
     * submit-for-verification - VERIFICATION_STAFF alone (the reviewing side) previously left
     * this whole route blocked for the very roles the workflow depends on: a RETAILER/
     * FLEET_MANAGER token got a flat 403 from the Gateway before ever reaching S2, even though
     * S2's own SecurityConfig permitted it. Confirmed live, not a hypothetical.
     */
    /*
     * DRIVER also included: a driver uploads their own license/ID documents for their own
     * verification-queue entry (POST /api/verification-documents/upload) - S2's own
     * SecurityConfig already permits any authenticated role here, but this Gateway table
     * excluded DRIVER, so the request 403'd before ever reaching S2. Confirmed live: a driver
     * got "data access error" trying to upload a document.
     */
    private static final Set<String> VERIFICATION_PARTICIPANTS =
            Set.of("RETAILER", "FLEET_MANAGER", "DRIVER", "SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER");
    private static final Set<String> RETAILER_ONBOARDING = Set.of("RETAILER", "SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER");
    private static final Set<String> FLEET_OWNER_ONBOARDING = Set.of("FLEET_MANAGER", "SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER");
    private static final Set<String> CUSTOMER_COMMERCE = Set.of("CUSTOMER", "SUPER_ADMIN");
    private static final Set<String> CATALOGUE_READERS_AND_OWNERS = Set.of("CUSTOMER", "RETAILER", "SUPER_ADMIN");
    private static final Set<String> RETAILER_CATALOGUE_OWNERS = Set.of("RETAILER", "SUPER_ADMIN");
    /*
     * FLEET_MANAGER included: GET /api/orders/pending-fleet-assignment (browsing orders
     * awaiting a delivery partner) and GET /api/orders/{id} (read the order a Trip references)
     * are both under /api/orders/** - without this, the Gateway 403'd a Fleet Manager before
     * the request ever reached S4, even though S4's own SecurityConfig already permits it
     * (anyRequest().authenticated()). Confirmed live: the fleet assignments screen always showed
     * "No delivery requests" for a real Fleet Manager token, regardless of what orders existed.
     */
    private static final Set<String> ORDER_PARTICIPANTS = Set.of("CUSTOMER", "RETAILER", "FLEET_MANAGER", "SUPER_ADMIN");
    private static final Set<String> LOGISTICS_PARTICIPANTS = Set.of("CUSTOMER", "FLEET_MANAGER", "DRIVER", "SUPER_ADMIN");
    private static final Set<String> LOGISTICS_RATE_PARTICIPANTS = Set.of("CUSTOMER", "FLEET_MANAGER", "DRIVER", "OPERATIONS_MANAGER", "SUPER_ADMIN");
    private static final Set<String> FLEET_OPERATIONS = Set.of("FLEET_MANAGER", "SUPER_ADMIN");
    /** Verification reviewers need read access to one DRIVER/VEHICLE record so they can
     * cross-check the entered details against the uploaded document. S5 still gates mutations. */
    private static final Set<String> FLEET_VERIFICATION_READERS =
            Set.of("FLEET_MANAGER", "SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER");
    /*
     * A driver logs their own trip expenses (fuel, toll) from the driver dashboard - S5's own
     * SecurityConfig already permits FLEET_MANAGER on POST/PATCH/DELETE /api/expenses/**, this
     * just widens the Gateway's coarser per-path-group check to also let a DRIVER token reach
     * that same route group. Deliberately its own set (not folded into FLEET_OPERATIONS above)
     * so a driver stays unable to touch drivers/vehicles/assignments/fleet-dashboard routes.
     */
    private static final Set<String> FLEET_OPERATIONS_WITH_DRIVER = Set.of("FLEET_MANAGER", "SUPER_ADMIN", "DRIVER");
    private static final Set<String> FINANCE_PARTICIPANTS =
            Set.of("CUSTOMER", "RETAILER", "FLEET_MANAGER", "OPERATIONS_MANAGER", "SUPER_ADMIN");
    /*
     * A damage-claim support ticket (ITEM_DAMAGED) is resolved by whichever staff role picks it
     * up - SUPPORT_STAFF first-line, or LOCATION_MANAGER when escalated - and resolving it means
     * looking up the order's payment transaction and approving/rejecting a refund (see
     * TicketDetailComponent's refund panel, CustomerRefundController.getByTicket/approve/reject).
     * Widened from FINANCE_PARTICIPANTS rather than folding into it, since this coarse
     * route-group check doesn't itself gate CREATE/APPROVE vs. plain read - S6's own
     * SecurityConfig (the narrower of the two layers) still restricts which specific actions
     * each of these two added roles may take.
     */
    private static final Set<String> FINANCE_PARTICIPANTS_WITH_SUPPORT_STAFF = Set.of(
            "CUSTOMER", "RETAILER", "FLEET_MANAGER", "OPERATIONS_MANAGER", "SUPER_ADMIN",
            "SUPPORT_STAFF", "LOCATION_MANAGER");
    /*
     * SUPPORT_STAFF is the 7th platform role - the workflow doc's "Support Admin" persona,
     * first-line owner of support tickets (see S6's SupportTicketController/SecurityConfig).
     * Deliberately included only here (not in any of the narrower sets above): their job is
     * ticket resolution, not commerce/logistics/fleet/finance-admin work, so they get exactly
     * the same three routes every other role gets for their own account/tickets/notifications -
     * everything support-ticket-specific beyond that (assign/resolve/close/escalate) is enforced
     * by S6's own SecurityConfig, which is where the real role check for those actions lives.
     */
    private static final Set<String> EVERYONE_AUTHENTICATED =
            Set.of("CUSTOMER", "RETAILER", "LOCATION_MANAGER", "OPERATIONS_MANAGER", "FLEET_MANAGER", "SUPER_ADMIN", "SUPPORT_STAFF", "DRIVER");

    /** First matching rule wins; a path matching no rule is denied by the Gateway filter.
     * Every routed API must therefore have an explicit authorization rule. */
    public static final List<RouteAuthorizationRule> RULES = List.of(
            new RouteAuthorizationRule("/api/v1/users/me", EVERYONE_AUTHENTICATED),
            new RouteAuthorizationRule("/api/user-accounts/**", SUPER_ADMIN_ONLY),
            new RouteAuthorizationRule("/api/states/**", GEOGRAPHY_READERS),
            /*
             * PLATFORM_STAFF (not SUPER_ADMIN_ONLY): an Operations Manager needs to read this
             * list too (e.g. to populate the "supervising operations manager" dropdown when
             * assigning a Location Manager to a zone) even though only SUPER_ADMIN may create,
             * reassign, or deactivate an Operations Manager - this table doesn't distinguish HTTP
             * verb (see class doc comment), so S1's own SecurityConfig is what actually narrows
             * write access back to SUPER_ADMIN only, same pattern as GEOGRAPHY_READERS below.
             * Without this, GET here 403'd at the Gateway before ever reaching S1, even after
             * S1's own SecurityConfig was fixed to permit it.
             */
            new RouteAuthorizationRule("/api/v1/operations-managers/**", PLATFORM_STAFF),
            /*
             * Self-lookup (GET /api/v1/location-managers/me, see LocationManagerController) - a
             * Location Manager's own session needs this to learn their assigned city/zone, since
             * the general list/get endpoints below stay staff-only. Matched first (first matching
             * rule wins).
             */
            new RouteAuthorizationRule("/api/v1/location-managers/me", VERIFICATION_STAFF),
            new RouteAuthorizationRule("/api/v1/location-managers/**", PLATFORM_STAFF),
            new RouteAuthorizationRule("/api/v1/cities/**", GEOGRAPHY_READERS),
            new RouteAuthorizationRule("/api/v1/zones/**", GEOGRAPHY_READERS),

            new RouteAuthorizationRule("/api/retailers/**", RETAILER_ONBOARDING),
            new RouteAuthorizationRule("/api/fleet-owners/**", FLEET_OWNER_ONBOARDING),
            new RouteAuthorizationRule("/api/verification-documents/**", VERIFICATION_PARTICIPANTS),
            /*
             * The common submit-for-verification step (any subject type) is the submitter's own
             * action, not a reviewer action - must be matched before the general
             * /api/verification-queues/** rule below (VERIFICATION_STAFF-only, for admin CRUD
             * and the reviewer's process-result/assign), since the first matching rule wins.
             */
            new RouteAuthorizationRule("/api/verification-queues/*/submit-for-verification", VERIFICATION_PARTICIPANTS),
            /* Submitters need to read their own subject's queue status to surface a targeted
             * document-resubmission request. S2 still enforces authentication; this coarse
             * gateway rule only lets the participant roles reach that read endpoint. */
            new RouteAuthorizationRule("/api/verification-queues/subject/*", VERIFICATION_PARTICIPANTS),
            /* Work transfer between Location Managers is an Operations Manager / Super Admin action. */
            new RouteAuthorizationRule("/api/verification-queues/pending-work/*", PLATFORM_STAFF),
            new RouteAuthorizationRule("/api/verification-queues/transfer-work", PLATFORM_STAFF),
            /* The Location Manager's own zone dashboard. */
            new RouteAuthorizationRule("/api/location-dashboard/**", Set.of("LOCATION_MANAGER")),
            new RouteAuthorizationRule("/api/verification-queues/**", VERIFICATION_STAFF),

            new RouteAuthorizationRule("/api/v1/customers/**", CUSTOMER_COMMERCE),
            new RouteAuthorizationRule("/api/v1/cart/**", CUSTOMER_COMMERCE),
            new RouteAuthorizationRule("/api/v1/checkout/**", CUSTOMER_COMMERCE),
            new RouteAuthorizationRule("/api/v1/reviews/**", CATALOGUE_READERS_AND_OWNERS),
            new RouteAuthorizationRule("/api/v1/product-categories/**", CATALOGUE_READERS_AND_OWNERS),
            new RouteAuthorizationRule("/api/v1/products/**", CATALOGUE_READERS_AND_OWNERS),
            /*
             * A customer expanding a shop card (see the product-card retailer badge / shop
             * detail expander) needs these two read-only routes - matched before the general
             * /api/v1/retailers/** rule below (RETAILER_CATALOGUE_OWNERS has no CUSTOMER), same
             * "more specific rule first" pattern already used for verification-queues' submit-
             * for-verification rule above. "/api/v1/retailers/*" (single path segment) matches
             * only the bare-by-id read (PublicRetailerController.get()) - it does not match
             * "/api/v1/retailers/me/products" or ".../me/inventory" (two-plus segments), which
             * stay retailer-only under the general rule.
             */
            new RouteAuthorizationRule("/api/v1/retailers/*", CATALOGUE_READERS_AND_OWNERS),
            new RouteAuthorizationRule("/api/v1/retailers/*/rating-summary", CATALOGUE_READERS_AND_OWNERS),
            new RouteAuthorizationRule("/api/v1/retailers/**", RETAILER_CATALOGUE_OWNERS),

            new RouteAuthorizationRule("/api/orders/**", ORDER_PARTICIPANTS),
            new RouteAuthorizationRule("/api/order-items/**", ORDER_PARTICIPANTS),
            new RouteAuthorizationRule("/api/logistics-bookings/**", LOGISTICS_PARTICIPANTS),
            new RouteAuthorizationRule("/api/logistics-rates/**", LOGISTICS_RATE_PARTICIPANTS),
            new RouteAuthorizationRule("/api/trips/**", LOGISTICS_PARTICIPANTS),

            /*
             * Driver-app self-lookup (GET /api/drivers/me, see DriverController) - a DRIVER
             * token needs this to learn its own driverId/fleetOwnerId. Matched before the
             * general /api/drivers/** rule below (first matching rule wins), which stays
             * FLEET_OPERATIONS-only (drivers/vehicles/assignments management is not a driver's
             * job beyond their own record).
             */
            new RouteAuthorizationRule("/api/drivers/me", FLEET_OPERATIONS_WITH_DRIVER),
            /* Location/Operations reviewers use these single-record reads from verification
             * queue details. More-specific patterns come before the fleet-management group. */
            new RouteAuthorizationRule("/api/drivers/*", FLEET_VERIFICATION_READERS),
            new RouteAuthorizationRule("/api/vehicles/*", FLEET_VERIFICATION_READERS),
            new RouteAuthorizationRule("/api/drivers/**", FLEET_OPERATIONS),
            new RouteAuthorizationRule("/api/vehicles/**", FLEET_OPERATIONS),
            new RouteAuthorizationRule("/api/assignments/**", FLEET_OPERATIONS),
            new RouteAuthorizationRule("/api/expenses/**", FLEET_OPERATIONS_WITH_DRIVER),
            new RouteAuthorizationRule("/api/fleet/**", FLEET_OPERATIONS),

            new RouteAuthorizationRule("/api/payment-transactions/**", FINANCE_PARTICIPANTS_WITH_SUPPORT_STAFF),
            new RouteAuthorizationRule("/api/customer-invoices/**", FINANCE_PARTICIPANTS),
            new RouteAuthorizationRule("/api/customer-refunds/**", FINANCE_PARTICIPANTS_WITH_SUPPORT_STAFF),
            new RouteAuthorizationRule("/api/settlements/**", FINANCE_PARTICIPANTS),
            new RouteAuthorizationRule("/api/tax-configurations/**", PLATFORM_STAFF),
            new RouteAuthorizationRule("/api/support-tickets/**", EVERYONE_AUTHENTICATED),
            new RouteAuthorizationRule("/api/notifications/**", EVERYONE_AUTHENTICATED),
            new RouteAuthorizationRule("/api/audit-logs/**", EVERYONE_AUTHENTICATED),
            new RouteAuthorizationRule("/api/analytics/**", PLATFORM_STAFF)
    );

    private RouteAuthorizationRules() {
    }
}
