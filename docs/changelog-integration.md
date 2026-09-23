# Integration Changelog

Every significant modification made while integrating the six pre-existing microservices, with WHAT changed, WHY, and the impact. Entries are grouped by service. Trivial mechanical renames (port numbers, `spring.application.name`) are listed once per service rather than line-by-line.

## Cross-cutting

| File(s) | Original | Change | Reason | Impact |
|---|---|---|---|---|
| All 6 services' `pom.xml` | Mixed Spring Boot 4.1.1 (S1/S2/S4) and 3.5.5 (S5/S6); S3's parent POM (`com.lbos:lbos-commerce-platform`) missing entirely from the delivered files | Standardized every service, plus new `eureka-server`/`api-gateway` modules, on Spring Boot **4.1.1** / Spring Cloud **2025.1.2** (verified compatible via Spring Initializr metadata and public release notes) | Explicit instruction to remove version fragmentation; S3 literally could not build without a parent | All 6 services + 2 new modules now build against one dependency stack |
| S3's `pom.xml` | `<parent>com.lbos:lbos-commerce-platform:1.0.0-SNAPSHOT</parent>` — not present anywhere in the supplied files | Rewrote as a standalone `spring-boot-starter-parent` POM, preserving every dependency S3's own pom.xml declared | Explicit instruction: "if the missing parent is not available, make S3 standalone" | S3 now compiles; no business logic touched |
| S5, S6 `pom.xml` | `spring-boot-starter-web` (Boot 3.x artifact name) | Renamed to `spring-boot-starter-webmvc` (Boot 4.1.1's actual artifact name, confirmed against S1/S2's already-working poms and Maven Central) | Boot 4.1.1 split several starters into finer-grained artifacts; the old name doesn't exist in this Boot line | Required for compilation |
| S1, S3, S4, S5, S6 `pom.xml` | `spring-boot-starter-test` only (or missing split test starters) | Added `spring-boot-starter-webmvc-test` / `spring-boot-starter-data-jpa-test` where MockMvc/`@DataJpaTest` were used | Boot 4.1.1 moved `AutoConfigureMockMvc`/`WebMvcTest`/`DataJpaTest` into separate test-starter artifacts (new packages `org.springframework.boot.webmvc.test.autoconfigure.*`, `org.springframework.boot.data.jpa.test.autoconfigure.*`) | Fixes compile errors on existing test suites, no test behavior changed |
| S1 `pom.xml` | `org.flywaydb:flyway-core` direct dependency | Replaced with `org.springframework.boot:spring-boot-starter-flyway` | Boot 4.1.1 requires the new Flyway starter for `FlywayAutoConfiguration` to even be considered — with just `flyway-core` on the classpath, Flyway silently never ran (confirmed: zero Flyway log output, zero Flyway classes on the resolved classpath) and Hibernate's schema `validate` then failed with "missing table" once the real bug surfaced | S1's Flyway-managed schema now actually runs before Hibernate validates — this had been silently broken (never executed, since no one had run the test suite before this integration) |
| S1 `application-test.properties`, one test file | `import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;` | Updated to `org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc` | Same Boot 4.1.1 package-move as above | Compile fix only |
| S2, S3, S4, S5, S6 `application.properties`/`.yml` | Various ports (mostly 8080, one 8083) and inconsistent `spring.application.name` (`retailer-service`, `lbos` used by *both* S1 and S4, `commerce-customer-service`, `lbos-finance-integration-service`) | Standardized: Gateway 8080, S1 8081, S2 8082, S3 8083, S4 8084, S5 8085, S6 8086, Eureka 8761; names `lbos-platform`, `lbos-partner`, `lbos-commerce`, `lbos-order`, `lbos-fleet`, `lbos-finance`, `lbos-gateway`, `lbos-eureka` | Explicit port/name scheme in the instructions; S1 and S4 sharing the name `lbos` would have collided in Eureka | Every service now has a unique address; Feign `@FeignClient(name=...)` values across S3/S6 updated to match |
| S1, S3, S4, S5, S6 `pom.xml`/config | Missing or partial Eureka client wiring (S1, S4 had none at all; S5 had none; S6 had none) | Added `spring-cloud-starter-netflix-eureka-client` + `eureka.client.service-url.defaultZone` config to all | Explicit "all six services must register as Eureka clients" requirement | All 6 now declare Eureka registration; S1 and the Gateway verified live |

## S1 — Platform & Territory

| File(s) | Original | Change | Reason | Impact |
|---|---|---|---|---|
| `service/UserAccountService.java` | `createUserAccount` called a nonexistent method `normalizeEmail(...)` | Fixed to call the existing `normalizeAndValidateEmail(...)` | Pre-existing compile error, unrelated to integration work — the method was simply never renamed everywhere it was called | S1 could not compile at all before this one-line fix |
| `db/migration/V1__schema.sql` | `create unique index uk_city_state_name on city(state_id, lower(city_name));` | Changed to a plain (non-expression) unique index on `(state_id, city_name)` | H2 (even in PostgreSQL-compatibility mode) does not support function-based index expressions the way this SQL was written; the migration failed at startup with a real SQL syntax error the moment Flyway was actually able to run (see above) | Case-insensitive uniqueness is still enforced at the service layer (`existsByStateIdAndCityNameIgnoreCase`, already present); the DB-level constraint is now case-sensitive only — documented, not silently dropped |
| `service/StateService.java` | `normalizeCountryCode` trimmed/uppercased with no format validation | Added a 2-letter ISO 3166-1 alpha-2 format check, throwing `ValidationException` for malformed codes | The service's *own* pre-existing test (`StateServiceTest.getByCountryRejectsInvalidCode`) already asserted this behavior — the implementation just never enforced it. Treated as a genuine missing-validation bug, not a new feature invented for this integration | Matches the SQL schema's `country_code char(2)`; aligns implementation with the developer's own documented test intent |
| `config/SecurityConfig.java` | HTTP Basic only, backed by 3 hardcoded in-memory users (`admin`/`manager`/`lbos-service`) completely disconnected from the `UserAccount` table; role `ADMIN` used for admin-only routes (not one of the 5 spec roles) | Replaced end-user auth with real JWT (`JwtAuthenticationFilter` + `AuthController`/`JwtService`); kept HTTP Basic *only* for `/internal/**` via the retained `lbos-service` account; renamed the admin-only role check from `ADMIN` to `SUPER_ADMIN` | Explicit instruction: implement real JWT centered on S1, using the UserAccount table; do not invent roles beyond the specified 5 | Login now authenticates real `UserAccount` rows; `/internal/**` behavior for service-to-service calls unchanged |
| new: `security/JwtProperties.java`, `security/JwtService.java`, `security/JwtAuthenticationFilter.java` | — | Added | JWT issuance/validation implementation | New files, no existing code touched |
| new: `dto/LoginRequestDto.java`, `dto/LoginResponseDto.java`, `controller/AuthController.java` | — | Added | Login endpoint | New files |
| new: `exception/InvalidCredentialsException.java` + handler in `GlobalExceptionHandler` | — | Added, mapped to 401 | Needed a 401-appropriate exception type; none of the existing 5 exception types fit "wrong password" | New exception type, existing ones untouched |
| new: `controller/InternalUserAccountController.java` | — | Added `GET /internal/v1/user-accounts/{id}`, `hasRole("SERVICE")` | S4's `Trip.createdByAccountId`/`assignedByAccountId` validation needs this and no equivalent internal endpoint existed | New read-only endpoint, reuses existing `UserAccountService.getUserAccountById` |
| `test/.../SecurityIntegrationTest.java` | 4 `@WithMockUser` MVC tests relying on Boot's auto-wired `@AutoConfigureMockMvc` security integration | Rewrote to explicitly build `MockMvc` via `MockMvcBuilders.webAppContextSetup(...).apply(springSecurity())` | Boot 4.1.1's automatic Spring-Security-Test MockMvc wiring was not activating (root cause not fully isolated within budget — confirmed independent of this integration's own filter changes by testing with the filter removed and still failing); explicit wiring is a standard, robust pattern regardless of the auto-config quirk | Test intent unchanged; all 4 assertions preserved (one UUID literal changed from a seeded existing account to a genuinely nonexistent one — see below) |
| same file | `serviceUserCanCallInternalResolveEndpoint` queried `userAccountId=30000000-...-001` expecting 404 | Changed to a UUID not present in seed data | Once Flyway actually started running (see above), that UUID turned out to be a real seeded `operations_manager` row, so the endpoint correctly returned 200 — the test's expectation of "not found" was written without ever having run against real seed data | Test now asserts what it always meant to (a real not-found case) |
| `test/.../service/CityServiceTest.java` | `activateRequiresActiveState` stubbed `findById` but not `save`, causing an NPE inside `toResponse(null)` | Added the missing `save` stub | Test bug (missing Mockito stub), not a service bug | Test now passes, no production code touched |
| `test/.../service/LocationManagerServiceImplTest.java` | Two tests stubbed `existsByZoneIdAndAssignmentStatus(...)` (2-arg) but the real `activateAssignment` code path calls `existsByZoneIdAndAssignmentStatusAndIdNot(...)` (3-arg, excluding self) | Fixed both stubs to the correct 3-arg method | Test bug (wrong overload stubbed) | Tests now correctly verify the "occupied zone" rejection and the "activate succeeds" path |
| new: `test/.../security/JwtServiceTest.java`, `test/.../controller/AuthControllerTest.java` | — | Added (7 tests) | Meaningful test coverage for the new JWT/login code | New tests only |

**S1 final state: `BUILD SUCCESS`, 126/126 tests passing (119 pre-existing + 7 new).**

## S3 — Commerce & Customer

| File(s) | Original | Change | Reason | Impact |
|---|---|---|---|---|
| `client/FinanceClient.java`, `OrderLogisticsClient.java`, `PartnerVerificationClient.java`, `PlatformTerritoryClient.java` | `@FeignClient(name="finance-support-engagement-service")` etc. (verbose, non-standardized names) | Renamed to `lbos-finance`, `lbos-order`, `lbos-partner`, `lbos-platform` | Must match each provider's actual `spring.application.name` for Eureka-based discovery to resolve | Feign target names now match reality; no request/response contract changed |
| `test/.../service/ReviewServiceImplTest.java` | `assertEquals(1, ...rating())` where `rating()` returns `short` | Cast literals to `(short)` | Boot 4.1.1's bundled JUnit introduces a `assertEquals(Integer, int)` overload that makes the un-cast call ambiguous at compile time | Compile fix only |
| `test/.../service/ProductDiscoveryServiceImplTest.java` | Test built a `Product` with no `ProductCategory` set, then the mapper dereferenced `product.getCategory().getId()` | Added a minimal `ProductCategory` to the test fixture | `Product.category` is `optional=false` in real usage; the test's fixture was unrealistic (this NPE was previously undiscovered because the test suite had never actually been executed) | Test now reflects a realistic entity state |

**S3 final state: `BUILD SUCCESS`, 99/99 tests passing.**

## S2 — Partner Onboarding & Verification

No source changes were required — S2 was already on Spring Boot 4.1.1 / Spring Cloud 2025.1.2 and built/tested cleanly (92/92 tests) on first attempt. Only its `spring.application.name` and `server.port` were updated (see cross-cutting table).

**S2 final state: `BUILD SUCCESS`, 92/92 tests passing (unchanged, pre-existing suite).**

## S5 — Fleet Operations

| File(s) | Original | Change | Reason | Impact |
|---|---|---|---|---|
| `pom.xml` | Boot 3.5.5, Spring Cloud 2025.0.0, `spring-boot-starter-web`, no Eureka client | Upgraded to Boot 4.1.1/Cloud 2025.1.2, renamed to `spring-boot-starter-webmvc`, added `spring-cloud-starter-netflix-eureka-client` | Version standardization, Eureka requirement | Compiles and registers with Eureka |
| `application.properties` | `spring.mvc.view.prefix/suffix` (dead JSP config, no JSP files anywhere in the project — confirmed pure REST API), hardcoded `jdbc:h2:file:C:/data/vehicle` (machine-specific absolute path), `spring.application.name=lbos`, no port | Removed dead JSP config; switched to in-memory H2 (`jdbc:h2:mem:fleetdb`); renamed to `lbos-fleet`; set port 8085; added Eureka client config | Portability (a hardcoded `C:/` path breaks on any other machine/OS), naming/port standardization, dead config cleanup | No behavior change other than DB no longer persisting to disk between restarts (consistent with every other service's dev H2 setup) |

| new: `test/.../service/{DriverServiceImplTest,VehicleServiceImplTest,VehicleAssignmentServiceImplTest,FleetExpenseServiceImplTest}.java` | Only test was an empty `contextLoads()` | Added 63 real Mockito-based unit tests (mocking repositories + `S2PartnerClient`) covering creation happy-paths, S2-validation rejection cases, duplicate/eligibility checks, status transitions, and the approve/reject-with-self-approval-block workflow | Meaningful coverage requirement | New tests only, no production code changed |

**S5 final state: `BUILD SUCCESS`, 64/64 tests passing** (1 pre-existing `contextLoads` + 63 new — independently re-verified with a clean `mvnw test` run).

## S6 — Finance, Support & Engagement

| File(s) | Original | Change | Reason | Impact |
|---|---|---|---|---|
| `pom.xml` | Boot 3.5.5, Spring Cloud 2025.0.0, `spring-boot-starter-web`, no Eureka client | Upgraded to Boot 4.1.1/Cloud 2025.1.2, renamed to `spring-boot-starter-webmvc`, added `spring-cloud-starter-netflix-eureka-client` | Version standardization, Eureka requirement | Compiles and registers with Eureka |
| `application.properties` | `jdbc:h2:file:./data/lbos_finance_integration_db`, `spring.application.name=lbos-finance-integration-service`, port 8080, `external-services.*-url` pointing at guessed/placeholder ports | Switched to in-memory H2; renamed to `lbos-finance`; port 8086; corrected `catalog-service-url`→S3:8083, `order-service-url`/`logistics-service-url`→S4:8084, `identity-service-url`/`operations-service-url`→S1:8081; added Eureka client config | Naming/port standardization; the placeholder external-service ports didn't match any real service | Feign calls now target the correct actual services (except the `IdentityServiceClient`/CustomerProfile boundary mismatch, flagged not fixed — see `architecture.md`) |
| `integration/client/CatalogServiceClient.java`, `LogisticsServiceClient.java`, `OperationsServiceClient.java`, `OrderServiceClient.java` | `@FeignClient(name="catalog-service", url="${external-services.catalog-service-url}")` style (hardcoded URL, not Eureka discovery) | Switched to Eureka-name-based discovery (`@FeignClient(name="lbos-commerce")` etc.); added a distinct `contextId` to `LogisticsServiceClient` since it shares the `lbos-order` name with `OrderServiceClient` | Explicit instruction to replace hardcoded URLs with Eureka discovery where appropriate | No request/response contract changed, only how the target host is resolved |
| `integration/client/IdentityServiceClient.java` | hardcoded URL | **Left unchanged** (still `url = "${external-services.identity-service-url}"`, now pointed at S1) | This client conflates two different owning services (S1's UserAccount and S3's CustomerProfile) behind one interface — switching it to a single Eureka name would silently paper over a real boundary defect rather than fix it | Flagged as a known limitation, not silently resolved |

| new: `test/.../service/{PaymentTransactionServiceImplTest,CustomerInvoiceServiceImplTest,CustomerRefundServiceImplTest,SettlementServiceImplTest,SupportTicketServiceImplTest,NotificationServiceImplTest,AuditLogServiceImplTest,TaxConfigurationServiceImplTest}.java` | Only test was an empty `contextLoads()` | Added 78 real Mockito-based unit tests (one class per service, mocking the repository and only the Feign clients each code path actually calls) covering creation happy-paths and real business-rule rejections (order-already-paid, order-not-delivered, payment-not-SUCCESS, inactive-account, inactive-state, etc.), not-found cases, the update-re-validates-and-persists behavior specific to this codebase, and delete | Meaningful coverage requirement | New tests only; confirmed two documented behavioral quirks by testing rather than assuming them: `AuditLogServiceImpl` genuinely never checks account *status* (only existence) when `userAccountId` is present, and `TaxConfigurationServiceImpl` validates a boolean `active` flag (not a status string) |

**S6 final state: `BUILD SUCCESS`, 79/79 tests passing** (1 pre-existing `contextLoads` + 78 new).

## S4 — Order & Logistics

S4 did not compile at all before this integration (7 entity classes from other services — `CustomerProfile`, `Retailer`, `Product`, `Vehicle`, `Driver`, `FleetOwner`, `UserAccount` — were referenced as local JPA relationships despite not existing anywhere in S4's own codebase). This was the highest-priority fix and was delegated to a dedicated background agent with a precise blueprint (scalar-ID replacement plan per field, exact Feign contracts for the 3 authorized integrations — S4→S3, S4→S5, S4→S1 — and instructions to add real tests).

| File(s) | Original | Change | Reason | Impact |
|---|---|---|---|---|
| `entity/Order.java`, `OrderItem.java`, `LogisticsBookingDetail.java`, `Trip.java` | `@ManyToOne`/`@OneToOne` relationships to 7 nonexistent foreign-service classes | Replaced with plain scalar `@Column` FK fields (`UUID`/`Long` matching the SQL schema); the genuine same-service relationships (`OrderItem.order`, `LogisticsBookingDetail.order` via `@MapsId`, `Trip.order`) were left as real JPA associations | Compile-blocking; matches the scalar-reference pattern already used throughout S2/S3/S5 for cross-service FKs | S4 now compiles |
| new: `client/ProductClient.java` (→S3), `client/VehicleClient.java`, `client/DriverClient.java` (→S5, distinct `contextId`s since both target `lbos-fleet`), `client/UserAccountClient.java` (→S1) + `client/ServiceBasicAuthFeignConfig.java` + local mirror DTOs under `client/dto/` | — | Added | The 3 authorized Feign integrations (S4→S3, S4→S5, S4→S1), scoped exactly to what `OrderItemService`/`LogisticsBookingDetailService`/`TripService` actually need | New files only; no foreign-service classes imported anywhere in S4 |
| `dto/TripDto.java`, `dto/LogisticsBookingDetailDto.java` | Several ID fields typed `Long` | Changed to `UUID` | The real schema and `TripRepository`'s pre-existing derived-query method signatures both expect UUID — the DTOs had never been exercised against real data before | Corrects a latent type mismatch, not a new decision |
| `service/OrderService.java` | Used `EntityManager.getReference`/`find` for the (nonexistent) `CustomerProfile` join | Stores `customerProfileId` directly; `EntityManager` dependency removed | Matches the scalar-FK entity change | Preserves original create/update/delete behavior |
| `service/OrderItemService.java` | Snapshotted `sku`/`name`/`price` from a local `Product` join | Snapshots from `ProductClient.getProduct(productId)`; a caller-supplied price is still honored if present, catalogue price used only as fallback | Preserves the original snapshot-at-creation-time business rule | Same output shape, sourced remotely now |
| `service/LogisticsBookingDetailService.java` | Read `vehicle.getVehicleType()` off a local join for its cost-estimation engine | Reads `VehicleSummary.vehicleType()` via `VehicleClient` | The cost engine's vehicle-type surcharge logic genuinely needs this field | Same cost formula, sourced remotely |
| `service/TripService.java` | Read vehicle/driver/fleet-owner/user-account fields off local joins for its status-transition and eligibility validation | Reads the equivalent fields off `VehicleClient`/`DriverClient`/`UserAccountClient` responses; fleet-owner *matching* is still a pure scalar comparison (vehicle's `fleetOwnerId` vs driver's vs the Trip's own) with no S2 call needed | Preserves every existing validation rule (active status, license expiry, fleet-owner match, double-booking prevention, state-machine transitions) | Same rules, sourced remotely |
| `repository/TripRepository.java` | `existsByVehicle_IdAndTripStatusIn(...)`, `existsByDriver_Id...` (nested-property derived-query syntax) | Flattened to `existsByVehicleIdAndTripStatusIn(...)` / `existsByDriverId...` (kept `existsByOrder_Id` as-is, since `Trip.order` is still a real relationship to S4's own `Order` entity) | `Trip.vehicleId`/`driverId` are now flat scalar columns, not traversable relationship properties | Method names now match the actual field shape |
| `exception/GlobalExceptionHandler.java` | No handler for `IllegalArgumentException` (thrown throughout `TripService`/`LogisticsBookingDetailService` for business-rule violations) | Added, mapped to 400 | These were previously surfacing as unhandled 500s | Business-rule violations now return proper 4xx |
| `LbosApplication.java` | No `@EnableFeignClients` | Added | Required for the new Feign clients to be picked up | — |
| `application.properties` | `spring.application.name=lbos`, no port/Eureka/security config | Set to `lbos-order`, port 8084, added Eureka client config and `app.security.service.password` (must match S1's, used by `UserAccountClient`'s Basic-auth interceptor) | Naming/port standardization; S1-internal-endpoint auth | — |
| new: `test/.../service/{OrderServiceTest,OrderItemServiceTest,LogisticsBookingDetailServiceTest,TripServiceTest}.java` | Only test was an empty `contextLoads()` | Added 89 real Mockito-based unit tests covering creation happy-paths, not-found cases, and the real business rules (trip state machine, vehicle/driver eligibility, fleet-owner matching, cost calculation, order-type/cancelled-order guards) | Meaningful coverage requirement | New tests only |
| `mvnw`/`mvnw.cmd`/`.mvn/` | Did not exist in the delivered S4 folder | Copied from S1 (generic Maven wrapper, no project-specific content) | S4 had no way to build without a wrapper or a system-installed Maven | Build tooling only |

**S4 final state: `BUILD SUCCESS` (clean `compile` and `test` both verified from scratch by the implementing agent), 90/90 tests passing** (TripServiceTest 45, LogisticsBookingDetailServiceTest 24, OrderServiceTest 11, OrderItemServiceTest 9, LbosApplicationTests 1).

**Flagged, not fixed:** `Order.updatedDatetime` maps to a column named `updated_datetime`, but the master schema's `orders` table calls this column `updated_at`. This is masked today because every service relies on Hibernate-driven/implicit schema for its own H2 instance (no service validates its DDL against `database.sql.txt` directly), but it would break immediately against a real shared Postgres schema created from the master SQL file. See `sql-jpa-discrepancy-report.md`.

**Found and fixed after the agent's own build/test pass, via a live startup smoke test (mocked unit tests couldn't catch this — it's a real-database DDL problem):** `Order.statusHistoryJson`, `Order.orderTrackingJson`, and `LogisticsBookingDetail.bookingLocationsJson` all declared `@Column(..., columnDefinition = "jsonb")` — a literal Postgres-only type keyword. Starting S4 standalone against its real (implicit, auto-configured) in-memory H2 database showed Hibernate's schema-generation DDL failing with `Unknown data type: "JSONB"` for the `orders` and `logistics_booking_detail` tables, which — because Boot logs DDL generation failures as warnings, not fatal startup errors — meant **the app appeared to start successfully while those two tables silently didn't exist**, a serious runtime bug invisible to any Mockito-mocked test. Fixed by removing the literal `columnDefinition = "jsonb"` from all three fields and relying on Hibernate 6's dialect-aware `@JdbcTypeCode(SqlTypes.JSON)` (already present on the `LogisticsBookingDetail` field, added to both `Order` fields) to pick an appropriate native column type per database. Re-verified live: S4 now starts with zero DDL errors and all 4 tables create successfully; the full 90-test suite still passes unchanged.

## New infrastructure modules

| Module | What | Why |
|---|---|---|
| `eureka-server/` | New Maven module, `@EnableEurekaServer`, port 8761 | Required service registry, didn't exist |
| `api-gateway/` | New Maven module, Spring Cloud Gateway (WebFlux), port 8080, JWT validation filter, Eureka-discovery routing to all 6 services | Required single entry point + auth choke point, didn't exist |

Both verified to compile, start, and (for Eureka+S1+Gateway) interoperate live in this session — see `architecture.md` §3–4.

---

# Session 2 — Repository normalization, six-role model, frontend-hardening pass

Everything below happened in a second pass, on top of the fully-integrated state above, reconciling the backend against the supplied UI wireframes (`aroundu_New.zip`) and the two UI-derived reference documents (`AroundU_Full_Application_Workflow.md`, `AroundU_REST_API_and_Feign_Master_List.md`).

## Repository normalization

| Before | After | Reason |
|---|---|---|
| `S1-platform & teritory/lbos-combined/` | `S1-platform-territory/` | Flatten inconsistent nesting depth (up to 4 levels deep in some services) to exactly `<module>/pom.xml` + `<module>/src/` everywhere |
| `S2-Partner-onboarding-&-Verification/lbos/lbos/` | `S2-partner-verification/` | Same |
| `S3-commerce-customer/commerce-customer-service/commerce-customer-service/` | `S3-commerce-customer/` | Same |
| `S4-order-logistics/lbos - order & logistics/lbos/lbos/` | `S4-order-logistics/` | Same |
| `S5-fleet-operations/fleetoperation/` | `S5-fleet-operations/` | Same |
| `S6-Payment_Settlement_Audit_Notification_CustomerInvoice/lbos-finance-integration-service/` | `S6-finance-support/` | Same |
| `database.sql.txt` | `database.sql` | Match the required final naming |

New top-level directories: `scripts/` (PowerShell automation), `api-tests/` (manual test cases). All eight modules (six services + `eureka-server` + `api-gateway`) were individually recompiled and full-test-suite-verified from their new locations (`./mvnw clean test`, all 8 exit 0) — see `testing.md`.

**One incident during the move, caught and recovered, worth recording**: the first attempt to relocate S1 (a plain `mv` of the source directory into place, followed by removing the old nested path) resulted in an empty destination directory — the source content did not survive the move (suspected OneDrive sync interaction on this machine, since the repository lives under a synced `OneDrive\Documents` path). This was caught immediately by verifying the new directory's contents before deleting the old one for every *subsequent* service (the remaining five were moved via `cp` + verify-diff + delete-source instead of a blind `mv`), and S1 itself was recovered cleanly from the git commit made at the end of the first integration session (`git checkout HEAD -- "S1-platform & teritory"`), then re-copied using the same verify-before-delete procedure. No data was actually lost; this is recorded here as a reminder that the verify-before-delete discipline mattered.

## Six-role model

| Before | After |
|---|---|
| `CUSTOMER`, `RETAILER`, `LOCATION_MANAGER`, `OPERATIONS_MANAGER`, `SUPER_ADMIN` | `CUSTOMER`, `RETAILER`, `LOCATION_MANAGER`, `OPERATIONS_MANAGER`, `FLEET_MANAGER`, `SUPER_ADMIN` |

`FLEET_MANAGER` added as a new, purely operational role (S5: vehicles/drivers/assignments/expenses). The UI wireframes' separate "Fleet Verification Officer" workspace was **merged into `LOCATION_MANAGER`** rather than kept as its own role, per explicit instruction — `LOCATION_MANAGER` now covers retailer verification, fleet-owner verification, driver verification (indirectly, via S5's existing S2 eligibility check), and location/geography management.

No schema/entity change was needed: `UserAccount.role` is a plain `varchar(50)` column with no `CHECK` constraint (confirmed against `V1__schema.sql`), so a sixth value fits without migration. S1's own hardening-pass agent independently confirmed `SecurityConfig` needs no FLEET_MANAGER-specific rule (S1 owns no fleet-related endpoints).

## Gateway: role-based authorization (new capability)

| File(s) | Change | Reason |
|---|---|---|
| new: `api-gateway/.../security/RouteAuthorizationRule.java`, `RouteAuthorizationRules.java` | A route-group → allowed-roles table covering every route defined in the Gateway's own `application.yml`, keyed off Ant-style path patterns | The Gateway previously only authenticated (validated the JWT); it now also authorizes (checks the token's role against the requested route), since no other service in the system enforces roles consistently |
| `JwtAuthenticationGatewayFilter.java` | Wired in the rule table; returns `403` on a role mismatch, `401` on missing/invalid auth as before | Same |
| Bug found and fixed during this work | `AntPathMatcher` (used for the in-Gateway authorization check) does not match a bare collection path like `/api/states` against a `/**`-suffixed pattern the way Spring Cloud Gateway's own `PathPattern`-based routing does — an initial version of the rule table silently fail-opened (allowed) any bare-collection-path request that should have been role-restricted. Fixed by adding an explicit bare-path-prefix check alongside the `AntPathMatcher` match. Caught by a genuinely failing unit test (`fleetManagerCanReachFleetOperationsRoutesButNotAdminRoutes` initially failed as written), not discovered by inspection — a reminder that this class of matcher-library mismatch is easy to miss. |
| Also found and fixed | One rule pattern (`/api/v1/user-accounts/**`) didn't match S1's real route (`/api/user-accounts/**`, no `/v1/`) — same fail-open symptom, caught by the same test, fixed by cross-checking every rule pattern against the Gateway's actual `application.yml` route table mechanically (`grep`+`sort` diff) rather than trusting hand-written patterns. |
| new: `application.yml` — `spring.cloud.gateway.server.webflux.globalcors` | CORS configuration (allowed origins via `CORS_ALLOWED_ORIGINS`, methods, credentials) | Explicit requirement for frontend integration; didn't exist before |
| new: `application.yml` — `s1-users-me` route | `Path=/api/v1/users/me` → `lbos-platform` | New S1 endpoint (see below) needed a route |
| new: `test/.../security/JwtAuthenticationGatewayFilterTest.java` | 8 tests covering the authorization matrix across all six roles | Meaningful coverage requirement |
| `pom.xml` | Added JaCoCo 0.8.13 | Coverage requirement |

## S1: new `/me` endpoint and account-status patch

| File(s) | Change | Reason |
|---|---|---|
| new: `controller/CurrentUserController.java` (`GET /api/v1/users/me`) | Resolves the caller's own profile from the JWT-derived `Authentication.getName()` — never from a client-supplied id | Explicit requirement: "for `/me` endpoints use authenticated identity," and every role needs a way to resolve "who am I" after login without needing `SUPER_ADMIN` access to the general `/api/user-accounts/{id}` endpoint |
| new: `exception/MissingAuthenticatedUserException.java` + handler (401) | — | Needed a 401-appropriate exception for the missing/malformed-identity case; none of the existing types fit |
| `controller/UserAccountController.java`, `service/UserAccountService.java` | Added `PATCH /api/user-accounts/{id}/status` | Small, well-supported gap (existing `accountStatus` field, no endpoint to patch it directly before this) |
| new: `test/.../controller/CurrentUserControllerTest.java` (3 tests), 2 new tests in `UserAccountServiceTest.java` | — | Coverage for the above |

**S1 hardening-pass agent additionally**: added JaCoCo 0.8.13 (83.86% line / 80.81% branch / 83.93% instruction, real numbers from the generated report), found production code already had zero single-letter identifiers (one 2-character `ex`→`invalidTokenException` rename for consistency), confirmed the role-model check above. Full suite after all Session 2 S1 changes: **131/131**.

## Per-service hardening (JaCoCo + code-quality pass + one well-supported API gap each), delegated to parallel background agents, each scoped to one service directory

### S2 — Partner Verification

| Change | Detail |
|---|---|
| JaCoCo 0.8.13 | 72.0% line / 20.8% branch / 66.9% instruction (real) |
| New endpoint | `PATCH /api/verification-queues/{id}/assign` — sets the existing but previously-unused `reviewedByAccountId` field before a decision is made, using the existing `VerificationQueueNotFoundException`/DTO conventions |
| Identifier pass | 2 catch-variable renames (`e` → `locationManagerDispatchFailure`, in the two silently-swallowed Feign-failure catch blocks — the swallowing itself was left as a separately-flagged pre-existing issue, not fixed here since logging it properly was judged out of this task's scope) |
| Tests | 92 → 96 |

### S3 — Commerce & Customer

| Change | Detail |
|---|---|
| JaCoCo 0.8.13 | 63.87% instruction / 48.91% branch (line-coverage figure is not meaningful for this module — see `testing.md` note on its one-class-per-source-line formatting) |
| New endpoint | `GET /api/v1/products/{id}/details` — additive, returns `{product, ratingSummary}` combining the existing `ProductResponse` with the existing rating-summary computation, so a product-details screen needs one call instead of two. The original `GET /api/v1/products/{id}` is unchanged. |
| Identifier pass | 99 single-letter locals/lambda-params/catch-vars renamed across 15 files (single-letter *method parameters* on public signatures were deliberately left alone, per the "don't do a broader refactor" instruction) |
| Tests | 99 → 103 |

### S4 — Order & Logistics

| Change | Detail |
|---|---|
| JaCoCo 0.8.13 | 90.9% line / 76.7% branch / 87.3% instruction (final, after the review-eligibility addition below) |
| New endpoints | `GET /api/orders/{id}/tracking` (exposes existing `orderTrackingJson`+status fields); `POST /api/trips/{id}/pickup/confirm` and `POST /api/trips/{id}/complete` (real state transitions, reusing `TripService.update()`'s existing validation, not duplicating it); `POST /api/trips/{id}/pickup/arrived` and `POST /api/trips/{id}/delivery/arrived` (acknowledgement-only — `Trip` has no ARRIVED status or arrival-timestamp column, so none was invented; these endpoints verify the trip is in a sensible status and echo it back unchanged) |
| Identifier pass | 0 renames needed — production code was already clean (verified by two independent sweep patterns) |
| **Found and fixed separately, while cross-checking `feign-dependencies.md` against the live code**: S3's `OrderLogisticsClient` has always expected S4 to expose `POST /api/v1/internal/delivery/serviceability-checks` and `GET /api/v1/internal/orders/{orderId}/review-eligibility` — neither existed anywhere in S4. This was a real, live gap (any actual call from S3's checkout or review flow would fail). | `review-eligibility` was **implemented**: new `InternalOrderLogisticsController` (`GET /api/v1/internal/orders/{orderId}/review-eligibility`) derives the answer entirely from existing `Order`/`OrderItem` data (order belongs to the caller, `orderStatus=="DELIVERED"`, an `OrderItem` for that product exists on the order) — added `OrderItemRepository.existsByOrder_IdAndProductId`, no new persistence. `serviceability-checks` was deliberately **left unimplemented and clearly flagged** (`api-catalog.md` §9, `feign-dependencies.md`, `ui-api-mapping.md`'s Checkout row) rather than implemented with an invented delivery-charge formula, since no such formula exists anywhere in the codebase to reconcile against — building one would be adding new, unspecified business logic, not integrating existing logic. New: `dto/ReviewEligibilityResponse.java`, `controller/InternalOrderLogisticsController.java`, `test/.../controller/InternalOrderLogisticsControllerTest.java` (5 tests). |
| Tests | 90 → 115 |

### S5 — Fleet Operations

| Change | Detail |
|---|---|
| JaCoCo 0.8.13 | 91.8% line / 96.1% branch / 91.1% instruction |
| New endpoint | `GET /api/expenses?fleetOwnerId=...` — activates the previously-dead `FleetExpenseRepository.findByFleetOwnerId` |
| Identifier pass | ~150 renames — this service's entire DTO layer used single-letter setter parameters (e.g. `setVehicleId(UUID v)`); rewritten to `setVehicleId(UUID vehicleId) { this.vehicleId = vehicleId; }` throughout, plus field/local renames in service impls (e.g. `S2PartnerClient s2` → `partnerClient`) |
| Tests | 64 → 68 |

### S6 — Finance & Support

| Change | Detail |
|---|---|
| JaCoCo 0.8.13 | 87.3% line / 89.5% branch / 89.0% instruction |
| New endpoints | `PATCH /api/notifications/{id}/read`, `PATCH /api/notifications/read-all?userAccountId=...` — both return the raw entity, matching this service's existing convention (no new response DTO introduced) |
| Identifier pass | 0 renames needed — production code already clean (verified with a control-tested regex to confirm the check itself worked) |
| Tests | 79 → 83 |

## Combined result

**613 tests across all 8 modules, 0 failures, 0 errors** (S1 139, S2 96, S3 103, S4 115, S5 68, S6 83, Gateway 8, Eureka 1) — see `testing.md` for the full breakdown and coverage table. (S1's count includes the 8 `TerritoryValidationServiceTest` cases added in the post-hardening fix below; the 605 figure above reflects the state before that fix.)

## Documentation

Renamed the prior session's docs to the required lowercase filenames (`application-workflow.md`, `entity-catalog.md`, `sql-jpa-discrepancy-report.md`, `architecture.md`, `running-the-project.md`, `changelog-integration.md`), merged the old `ENTITY_AND_API_MASTER_MAP.md` into `entity-catalog.md` (its API-inventory content superseded by the new `api-catalog.md`), and added: `api-catalog.md` (full per-endpoint reference), `ui-api-mapping.md` (screen-by-screen mapping with explicit GAP markers for UI features the 34-entity model doesn't back), `feign-dependencies.md` (every inter-service call with failure-handling notes), `frontend-integration-guide.md` (role-by-role first-call sequences and known gaps), `testing.md` (real, non-estimated coverage numbers). Updated `application-workflow.md`'s role section and `architecture.md`'s security section for the six-role model and Gateway-level authorization. Added `scripts/{start-all,stop-all,test-all,start-and-test,test-api}.ps1` and `api-tests/manual-api-test-cases.md`.

---

# Post-hardening pass — S1↔S3 territory-validation fix

A deeper verification pass (writing `api-catalog.md`'s §9 discrepancies section against the live source, independently spot-checked before acting) found that the Session 2 `feign-dependencies.md` entry for S3's `PlatformTerritoryClient` had understated a real, live defect: it documented a 503/504-handling gap, but the client's `validate()` and `user()` methods actually targeted `/api/v1/internal/...` paths that never existed anywhere in S1 (S1's real internal prefix is `/internal/v1/...`), and the client sent no HTTP Basic credentials against S1's `hasRole("SERVICE")` gate. **Every S3 customer-address create and update call was failing** as a result — not a documentation gap, a functional one.

Fixed, since the needed logic already exists in S1's City/Zone model (no new business logic invented, per the standing instruction):

| File(s) | Change |
|---|---|
| new: S1 `dto/TerritoryValidationRequest.java`, `dto/TerritoryValidationResponse.java`, `service/TerritoryValidationService.java`, `controller/InternalTerritoryController.java` | `POST /internal/v1/territories/validate` — checks city exists+active, and (if a zoneId is supplied) zone exists+active+belongs to that city, returning a `reasonCode` for each failure mode. `postalCode`/`latitude`/`longitude` are accepted but not checked — S1 has no reference data to validate them against. |
| new: S1 `test/.../service/TerritoryValidationServiceTest.java` | 8 unit tests, one per branch |
| new: S3 `client/ServiceBasicAuthFeignConfig.java` | Mirrors S4's `UserAccountClient` pattern — HTTP Basic as `lbos-service`, scoped to this one client only |
| S3 `client/PlatformTerritoryClient.java` | Repointed both methods at S1's real `/internal/v1/**` paths; applied the new Basic-auth configuration |
| S3 `application.yml` | Added `app.security.service.password` (defaults to `service123`, matching S1) |

**Live-verified** with both services actually running (not just unit tests): unauthenticated request → `401`; missing `cityId` → `200 {"valid":false,"reasonCode":"CITY_ID_REQUIRED"}`; unknown city → `CITY_NOT_FOUND`; the seeded demo Chennai city (`20000000-…-001`) alone or with its seeded North Zone (`50000000-…-001`) → `{"valid":true}`; that same zone sent against the seeded Coimbatore city id → `ZONE_CITY_MISMATCH`. S1's suite grew 131→139, S3's stayed at 103 (existing `AddressServiceImplTest` already mocked the client interface, whose method signatures didn't change).

**Deliberately left as documented gaps, not fixed in this pass** (each would require inventing new cross-service business logic, not reconciling existing logic — see `api-catalog.md` §9 for the full list): S3's `PartnerVerificationClient`/`FinanceClient` targeting nonexistent S2/S6 internal endpoints; S2's `LocationManagerClient` targeting an Eureka name no service registers under, with its failure silently swallowed; S4's missing serviceability-check endpoint blocking checkout; S5's total absence of a global exception handler; S4's broad Feign-failure-to-404 mapping; the platform-wide boolean/status-vocabulary/pagination/id-type inconsistencies.

## Things deliberately NOT done (flagged as gaps, not silently skipped)

- No new persistent entities added for Location Management, Fleet Maintenance (beyond the existing `FleetExpense`), Fleet Compliance, Driver Earnings/Incentives, or Operations Messaging (beyond the existing `Notification`) — per explicit instruction, these are documented as backend gaps in `ui-api-mapping.md` and `application-workflow.md`, not invented.
- No public customer self-registration endpoint was added (would require deciding whether to weaken `POST /api/user-accounts`'s `SUPER_ADMIN` gate or add a genuinely new public-signup endpoint with its own validation rules — judged out of scope for a "reconcile existing code against the UI" pass rather than a new-feature pass; flagged prominently instead, in `frontend-integration-guide.md`, `ui-api-mapping.md`, and `running-the-project.md`).
- No per-resource-ownership enforcement was added to S2/S4/S5/S6 (only route-level role authorization, at the Gateway) — flagged as a known limitation in `architecture.md` §11, not silently left undocumented.
- No literal single combined multi-module JaCoCo report was generated (each of the 8 modules produces its own independent report; there's no reactor POM tying them together, and creating one was judged a bigger structural change than requested) — `testing.md` states this explicitly and gives the combined test-count total instead.
