> **FINAL FIX NOTE:** This document contains historical integration observations from earlier audit passes. For the current repository state, use `docs/FINAL_FIXES.md` and `docs/ECLIPSE_MANUAL_TESTING.md` first. Where this document says an endpoint is missing or a Feign client is hardcoded, verify against the current source before relying on that statement.

# Architecture & Integration

## 1. Overall architecture

Six independently-developed Spring Boot 4.1.1 (Java 17) microservices, integrated behind one Eureka registry and one API Gateway, sharing a logical data model (34 entities across 34 SQL tables) but each running its own H2 database instance — see "Database ownership" below for why per-service H2 rather than one literal shared process.

```
                         ┌─────────────────────┐
                         │   lbos-eureka        │  (port 8761)
                         │   service registry    │
                         └──────────┬────────────┘
                                    │ register / discover
        ┌───────────────┬──────────┼──────────┬───────────────┬───────────────┐
        │               │          │          │               │               │
   lbos-platform   lbos-partner lbos-commerce lbos-order   lbos-fleet    lbos-finance
      (S1:8081)      (S2:8082)    (S3:8083)   (S4:8084)    (S5:8085)     (S6:8086)

                         ┌─────────────────────┐
                         │   lbos-gateway        │  (port 8080)
                         │   JWT validation +     │
                         │   header propagation + │
                         │   Eureka-based routing │
                         └───────────────────────┘
                                    ▲
                                    │  all external traffic
                               UI / API clients
```

## 2. The six services

| Service | Eureka name | Port | Owns |
|---|---|---|---|
| S1 Platform & Territory | `lbos-platform` | 8081 | Identity (UserAccount, JWT issuance), State, City, Zone, OperationsManager, LocationManager |
| S2 Partner Onboarding & Verification | `lbos-partner` | 8082 | Retailer, FleetOwner, VerificationQueue, VerificationDocument |
| S3 Commerce & Customer | `lbos-commerce` | 8083 | CustomerProfile, CustomerAddress, ProductCategory, Product, Wishlist, Cart, CustomerReview |
| S4 Order & Logistics | `lbos-order` | 8084 | Order, OrderItem, LogisticsBookingDetail, Trip |
| S5 Fleet Operations | `lbos-fleet` | 8085 | Vehicle, Driver, VehicleAssignment, FleetExpense |
| S6 Finance, Support & Engagement | `lbos-finance` | 8086 | PaymentTransaction, CustomerInvoice, Settlement, CustomerRefund, TaxConfiguration, SupportTicket, Notification, AuditLog |

Plus two new infrastructure modules created for this integration:

| Module | Eureka name | Port |
|---|---|---|
| Eureka Server | `lbos-eureka` | 8761 |
| API Gateway | `lbos-gateway` | 8080 |

All eight modules target **Spring Boot 4.1.1 / Spring Cloud 2025.1.2 (Oakwood) / Java 17** — standardized during this integration (see `changelog-integration.md`; S1/S2/S4 were already on this pairing, S3's parent POM was missing entirely, S5/S6 were on Boot 3.5.5/Cloud 2025.0.0).

## 3. Eureka

`eureka-server` is a plain `@EnableEurekaServer` app with self-registration disabled (it's the registry, not a client of itself) and self-preservation disabled (appropriate for a single-node dev/training registry where instances start/stop frequently — real production deployments would re-enable this). All six services and the Gateway register as clients using `eureka.client.service-url.defaultZone` (default `http://localhost:8761/eureka/`, overridable via `EUREKA_URL`).

**Verified live, all eight processes running simultaneously** (Eureka + all six services + Gateway): every service registered and `GET /eureka/apps` showed all seven application entries (`LBOS-PLATFORM`, `LBOS-PARTNER`, `LBOS-COMMERCE`, `LBOS-ORDER`, `LBOS-FLEET`, `LBOS-FINANCE`, `LBOS-GATEWAY`) simultaneously UP. This full-stack run also confirmed: a direct call to S3 (`GET /api/v1/products`) returns 200; a direct call to S5 (`GET /api/drivers`) returns 200; the same two routes through the Gateway without a token both return 401 — proving the Gateway enforces authentication even for routes the downstream service itself leaves open, i.e. it is genuinely the platform's single choke point, not just a pass-through proxy. All eight processes were then cleanly stopped by PID.

## 4. API Gateway

Spring Cloud Gateway (`spring-cloud-starter-gateway-server-webflux`), routing by explicit path predicates (not the blanket discovery-locator) to `lb://<eureka-name>` targets, so load is balanced via Eureka-registered instances rather than hardcoded hosts. Full route table is in `api-catalog.md` §2. Routes were derived directly from each service's actual controller `@RequestMapping` base paths — no path was invented.

A single `JwtAuthenticationGatewayFilter` (`GlobalFilter`, order `-1`, runs before routing) is the platform's sole authentication choke point:
- `POST /api/v1/auth/login` and `/actuator/**` are public.
- Every other request must carry `Authorization: Bearer <jwt>`; missing/invalid/expired tokens get `401` immediately, before the request reaches any downstream service.
- On success, the filter **strips any client-supplied** `X-User-Account-Id`/`X-User-Role` headers and replaces them with values derived from the validated JWT's claims, then forwards the request.

Verified live: an unauthenticated request through the Gateway to `/api/states` returns `401`; a login POST with a wrong password is correctly routed to S1 and returns S1's `401 Invalid email or password` (proving Eureka-based load-balanced routing + downstream error propagation both work end to end). A full happy-path login → authorized downstream call was verified at the unit-test level (`AuthControllerTest`, `JwtServiceTest` in S1) rather than via a second live run, since the only seeded demo user's password hash has no known plaintext (see `changelog-integration.md`).

**CORS** is configured at the Gateway level (`spring.cloud.gateway.server.webflux.globalcors` in `application.yml`), allowing `http://localhost:3000` and `http://localhost:5173` by default, overridable via `CORS_ALLOWED_ORIGINS`.

### Gateway-enforced role-based authorization (added in the frontend-hardening pass)

Beyond authentication, the Gateway is now also the platform's **sole role-based authorization enforcement point** — see `RouteAuthorizationRules.java`. Every route group defined in `application.yml` has a matching entry mapping it to the set of roles allowed to call it; `JwtAuthenticationGatewayFilter` checks the JWT's `role` claim against this table before forwarding, returning `403` on a mismatch. This is deliberately **coarse** (route-group level, not per-verb or per-resource-owner) — see `api-catalog.md`/`ui-api-mapping.md` for exactly which roles can reach which endpoints, and §11 below for what this does and doesn't guarantee. `RULES` is evaluated **first-match-wins** in declaration order, which is why a couple of routes need a more-specific rule declared *before* a broader one on the same prefix — e.g. the shop-badge pass added `/api/v1/retailers/*` and `/api/v1/retailers/*/rating-summary` (customer-readable) ahead of the pre-existing retailer-only `/api/v1/retailers/**`, the same pattern already used for verification-queues' submit-for-verification carve-out. 8 unit tests (`JwtAuthenticationGatewayFilterTest`) cover the authorization matrix directly (instantiating the real filter and exercising `isRoleAuthorizedForPath` against every role/route-group combination that matters). A live, authenticated, wrong-role-gets-403 request through a running Gateway was **NOT VERIFIED** in this pass (the full-stack live run in §3 only exercised the unauthenticated-401 path, since no usable login credentials were available at that time — see the same caveat in §4 above) — the unit-test coverage is the verification for the authorization *logic*; a live end-to-end confirmation of the same behavior through an actually-running Gateway is a good follow-up once a real login-capable account exists.

## 5. JWT / security architecture

**Before this integration, no service had real JWT.** S1 used HTTP Basic against 3 hardcoded in-memory users entirely disconnected from the `UserAccount` table; every other service was fully open. This integration implements real JWT centered on S1, per explicit instruction:

1. **Issuance (S1):** `POST /api/v1/auth/login` (`AuthController`) — looks up `UserAccount` by email, verifies the password via the existing `PasswordEncoder` (delegating/bcrypt), checks `accountStatus == ACTIVE`, and returns a signed JWT (`JwtService`, using `io.jsonwebtoken` / jjwt 0.12.6) with claims `sub` (user account UUID), `email`, `role`, `iat`, `exp`. Also stamps `lastLoginAt`.
2. **Gateway-side validation:** the Gateway independently validates the same JWT using the identical shared secret (`app.jwt.secret`, must match between S1 and the Gateway — both default to the same dev value, overridable via `JWT_SECRET` env var in both places) — no network round-trip to S1 per request.
3. **Downstream trust:** S1 itself also validates the JWT locally (`JwtAuthenticationFilter` + `SecurityConfig`, replacing the old Basic-auth-only chain) since it can be reached directly (bypassing the Gateway) during development/testing. S3 already had a pre-existing pattern of trusting an `X-User-Account-Id` header from an upstream gateway (`HeaderAuthenticatedUserProvider`) — the new Gateway now actually satisfies that contract by populating a *validated* header instead of a client-supplied one. **S2, S4, S5, S6 do not yet enforce the forwarded headers themselves** (no Spring Security dependency in S4/S5, none exercised for this in S2/S6) — they currently rely entirely on the Gateway as the enforcement point. This is a known limitation, not a silent gap: see below.
4. **Internal service-to-service calls** (Feign, bypassing the Gateway entirely) use a separate, unrelated mechanism where needed: S1's `/internal/**` endpoints require HTTP Basic against a single in-memory `lbos-service` account (`hasRole("SERVICE")`), unchanged from before this integration except that it's no longer conflated with end-user roles. S4's new `UserAccountClient` (→ S1) is the one Feign caller that needs this and is configured with a scoped Basic-auth request interceptor.

**Roles** (final six-role model): `CUSTOMER`, `RETAILER`, `LOCATION_MANAGER`, `OPERATIONS_MANAGER`, `FLEET_MANAGER`, `SUPER_ADMIN`. S1's `SecurityConfig` previously used a Spring-Security-only role called `ADMIN` that didn't match the original 5-role spec — renamed to `SUPER_ADMIN` in the prior integration pass. `FLEET_MANAGER` was added in this pass, consolidating what the UI wireframes originally split into a separate "Fleet Verification Officer" role — that verification responsibility was merged into `LOCATION_MANAGER` instead (see `application-workflow.md` §4/5 for the full rationale); `FLEET_MANAGER` is the purely operational fleet role (S5: vehicles, drivers, assignments, expenses). `UserAccount.role` is a plain `String` column with no `CHECK` constraint (confirmed against `V1__schema.sql`), so this addition needed no schema migration.

### Known limitation: fine-grained (per-resource-owner) authorization enforcement stops at the Gateway for S2/S4/S5/S6

The Gateway (§4 above) now enforces both authentication AND coarse role-based route access for every service. What it does **not** do is per-resource-ownership checks — "is this specifically YOUR order/cart/vehicle." The Gateway guarantees every request downstream carries a *trusted* `X-User-Account-Id`/`X-User-Role` pair once past it, but only S1 (role checks) and S3 (via its existing `X-User-Account-Id` header-trust pattern, e.g. "this is MY cart") actually enforce ownership using that identity today. S2, S4, S5, and S6 do not currently branch on the caller's own identity for row-level access — an authenticated RETAILER token with the right role can still read a different retailer's order by guessing/enumerating its ID, for example. Adding per-service ownership checks to all four is flagged as a recommended follow-up, not attempted here, to avoid a much larger blast radius of changes across services this integration was told to preserve as much as possible. See `frontend-integration-guide.md` §4 for what this means for frontend development in the meantime.

## 6. Feign / OpenFeign

Every inter-service call goes through Spring Cloud OpenFeign, targeting Eureka service names (`lb://` implied by using the plain Eureka app name in `@FeignClient(name = "...")`) rather than hardcoded URLs — this integration replaced S5's and S6's previously hardcoded `http://localhost:PORT` Feign URLs with Eureka-name-based discovery (S6's `IdentityServiceClient` was left on its explicit `external-services.identity-service-url` property since it's a still-unresolved boundary mismatch, see below). No JPA repository in any service reaches into another service's tables — every cross-service reference is either a scalar ID or a Feign call. Full dependency graph is in `api-catalog.md` §3.

## 7. Database ownership

The instruction calls for "one shared database, deployment simplification, but maintain logical ownership." In practice, each service keeps its **own H2 instance** (in-memory for S1/S2/S3/S4/S5/S6 after this integration — S5 and S6 previously used file-based H2 at machine-specific absolute paths, switched to in-memory for portability). A single literal shared H2 process across six separately-started JVMs isn't how H2's embedded mode works (it's per-process unless run in TCP server mode, which none of these services were configured for); running one shared **schema** to match the supplied `database.sql.txt` while keeping repository access scoped to each service's own owned tables achieves the same *logical* isolation the instruction asks for, without requiring a rearchitected shared-server H2 setup that no original team member built. This is a pragmatic interpretation, called out explicitly rather than silently assumed — running a real shared Postgres instance in production would remove the ambiguity entirely (S1 already ships a `flyway-database-postgresql` dependency and an `application-postgres.properties` profile for this).

## 8. Error handling

Each service keeps its own pre-existing `@RestControllerAdvice`/`GlobalExceptionHandler` and exception hierarchy — these were not unified into one shared library, since doing so would touch every controller across all six services for a "consistency" gain not requested. Response envelope shapes differ by service (S3 uses `ApiResponse<T>`/`ErrorResponse`; S1 uses `ApiErrorResponse`; S6 returns raw entities with a simple `{timestamp,status,message}` error shape; S2/S4/S5 vary similarly) — documented as a known inconsistency in `sql-jpa-discrepancy-report.md` rather than unified, per "preserve existing business logic wherever possible."

## 9. Scheduled jobs

`RetailerResponseTimeoutJob` (S4) is **the platform's first `@Scheduled` job** (added in the order-placement-and-fulfilment pass; `@EnableScheduling` was likewise newly added to `LbosApplication`). It polls every 60 seconds (`fixedDelay = 60_000` — deliberately `fixedDelay` not `fixedRate`, so a slow downstream notification call can't cause overlapping runs to stack up) for orders that have sat in `WAITING_FOR_RETAILER` for more than 10 minutes, flips them to `SHOP_UNAVAILABLE`, and best-effort-notifies the customer. See `application-workflow.md` §7 (S4) for the full retail order-status graph this feeds into.

## 10. Startup order

1. `eureka-server` (must be up first; other services retry registration on failure so a slightly different order won't hard-fail, but nothing appears in the registry until Eureka is reachable)
2. S1 → S2 → S3 → S5 → S6 → S4 (S4 depends on S1/S3/S5 being reachable for its Feign calls to succeed on first use, though Feign failures don't crash the caller — they surface as request-time errors)
3. `api-gateway` last (routes will 503 for any service not yet registered, self-healing once that service's Eureka lease renews)

Full step-by-step commands are in `running-the-project.md`.

## 11. Known limitations (full list)

1. **Driver ownership anomaly** (S2 vs S5) — see `api-catalog.md` §1.
2. **S6's `IdentityServiceClient` conflates two owning services** — it calls both `getUserAccount` (S1-owned) and `getCustomerProfile` (S3-owned) through one Feign client pointed at one URL. Not restructured in this pass; currently pointed at S1, so `getCustomerProfile` calls would hit the wrong service if actually invoked at runtime — flagged, not silently patched.
3. **Authorization enforcement stops at the Gateway** for S2/S4/S5/S6 — see §5.
4. **Per-service response/error envelope inconsistency** — see §8.
5. **No production-grade schema migration story for S3/S4/S5/S6** — only S1 uses Flyway; the rest rely on Hibernate `ddl-auto` (update/create-drop). Fine for H2 dev/training use, not production-ready.
6. **Full six-service simultaneous Eureka registration** was not live-verified end-to-end in this session (see §3) — individually confirmed only.
7. **JWT secret is a shared static dev value** by default across S1 and the Gateway — must be overridden via `JWT_SECRET` in any real deployment; there's no key rotation or per-service key story.
