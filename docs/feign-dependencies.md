> **FINAL FIX NOTE:** This document contains historical integration observations from earlier audit passes. For the current repository state, use `docs/FINAL_FIXES.md` and `docs/ECLIPSE_MANUAL_TESTING.md` first. Where this document says an endpoint is missing or a Feign client is hardcoded, verify against the current source before relying on that statement.

# Feign Client Dependencies

Every inter-service call in the platform, as actually implemented. No service accesses another service's database directly — every cross-service read goes through one of these Feign clients. See `architecture.md` for the dependency-graph diagram and `api-catalog.md` for the full endpoint reference of each target.

## S3 → S1 — `PlatformTerritoryClient`

| | |
|---|---|
| Caller | S3 (`lbos-commerce`) |
| Target | S1 (`lbos-platform`) |
| Client interface | `client/PlatformTerritoryClient.java` |
| Methods | `GET /internal/v1/user-accounts/{id}` → `UserAccountSummaryResponse` *(declared, never actually called — dead code, see below)*; `POST /internal/v1/territories/validate` → `TerritoryValidationResponse` |
| Why | Validating a customer address's city/zone against S1's territory data before persisting |
| UI feature | Customer "Add address" / "Edit address" screen |
| Failure scenario | S1 unreachable during address save |
| Handling | `ExternalServiceUnavailableException`/`ExternalServiceTimeoutException` types exist in S3's exception hierarchy and are wired into `GlobalExceptionHandler` (503/504), but **no code path actually throws them** — a live Feign failure here currently falls through to the generic 500 handler instead. Documented gap, not fixed in this pass (see `sql-jpa-discrepancy-report.md`). |

**Correction (this pass)**: this client previously targeted `POST /api/v1/internal/territories/validate` and `GET /api/v1/internal/users/{id}` — paths that never existed on S1, and it sent no credentials against S1's `hasRole("SERVICE")` gate on `/internal/**`. Both defects were live bugs, not just documentation gaps: every S3 address create/update call to `validate()` failed. Fixed in this pass:
- S1 gained a real `POST /internal/v1/territories/validate` endpoint (`InternalTerritoryController` → `TerritoryValidationService`), checking the same city/zone data the rest of S1 already models — city exists and is active; if a zone id is supplied, it exists, is active, and belongs to the given city. `postalCode`/`latitude`/`longitude` are accepted but not checked, since S1 has no reference data to check them against (documented, not invented).
- The client's two methods were repointed at S1's real `/internal/v1/**` paths, and a `ServiceBasicAuthFeignConfig` (mirroring S4's `UserAccountClient`) was added so the client authenticates as `lbos-service`.
- Live-verified with both services running: unauthenticated calls get `401`; authenticated calls against the seeded demo Chennai city/zone rows return `{"valid":true}`; an unknown city, an inactive city, an unknown zone, and a zone belonging to a different city each return the matching `valid:false` reason code.

**Dead code note**: `PlatformTerritoryClient.user(UUID)` and (below) `PartnerVerificationClient.get(UUID)` are declared Feign methods with no caller anywhere in S3. Left in place (removing them wasn't requested and doesn't affect correctness), flagged here for visibility. `user()`'s path was corrected alongside `validate()`'s even though nothing calls it, so the interface no longer has a mix of real and fictitious paths.

## S3 → S2 — `PartnerVerificationClient`

| | |
|---|---|
| Caller | S3 (`lbos-commerce`) |
| Target | S2 (`lbos-partner`) |
| Methods | `GET /api/v1/internal/retailers/by-user/{id}` → `RetailerContextResponse` (used); `GET /api/v1/internal/retailers/{id}` → `RetailerSummaryResponse` (declared, unused) |
| Why | Resolving which retailer the authenticated account owns, for retailer-scoped catalogue/inventory operations |
| UI feature | Retailer catalogue/inventory screens ("Add product," "Update stock") |
| Failure scenario | S2 unreachable while a retailer edits their catalogue |
| Handling | Same gap as above — falls through to generic 500 instead of 503 |

## S3 → S4 — `OrderLogisticsClient`

| | |
|---|---|
| Caller | S3 (`lbos-commerce`) |
| Target | S4 (`lbos-order`) |
| Methods | `POST /api/v1/internal/delivery/serviceability-checks` → `ServiceabilityResponse`; `GET /api/v1/internal/orders/{orderId}/review-eligibility` → `ReviewEligibilityResponse` |
| Why | Checkout-time delivery-fee/serviceability calculation; verified-purchase check before a customer can review a product |
| UI feature | Cart → Checkout screen; Product review submission |
| Failure scenario | S4 unreachable during checkout or review submission |
| Handling | Same generic-500 gap — see above for both calls. |
| **Status, confirmed by reading S4's live source (this pass)** | `review-eligibility` is now **implemented** — S4's `InternalOrderLogisticsController.reviewEligibility` derives the answer from real `Order`/`OrderItem` data (order belongs to the caller, `orderStatus=="DELIVERED"`, an `OrderItem` for that product exists on that order), added specifically to satisfy this contract. `serviceability-checks` is **confirmed NOT implemented** — no matching route exists anywhere in S4. This is a real, live gap: if S3's checkout flow actually calls it, the Feign call fails (connection error / 404 via load-balancer resolution finding no matching route), and S3's checkout-preparation step will error out rather than silently return a wrong answer. Not fixed in this pass because a real delivery-fee/serviceability formula for retail orders doesn't exist anywhere in the codebase to reconcile against — inventing one would be adding unspecified business logic, not integrating existing logic. See `api-catalog.md` §9 and `ui-api-mapping.md`'s Checkout/Payment row for the same flag. |

## S3 → S6 — `FinanceClient`

| | |
|---|---|
| Caller | S3 (`lbos-commerce`) |
| Target | S6 (`lbos-finance`) |
| Methods | `POST /api/v1/internal/tax-calculations` → `TaxCalculationResponse` |
| Why | Checkout-time tax calculation |
| UI feature | Cart → Checkout screen |
| Failure scenario | S6 unreachable during checkout |
| Handling | Same gap as above |

## S2 → S1 — `LocationManagerClient`

| | |
|---|---|
| Caller | S2 (`lbos-partner`) |
| Target | S1 (`lbos-platform`) |
| Methods | Submit-verification notification (endpoint contract marked "provisional" in the original S2 code's own Javadoc) |
| Why | Notify a location manager when a retailer/fleet-owner submits for verification |
| UI feature | Retailer/fleet-owner "Submit for verification" action |
| Failure scenario | S1 unreachable, or the endpoint contract not finalized |
| Handling | **Exceptions from this call are caught and silently swallowed** (`catch (Exception e) { /* Log and handle */ }` with no actual logging, per a prior audit) — a caller gets an apparent success even if the notification never went through. This is a genuine, documented gap, not fixed in this pass since fixing the silent-swallow requires either adding real logging (safe, small) or redesigning the contract (out of scope). Flagged for a follow-up. |

## S5 → S2 — `S2PartnerClient`

| | |
|---|---|
| Caller | S5 (`lbos-fleet`) |
| Target | S2 (`lbos-partner`) |
| Methods | `GET /api/fleet-owners/{fleetOwnerId}/validation` → `FleetOwnerValidationDto`; `GET /api/drivers/user-account/{userAccountId}/validation` → `DriverValidationDto` |
| Why | Validating a fleet owner's approval status before registering a vehicle/expense; validating a driver's verification status and license expiry before registering them operationally or assigning them to a vehicle |
| UI feature | FLEET_MANAGER "Register vehicle," "Add driver," "Assign driver to vehicle," "Add expense" screens |
| Failure scenario | S2 unreachable during any of the above |
| Handling | S5 has **no global exception handler at all** (confirmed gap, not fixed in this pass — see `sql-jpa-discrepancy-report.md`); a Feign failure here surfaces as a raw, unstructured 500. |
| Note | Uses a hardcoded `services.s2.url` property, not Eureka discovery (S5's only Feign client; not migrated to discovery-by-name in this pass — flagged as a follow-up, low risk since it's one client, one target). |

## S6 → S1 — `IdentityServiceClient`, `OperationsServiceClient`

| | |
|---|---|
| Caller | S6 (`lbos-finance`) |
| Target | S1 (`lbos-platform`) |
| `IdentityServiceClient` methods | `getUserAccount(UUID)`, `getCustomerProfile(UUID)` |
| `OperationsServiceClient` methods | `getOperationsManager(UUID)`, `getState(UUID)` |
| Why | Validate account/customer is active before payment/notification/support-ticket/audit-log actions; validate operations manager and state for settlements/tax configuration |
| UI feature | Payment initiation, notification delivery, support ticket creation, settlement processing, tax configuration screens |
| Failure scenario | S1 unreachable |
| Handling | No handler for Feign/timeout failures in S6's `GlobalExceptionHandler` — falls through to generic 500 (documented gap) |
| **Boundary flag** | `IdentityServiceClient.getCustomerProfile(UUID)` targets data actually **owned by S3**, not S1 — this Feign client is pointed at a single URL (currently S1's) for both methods, so calling `getCustomerProfile` would hit the wrong service if it were ever actually invoked. Confirmed via code read: **it is declared but not called by any of the 8 S6 services in the current codebase**, so this mismatch is latent, not actively broken — but it must be fixed (split into two clients, one per real owner) before anyone wires up a caller. Documented, not silently patched. |

## S6 → S3 — `CatalogServiceClient`

| | |
|---|---|
| Caller | S6 (`lbos-finance`) |
| Target | S3 (`lbos-commerce`) |
| Methods | `getProduct(Long)`, `getProductCategory(Long)` |
| Why | Refund processing needs the product/category context for the item being refunded |
| UI feature | Customer/Admin refund screens |
| Failure scenario | S3 unreachable during refund creation |
| Handling | Same generic-500 gap as above |

## S6 → S4 — `OrderServiceClient`, `LogisticsServiceClient`

| | |
|---|---|
| Caller | S6 (`lbos-finance`) |
| Target | S4 (`lbos-order`) |
| `OrderServiceClient` methods | `getOrderById(Long)`, `getOrderItems(Long)` |
| `LogisticsServiceClient` methods | `getTripByOrderId(Long)` |
| Why | Payment creation needs order total/status; invoice generation sums real order-item data; refund eligibility requires the order to be DELIVERED and its trip COMPLETED; support tickets tied to an order verify ownership |
| UI feature | Payment, Invoice, Refund, Support-ticket screens |
| Failure scenario | S4 unreachable |
| Handling | Same generic-500 gap |

## S4 → S3 — `ProductClient` (added this integration)

| | |
|---|---|
| Caller | S4 (`lbos-order`) |
| Target | S3 (`lbos-commerce`) |
| Method | `GET /api/v1/products/{id}` → `ApiResponseEnvelope<ProductSummary>` |
| Why | Snapshotting SKU/name/price onto an `OrderItem` at creation time |
| UI feature | Customer checkout → order creation |
| Failure scenario | S3 unreachable, or product not found (S3 returns 404) |
| Handling | `OrderItemService` throws the same not-found exception type it already used for local not-found cases |

## S4 → S5 — `VehicleClient`, `DriverClient` (added this integration)

| | |
|---|---|
| Caller | S4 (`lbos-order`) |
| Target | S5 (`lbos-fleet`) |
| `VehicleClient` method | `GET /api/vehicles/{id}` |
| `DriverClient` method | `GET /api/drivers/{id}` |
| Why | Trip creation/status-transition validation (vehicle/driver ACTIVE, license not expired, fleet-owner matching), and the logistics-booking cost engine's vehicle-type surcharge lookup |
| UI feature | Customer logistics booking; FLEET_MANAGER trip/assignment screens |
| Failure scenario | S5 unreachable, or vehicle/driver not found (S5 has no global exception handler, so a missing ID there returns an unstructured 500, not a clean 404 — S4 catches `feign.FeignException` broadly around these calls rather than only 404, per the implementing agent's own note) |
| Handling | Broad `FeignException` catch around both calls in `TripService`/`LogisticsBookingDetailService`, since S5's own error shape for "not found" is not a clean 404 |

## S4 → S1 — `UserAccountClient` (added this integration)

| | |
|---|---|
| Caller | S4 (`lbos-order`) |
| Target | S1 (`lbos-platform`) |
| Method | `GET /internal/v1/user-accounts/{id}` (new S1 endpoint, added this integration specifically for this caller) |
| Why | Validating the account that created/assigned a Trip exists |
| UI feature | FLEET_MANAGER trip-assignment actions |
| Failure scenario | S1 unreachable |
| Handling | S1's `/internal/**` requires HTTP Basic (the `lbos-service` account); S4 sends this via a request-interceptor scoped only to `UserAccountClient` (not applied to `ProductClient`/`VehicleClient`/`DriverClient`, which don't need it) |
| Auth | HTTP Basic, username `lbos-service`, password from `app.security.service.password` (must match the same property value on S1) |

## Summary table

| Caller | Target | Client | Discovery |
|---|---|---|---|
| S3 | S1 | `PlatformTerritoryClient` | Eureka (`lbos-platform`) |
| S3 | S2 | `PartnerVerificationClient` | Eureka (`lbos-partner`) |
| S3 | S4 | `OrderLogisticsClient` | Eureka (`lbos-order`) |
| S3 | S6 | `FinanceClient` | Eureka (`lbos-finance`) |
| S2 | S1 | `LocationManagerClient` | Eureka (`lbos-platform`) |
| S5 | S2 | `S2PartnerClient` | hardcoded URL (not migrated) |
| S6 | S1 | `IdentityServiceClient`, `OperationsServiceClient` | Eureka (`lbos-platform`) |
| S6 | S3 | `CatalogServiceClient` | Eureka (`lbos-commerce`) |
| S6 | S4 | `OrderServiceClient`, `LogisticsServiceClient` | Eureka (`lbos-order`) |
| S4 | S3 | `ProductClient` | Eureka (`lbos-commerce`) |
| S4 | S5 | `VehicleClient`, `DriverClient` | Eureka (`lbos-fleet`) |
| S4 | S1 | `UserAccountClient` | Eureka (`lbos-platform`) |

**No circular dependencies**: S1 calls no other service. S2 calls only S1. S3, S4, S5, S6 call each other and S1/S2 but never form a cycle (verified by inspection of the table above — no target ever calls back to one of its own callers).

**Every cross-service call uses a dedicated request/response DTO, never a JPA entity.** Confirmed by inspection of every client listed above — each has its own `dto`/`dto.client`/`integration.dto` package with plain request/response types, none of which extend or reuse an `@Entity` class.


## Final-fix current Feign discovery state

The current source has no normal inter-service Feign `url = ...` declarations. The important service names are:

- S2 -> S1: `lbos-platform`
- S3 -> S1: `lbos-platform`
- S3 -> S2: `lbos-partner`
- S3 -> S4: `lbos-order`
- S3 -> S6: `lbos-finance`
- S4 -> S1: `lbos-platform`
- S4 -> S3: `lbos-commerce`
- S4 -> S5: `lbos-fleet`
- S5 -> S2: `lbos-partner`
- S6 -> S1: `lbos-platform`
- S6 -> S3: `lbos-commerce`
- S6 -> S4: `lbos-order`

The S1 internal Basic-auth calls remain intentionally separate from end-user JWT authentication.
