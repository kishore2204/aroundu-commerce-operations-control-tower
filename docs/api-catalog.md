# API Catalog

The complete REST surface of the LBOS / AroundU platform, compiled directly from the current controller and `SecurityConfig`/`OpenApiConfig` source across all 8 modules (not from specs or older audit notes). Every method, path, parameter, and role restriction below reflects the code as it exists today.

Companion documents: `architecture.md` (topology), `entity-catalog.md` (entity fields), `feign-dependencies.md` (inter-service calls), `running-the-project.md` (how to run and log in).

---

## 1. How the platform is structured

| Service | Eureka name | Port | Package |
|---|---|---|---|
| Eureka Server | `lbos-eureka` | 8761 | — (registry only, no business API) |
| API Gateway | `lbos-gateway` | 8080 | `com.lbos.gateway` |
| S1 Platform & Territory | `lbos-platform` | 8081 | `com.cbg.lbos` |
| S2 Partner Verification | `lbos-partner` | 8082 | `com.example.lbos` |
| S3 Commerce & Customer | `lbos-commerce` | 8083 | `com.lbos.commercecustomer` |
| S4 Order & Logistics | `lbos-order` | 8084 | `com.cbg.lbos` |
| S5 Fleet Operations | `lbos-fleet` | 8085 | `com.cbg.lbos` |
| S6 Finance & Support | `lbos-finance` | 8086 | `com.lbos.finance` |

**Always call through the Gateway** (`http://localhost:8080`) in a real client — service ports are for direct testing/Swagger only. Every service also exposes its own Swagger UI at `http://localhost:<port>/swagger-ui.html`, each with a working **Authorize** button (Bearer/JWT scheme) as of this pass.

### Authentication

One endpoint issues one token for the whole platform:

```
POST /api/v1/auth/login   (S1, public, no token required)
```

Every other endpoint requires:

```
Authorization: Bearer <accessToken>
```

The same JWT (signed with the shared `app.jwt.secret`, default value in every service's `application.properties`, overridable via `JWT_SECRET`) is accepted by all six services — no per-service login.

### The six roles

`CUSTOMER`, `RETAILER`, `LOCATION_MANAGER`, `OPERATIONS_MANAGER`, `FLEET_MANAGER`, `SUPER_ADMIN`.

### Two layers of authorization

1. **The Gateway** (`RouteAuthorizationRules.java`) — a coarse, path-group role table. First matching rule wins; a path matching no rule is **denied**. This is the platform's primary access-control layer.
2. **Each service's own `SecurityConfig.java`** — every service (as of this pass) additionally requires a valid JWT itself and, in several services, re-restricts specific paths/methods further (e.g. S1 restricts `/api/v1/cities/**` to fewer roles than the Gateway allows; S4/S5 restrict "list everything" and mutations to staff; S6 requires staff roles on its *entire* surface). Where a service's own restriction is narrower than the Gateway's, the service's rule is what actually governs — treat the **narrower** of the two as the effective role set.

Two internal-only auth patterns also exist, used purely for service-to-service calls and never reachable through the Gateway:
- **S1**: `/internal/v1/**`, HTTP Basic, `hasRole("SERVICE")`.
- **S2, S3, S4, S5, S6**: an internal path (`/internal/**` on S2/S5, `/api/v1/internal/**` on S3/S4/S6), same HTTP Basic + `hasRole("SERVICE")` pattern, same shared in-memory credential (`lbos-service` / `app.security.service.password`, default `service123`, env `SERVICE_PASSWORD`).

### Error response shapes (still not uniform across services)

| Service | Shape |
|---|---|
| S1 | `ApiErrorResponse`: `timestamp`, `status`, `error`, `message`, `path`, `validationErrors` (map) |
| S2 | plain `Map`: `message`, `status` — only its four `*NotFoundException` types are handled; everything else falls through to Spring's default body |
| S3 | `ErrorResponse`: `timestamp`, `status`, `errorCode`, `category`, `technicalMessage`, `userMessage`, `fieldErrors[]`, `path`, `correlationId`, `retryable` — S3 also wraps every **success** in an `ApiResponse` envelope (`data` holds the real payload) |
| S4 | plain `Map`: `timestamp`, `status`, `error`, `message` (+ `fieldErrors` on validation failures) |
| S5 | **none** — no `@RestControllerAdvice`; every failure is a bare `RuntimeException` reaching the client as Spring's default `500`, even "not found"/"conflict" cases |
| S6 | plain `Map`: `timestamp`, `status`, `message` |

A `401`/`403` from the Gateway itself has an **empty body** — don't try to parse it as JSON.

### Pagination

- **S1**: Spring Data `Pageable` (`?page=&size=&sort=`) on cities, zones, operations-managers, location-managers.
- **S3**: hand-rolled `page`/`size` (defaults `0`/`20`), wrapped in `PageResponse` inside the `ApiResponse` envelope.
- **S2, S4, S5, S6**: no pagination — every list endpoint returns the full unbounded collection.

---

## 2. Gateway route and role table

Straight from `RouteAuthorizationRules.java` — first matching rule wins, unmatched paths are denied.

| Path pattern | Service | Allowed roles |
|---|---|---|
| `/api/v1/auth/login` | S1 | **public** |
| `/api/v1/users/me` | S1 | all six roles |
| `/api/user-accounts/**` | S1 | SUPER_ADMIN |
| `/api/states/**` | S1 | GET: all seven roles (address/onboarding-form city/state dropdowns); write: SUPER_ADMIN only |
| `/api/v1/operations-managers/**` | S1 | GET: SUPER_ADMIN, OPERATIONS_MANAGER (OM needs the list for the LM-assignment dropdown); write: SUPER_ADMIN only |
| `/api/v1/location-managers/**` | S1 | GET `/me`: SUPER_ADMIN, OPERATIONS_MANAGER, LOCATION_MANAGER (self-lookup); everything else: SUPER_ADMIN, OPERATIONS_MANAGER |
| `/api/v1/cities/**` | S1 | GET: all seven roles (address/onboarding-form dropdowns) - matches the Gateway, no longer 403s a LOCATION_MANAGER; write: SUPER_ADMIN only |
| `/api/v1/zones/**` | S1 | GET: all seven roles, same as cities; write: SUPER_ADMIN, OPERATIONS_MANAGER |
| `/api/retailers/**` | S2 | RETAILER, SUPER_ADMIN, OPERATIONS_MANAGER, LOCATION_MANAGER |
| `/api/fleet-owners/**` | S2 | FLEET_MANAGER, SUPER_ADMIN, OPERATIONS_MANAGER, LOCATION_MANAGER |
| `/api/verification-documents/**` | S2 | SUPER_ADMIN, OPERATIONS_MANAGER, LOCATION_MANAGER |
| `/api/verification-queues/**` | S2 | SUPER_ADMIN, OPERATIONS_MANAGER, LOCATION_MANAGER (Gateway) — S2 itself only requires this role set on POST/PUT/PATCH/DELETE; GET only needs any authenticated role |
| `/api/v1/customers/**` | S3 | CUSTOMER, SUPER_ADMIN |
| `/api/v1/cart/**` | S3 | CUSTOMER, SUPER_ADMIN |
| `/api/v1/checkout/**` | S3 | CUSTOMER, SUPER_ADMIN |
| `/api/v1/reviews/**` | S3 | CUSTOMER, RETAILER, SUPER_ADMIN (Gateway) — S3 itself makes all GETs public |
| `/api/v1/product-categories/**` | S3 | CUSTOMER, RETAILER, SUPER_ADMIN (Gateway) — S3 makes GET public, restricts writes to SUPER_ADMIN |
| `/api/v1/products/**` | S3 | CUSTOMER, RETAILER, SUPER_ADMIN (Gateway) — S3 makes all GETs public |
| `/api/v1/retailers/*` (single segment — `PublicRetailerController.get()`) | S3 | CUSTOMER, RETAILER, SUPER_ADMIN — **new in the shop-badge pass**, matched before the general rule below since a customer expanding a shop card needs read access |
| `/api/v1/retailers/*/rating-summary` | S3 | CUSTOMER, RETAILER, SUPER_ADMIN — same reason, same pass |
| `/api/v1/retailers/**` (everything else, e.g. `.../me/products`, `.../me/inventory`) | S3 | RETAILER, SUPER_ADMIN |
| `/api/orders/**` | S4 | CUSTOMER, RETAILER, SUPER_ADMIN |
| `/api/order-items/**` | S4 | CUSTOMER, RETAILER, SUPER_ADMIN |
| `/api/logistics-bookings/**` | S4 | CUSTOMER, FLEET_MANAGER, SUPER_ADMIN (Gateway) — S4 restricts writes to SUPER_ADMIN/OPERATIONS_MANAGER |
| `/api/trips/**` | S4 | CUSTOMER, FLEET_MANAGER, SUPER_ADMIN (Gateway) — S4 restricts list-all and writes to SUPER_ADMIN/OPERATIONS_MANAGER |
| `/api/drivers/**` | S5 | FLEET_MANAGER, SUPER_ADMIN (Gateway) — S5 restricts list-all and writes further to SUPER_ADMIN/OPERATIONS_MANAGER |
| `/api/vehicles/**` | S5 | same pattern as drivers |
| `/api/assignments/**` | S5 | same pattern |
| `/api/expenses/**` | S5 | same pattern |
| `/api/payment-transactions/**` | S6 | CUSTOMER, RETAILER, FLEET_MANAGER, OPERATIONS_MANAGER, SUPER_ADMIN (Gateway) — **S6 itself requires SUPER_ADMIN/OPERATIONS_MANAGER on everything**, so this is the effective set |
| `/api/customer-invoices/**` | S6 | same S6-narrows-it-further caveat |
| `/api/customer-refunds/**` | S6 | same caveat |
| `/api/settlements/**` | S6 | same caveat |
| `/api/tax-configurations/**` | S6 | SUPER_ADMIN, OPERATIONS_MANAGER |
| `/api/support-tickets/**` | S6 | all six roles (Gateway) — S6 narrows to SUPER_ADMIN/OPERATIONS_MANAGER |
| `/api/notifications/**` | S6 | all six roles (Gateway) — S6 narrows to SUPER_ADMIN/OPERATIONS_MANAGER |
| `/api/audit-logs/**` | S6 | SUPER_ADMIN, OPERATIONS_MANAGER |
| `/api/analytics/**` | S6 | SUPER_ADMIN, OPERATIONS_MANAGER |

**S6 in practice is entirely a back-office surface** — every one of its endpoints, Gateway-allowed roles notwithstanding, actually requires SUPER_ADMIN or OPERATIONS_MANAGER once you hit S6's own `SecurityConfig`. There is no customer-facing read or write anywhere in S6.

All `/internal/**` and `/api/v1/internal/**` paths on every service are **absent from the Gateway route table entirely** — they can only be reached by calling a service's port directly with the shared Basic-auth credential, which is by design (service-to-service only).

---

## 3. S1 — Platform & Territory

Owns `UserAccount`, `State`, `City`, `Zone`, `OperationsManager`, `LocationManager`. No outbound Feign calls — S1 is a leaf service.

### AuthController — `/api/v1/auth`

| Method + Path | Purpose | Body | Response | Auth |
|---|---|---|---|---|
| POST `/api/v1/auth/login` | Verifies email + password, checks `accountStatus == ACTIVE`, stamps `lastLoginAt`, issues a signed JWT | `LoginRequestDto` | `LoginResponseDto` (`accessToken`, `role`, ...) | public |
| POST `/api/v1/auth/register/customer` | Self-service signup — always creates role `CUSTOMER` | `CustomerRegistrationRequestDto` | `UserAccountResponseDto` (201) | public |

### CurrentUserController — `/api/v1/users`

| Method + Path | Purpose | Auth |
|---|---|---|
| GET `/api/v1/users/me` | Returns the caller's own profile, identity resolved only from the JWT subject | any authenticated role |

### CityController — `/api/v1/cities` — SUPER_ADMIN, OPERATIONS_MANAGER

| Method + Path | Purpose | Params | Body | Response |
|---|---|---|---|---|
| POST `/api/v1/cities` | Creates a city | — | `CityDtos.CreateRequest` | `CityDtos.Response` (201) |
| GET `/api/v1/cities` | Paged city list | `active` (opt), `page`/`size`/`sort` (default size 50, sort `cityName`) | — | `Page<Response>` |
| GET `/api/v1/cities/{id}` | One city | `id` | — | `Response` |
| PUT `/api/v1/cities/{id}` | Rename/move/set active | `id` | `UpdateRequest` | `Response` |
| DELETE `/api/v1/cities/{id}` | Delete | `id` | — | 204 |
| PATCH `/api/v1/cities/{id}/activate` | Set active=true | `id` | — | `Response` |
| PATCH `/api/v1/cities/{id}/deactivate` | Set active=false | `id` | — | `Response` |

### ZoneController — `/api/v1/zones` — SUPER_ADMIN, OPERATIONS_MANAGER

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/v1/zones` | Creates a zone within a city | — | `ZoneDto` |
| GET `/api/v1/zones/{id}` | One zone | `id` | — |
| GET `/api/v1/zones` | Search, paged | `cityId`, `active` (opt), `page`/`size`(20)/`sort`(`zoneName`) | — |
| PUT `/api/v1/zones/{id}` | Rename | `id` | `ZoneDto` |
| PATCH `/api/v1/zones/{id}/activate` | Activate | `id` | — |
| PATCH `/api/v1/zones/{id}/deactivate` | Deactivate | `id` | — |

No `DELETE` — zones are deactivated, not deleted.

### OperationsManagerController — `/api/v1/operations-managers` — SUPER_ADMIN only

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/v1/operations-managers` | Assigns a user account as OM of a city | — | `CreateRequest` |
| GET `/api/v1/operations-managers/{id}` | One assignment | `id` | — |
| GET `/api/v1/operations-managers/by-user/{id}` | Assignment by user account id | `id` | — |
| GET `/api/v1/operations-managers` | Search, paged | `cityId`, `status` (opt) | — |
| PUT `/api/v1/operations-managers/{id}` | Update city + status | `id` | `UpdateRequest` |
| PATCH `/api/v1/operations-managers/{id}/city` | Reassign city | `id` | `ReassignCityRequest` |
| PATCH `/api/v1/operations-managers/{id}/status` | Change status only | `id` | `StatusRequest` |
| DELETE `/api/v1/operations-managers/{id}` | Remove assignment | `id` | — |
| GET `/api/v1/operations-managers/summary` | Dashboard counters | — | — |

### LocationManagerController — `/api/v1/location-managers` — SUPER_ADMIN, OPERATIONS_MANAGER

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/v1/location-managers` | Assigns an officer to a zone | — | `LocationManagerDto` |
| GET `/api/v1/location-managers/{id}` | One assignment | `id` | — |
| GET `/api/v1/location-managers/active/by-zone/{zoneId}` | The zone's current active officer | `zoneId` | — |
| GET `/api/v1/location-managers` | Search, paged | `zoneId`, `operationsManagerId`, `status` (opt) | — |
| PUT `/api/v1/location-managers/{id}/transfer` | Move officer to another zone | `id` | `LocationManagerDto` |
| PATCH `/api/v1/location-managers/{id}/operations-manager` | Change supervising OM | `id` | `LocationManagerDto` (not `@Valid`) |
| PATCH `/api/v1/location-managers/{id}/activate` | Activate | `id` | — |
| PATCH `/api/v1/location-managers/{id}/deactivate` | Deactivate | `id` | — |

### UserAccountController — `/api/user-accounts` — SUPER_ADMIN only

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/user-accounts` | Create an account (bcrypt-hashed password) | — | `UserAccountRequestDto` |
| GET `/api/user-accounts` | List everyone | — | — |
| GET `/api/user-accounts/{id}` | One account | `id` | — |
| GET `/api/user-accounts/search-by-email` | Exact-email lookup | `email` | — |
| GET `/api/user-accounts/role/{role}` | Accounts holding a role | `role` | — |
| GET `/api/user-accounts/status/{accountStatus}` | Accounts in a status | `accountStatus` | — |
| PUT `/api/user-accounts/{id}` | Full update | `id` | `UserAccountRequestDto` |
| PATCH `/api/user-accounts/{id}/status` | Activate/suspend/deactivate | `id` | `UserAccountStatusRequestDto` |
| PATCH `/api/user-accounts/{id}/last-login` | Stamp lastLoginAt=now | `id` | — |
| DELETE `/api/user-accounts/{id}` | Delete | `id` | — |

### StateController — `/api/states` — SUPER_ADMIN only

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/states` | Create a state | — | `StateDto` |
| GET `/api/states` | List all | — | — |
| GET `/api/states/{id}` | One state | `id` | — |
| GET `/api/states/country/{countryCode}` | States in a country | `countryCode` | — |
| GET `/api/states/active` | Filter by active flag | `isActive` (required) | — |
| PUT `/api/states/{id}` | Update | `id` | `StateDto` |
| DELETE `/api/states/{id}` | Delete | `id` | — |

### Internal endpoints (HTTP Basic, `hasRole("SERVICE")`, not routed by the Gateway)

| Method + Path | Controller | Purpose |
|---|---|---|
| GET `/internal/v1/user-accounts/{id}` | `InternalUserAccountController` | Account lookup — consumed by S4 for Trip audit-field validation |
| GET `/internal/v1/operations-managers/resolve?userAccountId=` | `InternalOperationsManagerController` | Resolve a user account to its OM assignment |
| GET `/internal/v1/operations-managers/city/{id}/active` | `InternalOperationsManagerController` | Active OM for a city |
| GET `/internal/v1/operations-managers/{id}/validate-city/{cityId}` | `InternalOperationsManagerController` | Does this OM govern this city? |
| GET `/internal/v1/states/{id}` | `InternalStateController` | Reduced state lookup — consumed by S6 validating a tax configuration's `stateId` |
| POST `/internal/v1/territories/validate` | `InternalTerritoryController` | Validates a city/zone pair — consumed by S3 when creating/updating a `CustomerAddress` |
| POST `/internal/v1/location-managers/{managerId}/verifications` | `InternalLocationManagerController` | Acknowledges a verification-routing request from S2 |
| GET `/internal/v1/location-managers/active/by-zone/{zoneId}` | `InternalLocationManagerController` | **New this pass** — service-to-service equivalent of the public by-zone lookup, so S2 can resolve the correct Location Manager for a retailer/fleet-owner's zone (rather than misrouting to their Operations Manager) |

---

## 4. S2 — Partner Verification

Owns `Retailer`, `FleetOwner`, `VerificationQueue`, `VerificationDocument`. Turns a signed-up retailer/fleet-owner into a *verified* one; S3 and S5 lean on this data to confirm a partner is real.

Quirks: `DELETE` returns `200` with an empty body (not `204`, everywhere). Only 4 `*NotFoundException` types are mapped to `404` — everything else falls through to Spring's default handling. No pagination anywhere.

### RetailerController — `/api/retailers` — any authenticated role, with in-controller ownership checks

Non-staff callers (not SUPER_ADMIN/OPERATIONS_MANAGER) can only create/update/delete **their own** retailer profile — `userAccountId` is forced from the JWT subject regardless of what's in the request body.

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/retailers/register` | Registers a retailer, status PENDING_VERIFICATION | — | `RetailerDTO` |
| POST `/api/retailers` | Same as register | — | `RetailerDTO` |
| GET `/api/retailers` | List all | — | — |
| GET `/api/retailers/{retailerId}` | One retailer | `retailerId` | — |
| PUT `/api/retailers/{retailerId}` | Update (owner or staff only) | `retailerId` | `RetailerDTO` |
| DELETE `/api/retailers/{retailerId}` | Delete (owner or staff only) | `retailerId` | — |
| GET `/api/retailers/city/{cityId}` | Retailers in a city | `cityId` | — |
| GET `/api/retailers/status/{status}` | Retailers by status | `status` | — |
| GET `/api/retailers/search?businessName=` | Search by name | `businessName` | — |
| POST `/api/retailers/{retailerId}/documents` | Submit a batch of verification documents | `retailerId` | `List<VerificationDocumentDTO>` |
| POST `/api/retailers/{retailerId}/submit-verification` | Sends the queue entry to the active Location Manager for the retailer's zone | `retailerId` | — |
| GET `/api/retailers/{retailerId}/verification-status` | Current verification status | `retailerId` | — |

### FleetOwnerController — `/api/fleet-owners` — same auth/ownership pattern as retailers

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/fleet-owners/register` | Registers a fleet owner | — | `FleetOwnerDTO` |
| POST `/api/fleet-owners` | Same as register | — | `FleetOwnerDTO` |
| GET `/api/fleet-owners` | List all | — | — |
| GET `/api/fleet-owners/{fleetOwnerId}` | One fleet owner | `fleetOwnerId` | — |
| PUT `/api/fleet-owners/{fleetOwnerId}` | Update (owner or staff) | `fleetOwnerId` | `FleetOwnerDTO` |
| DELETE `/api/fleet-owners/{fleetOwnerId}` | Delete (owner or staff) | `fleetOwnerId` | — |
| GET `/api/fleet-owners/city/{cityId}` | Fleet owners in a city | `cityId` | — |
| GET `/api/fleet-owners/status/{status}` | By owner status | `status` | — |
| GET `/api/fleet-owners/profile-status/{status}` | By profile verification status | `status` | — |
| GET `/api/fleet-owners/search?businessName=` | Search by name | `businessName` | — |
| POST `/api/fleet-owners/{fleetOwnerId}/documents` | Submit verification documents | `fleetOwnerId` | `List<VerificationDocumentDTO>` |
| POST `/api/fleet-owners/{fleetOwnerId}/submit-verification` | Sends to the active Location Manager for the fleet owner's zone | `fleetOwnerId` | — |
| GET `/api/fleet-owners/{fleetOwnerId}/verification-status` | Current status | `fleetOwnerId` | — |

### VerificationQueueController — `/api/verification-queues`

`GET` needs only `authenticated()`; `POST`/`PUT`/`PATCH`/`DELETE` require SUPER_ADMIN or OPERATIONS_MANAGER.

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/verification-queues` | Create a queue entry | — | `VerificationQueueDTO` |
| GET `/api/verification-queues` | List all | — | — |
| GET `/api/verification-queues/{id}` | One entry | `id` | — |
| PUT `/api/verification-queues/{id}` | Update | `id` | `VerificationQueueDTO` |
| DELETE `/api/verification-queues/{id}` | Delete | `id` | — |
| POST `/api/verification-queues/{id}/process-result` | Records the Location Manager's decision (approve/reject) | `id` | `Map` (`result`, `reason`) |
| PATCH `/api/verification-queues/{id}/assign` | Assigns a reviewing officer | `id` | `AssignReviewerRequestDto` |
| GET `/api/verification-queues/subject/{subjectId}` | Entries for a retailer/fleet-owner | `subjectId` | — |
| GET `/api/verification-queues/status/{status}` | By status | `status` | — |
| GET `/api/verification-queues/active/{active}` | By active flag | `active` | — |

### VerificationDocumentController — `/api/verification-documents` — any authenticated role

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/verification-documents` | Create | — | `VerificationDocumentDTO` |
| GET `/api/verification-documents` | List all | — | — |
| GET `/api/verification-documents/{documentId}` | One document | `documentId` | — |
| PUT `/api/verification-documents/{documentId}` | Update | `documentId` | `VerificationDocumentDTO` |
| DELETE `/api/verification-documents/{documentId}` | Delete | `documentId` | — |
| GET `/api/verification-documents/queue/{verificationQueueId}` | Documents in a queue entry | `verificationQueueId` | — |
| GET `/api/verification-documents/status/{status}` | By status | `status` | — |
| GET `/api/verification-documents/current/{current}` | By `isCurrentVersion` | `current` | — |

### Internal endpoints (`/internal/v1/**`, HTTP Basic + `hasRole("SERVICE")`)

| Method + Path | Purpose |
|---|---|
| GET `/internal/v1/retailers/{id}` | Reduced retailer summary — consumed by S3 |
| GET `/internal/v1/retailers/by-user/{userAccountId}` | Resolve the retailer owned by a user account |
| GET `/internal/v1/fleet-owners/{id}/validation` | Fleet-owner validation view — consumed by S5 before onboarding a vehicle/driver |

---

## 5. S3 — Commerce & Customer

Owns `CustomerProfile`, `CustomerAddress`, `Product`, `ProductCategory`, `Review`, `Cart`/`CartItem`, `Wishlist`. Every success response is wrapped in an `ApiResponse` envelope (`data` holds the payload).

### CustomerController — `/api/v1/customers`

| Method + Path | Purpose | Params | Body | Auth |
|---|---|---|---|---|---|
| POST `/api/v1/customers` | Create a customer profile | — | `CreateCustomerRequest` | authenticated |
| GET `/api/v1/customers/me` | The caller's own profile | — | — | authenticated |
| GET `/api/v1/customers` | Staff search/list | `status`, `page`/`size` | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| PATCH `/api/v1/customers/me` | Update own profile | — | `UpdateCustomerRequest` | authenticated |
| DELETE `/api/v1/customers/me` | Deactivate own account | — | — | authenticated |

### AddressController — `/api/v1/customers/me/addresses` — authenticated

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `.../addresses` | Add an address (territory-validated against S1) | — | `AddressRequest` |
| GET `.../addresses/{id}` | One address | `id` | — |
| GET `.../addresses` | List, paged | `page`/`size` | — |
| PATCH `.../addresses/{id}` | Update | `id` | `AddressRequest` |
| DELETE `.../addresses/{id}` | Delete | `id` | — |
| GET `.../addresses/default` | The default address | — | — |
| PUT `.../addresses/{id}/default` | Mark as default | `id` | — |

### CartController — `/api/v1/cart` — authenticated

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| GET `/api/v1/cart` | Current cart | — | — |
| POST `/api/v1/cart/items` | Add item | — | `CartItemRequest` |
| PATCH `/api/v1/cart/items/{id}` | Change quantity | `id` | `CartItemRequest` |
| DELETE `/api/v1/cart/items/{id}` | Remove item | `id` | — |
| DELETE `/api/v1/cart` | Clear cart | — | — |
| POST `/api/v1/cart/validate` | Re-validate stock/pricing | — | — |
| POST `/api/v1/cart/items/{id}/move-to-wishlist` | Move item to wishlist | `id` | — |
| POST `/api/v1/cart/serviceability-check` | Re-checks every current cart line against a *candidate* delivery address (before it's saved as the default) — per-line `LineServiceabilityResult`, never silently drops a line | `CartServiceabilityRequest` (`addressId`) |

### WishlistController — `/api/v1/customers/me/wishlist-items` — authenticated

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `.../wishlist-items` | Add a product | — | `ReplaceWishlistProductRequest` |
| GET `.../wishlist-items/{id}` | One item | `id` | — |
| GET `.../wishlist-items` | List, paged | `page`/`size` | — |
| PATCH `.../wishlist-items/{id}` | Replace the referenced product | `id` | `ReplaceWishlistProductRequest` |
| DELETE `.../wishlist-items/{id}` | Remove | `id` | — |
| GET `.../wishlist-items/summary` | Summary stats | — | — |
| POST `.../wishlist-items/membership` | Bulk "is this product id in my wishlist" check | — | `List<Long>` |

### CheckoutController — `/api/v1/checkout` — authenticated

| Method + Path | Purpose | Body |
|---|---|---|
| POST `/api/v1/checkout/prepare` | Validates pricing/address/stock/tax and returns a checkout summary (calls S4 for serviceability, S6 for tax) | `CheckoutRequest` |

### ProductController — `/api/v1/products` — public GET

| Method + Path | Purpose | Params |
|---|---|---|
| GET `/api/v1/products` | Public discovery/search | `q`, `categoryId`, `retailerId`, `inStock` (opt), `page`/`size` |
| GET `/api/v1/products/{id}` | One product | `id` |
| GET `/api/v1/products/{id}/details` | Product + its rating summary combined | `id` |

Every `ProductResponse` (list and detail) now also carries `retailerName`/`retailerStatus`/`retailerLatitude`/`retailerLongitude` alongside `retailerId`, resolved via a batched S2 call — see `application-workflow.md` §7 S3. The retailer's own aggregate *rating* is deliberately not included here; fetch it lazily via `PublicRetailerController` below only when a shopper expands the shop card.

### PublicRetailerController — `/api/v1/retailers` — public GET (customer + retailer + staff readable)

| Method + Path | Purpose | Params |
|---|---|---|
| GET `/api/v1/retailers/{retailerId}` | Retailer identity/contact/location for the shop-detail-expander | `retailerId` |
| GET `/api/v1/retailers/{retailerId}/rating-summary` | Aggregate rating across every product the retailer sells | `retailerId` |

### CategoryController — `/api/v1/product-categories` — GET public, writes SUPER_ADMIN

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/v1/product-categories` | Create | — | `CategoryRequest` |
| GET `/api/v1/product-categories/{id}` | One category | `id` | — |
| GET `/api/v1/product-categories` | Search, paged | `q`, `status` (default ACTIVE), `page`/`size` | — |
| GET `/api/v1/product-categories/active` | All active categories | — | — |
| PATCH `/api/v1/product-categories/{id}` | Update | `id` | `CategoryRequest` |
| DELETE `/api/v1/product-categories/{id}` | Delete | `id` | — |

### CatalogueController — `/api/v1/retailers/me/products` — authenticated (retailer-scoped)

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `.../products` | Create a product in own catalogue | — | `ProductRequest` |
| GET `.../products/{id}` | One own product | `id` | — |
| GET `.../products` | Search own catalogue | `q`, `categoryId`, `status`, `inventoryStatus`, `page`/`size` | — |
| GET `.../products/summary` | Catalogue summary stats | — | — |
| PATCH `.../products/{id}` | Update | `id` | `ProductRequest` |
| POST `.../products/{id}/duplicate` | Clone a listing | `id` | — |
| DELETE `.../products/{id}` | Delete | `id` | — |

### InventoryController — `/api/v1/retailers/me/inventory` — authenticated

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| GET `.../inventory` | Search own inventory | `q`, `categoryId`, `inventoryStatus`, `page`/`size` | — |
| GET `.../inventory/summary` | Stock-level summary | — | — |
| POST `.../inventory/adjustments` | Apply a stock adjustment | — | `StockAdjustmentRequest` |

### ReviewController — `/api/v1/reviews` — GET public, writes authenticated

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/v1/reviews` | Create a review (eligibility-checked against S4) | — | `ReviewRequest` |
| GET `/api/v1/reviews/{id}` | One review | `id` | — |
| GET `/api/v1/reviews` | Search by product/rating | `productId`, `rating`, `page`/`size` | — |
| PATCH `/api/v1/reviews/{id}` | Update | `id` | `UpdateReviewRequest` |
| DELETE `/api/v1/reviews/{id}` | Delete | `id` | — |
| GET `/api/v1/reviews/products/{productId}/rating-summary` | Aggregate rating for a product | `productId` | — |

### Internal endpoint (`/api/v1/internal/**`, HTTP Basic + `hasRole("SERVICE")`)

| Method + Path | Purpose |
|---|---|
| GET `/api/v1/internal/customers/{customerProfileId}` | Customer profile + reward points lookup — consumed by S6 |

---

## 6. S4 — Order & Logistics

Owns `Order`, `OrderItem`, `Trip`, `LogisticsBookingDetail`. `customerProfileId` on an order is an unvalidated scalar FK from S3 by deliberate design — no per-owner check exists yet.

### OrderController — `/api/orders`

| Method + Path | Purpose | Params | Body | Auth |
|---|---|---|---|---|---|
| POST `/api/orders` | Create an order | — | `OrderDto` | authenticated |
| GET `/api/orders/{id}` | One order | `id` | — | authenticated |
| GET `/api/orders/{id}/tracking` | Tracking view — `displayStage`, `haltedState`, 9-step `steps[]` (see `application-workflow.md` §7 S4) | `id` | — | authenticated |
| POST `/api/orders/{id}/submit` | Moves a freshly-created order `NEW → WAITING_FOR_RETAILER`, starting the 10-minute retailer-response clock | `id` | — | authenticated |
| GET `/api/orders/mine` | Caller's own orders — exactly one of the two params | `customerProfileId` **or** `retailerId` | — | authenticated |
| GET `/api/orders/pending-fleet-assignment` | Orders in `FINDING_DELIVERY_PARTNER`, for a fleet owner's assignment inbox | — | — | authenticated |
| GET `/api/orders` | List all | — | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| PUT `/api/orders/{id}` | Update | `id` | `OrderDto` | authenticated |
| DELETE `/api/orders/{id}` | Delete | `id` | — | authenticated |

### RetailerOrderActionController — `/api/orders` — CUSTOMER, RETAILER, SUPER_ADMIN (ownership-checked in-controller)

| Method + Path | Purpose | Params | Body | Auth |
|---|---|---|---|---|---|
| POST `/api/orders/{id}/retailer-accept` | Retailer accepts — `WAITING_FOR_RETAILER → RETAILER_ACCEPTED`, triggers the nearest-fleet-partner search | `id` | — | acting user resolved from the JWT, must own the order's retailer |
| POST `/api/orders/{id}/retailer-reject` | Retailer rejects — `→ RETAILER_REJECTED` | `id` | `RetailerRejectRequest` (optional `reason`) | same ownership check |

### OrderItemController — `/api/order-items`

| Method + Path | Purpose | Params | Body | Auth |
|---|---|---|---|---|---|
| POST `/api/order-items` | Add a line item (price/name snapshotted live from S3) | — | `OrderItemDto` | authenticated |
| GET `/api/order-items/{id}` | One item | `id` | — | authenticated |
| GET `/api/order-items` | List all | — | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| PUT `/api/order-items/{id}` | Update | `id` | `OrderItemDto` | authenticated |
| DELETE `/api/order-items/{id}` | Delete | `id` | — | authenticated |

### TripController — `/api/trips`

| Method + Path | Purpose | Params | Body | Auth |
|---|---|---|---|---|---|
| POST `/api/trips` | Create a trip (assigns vehicle/driver, validates via S5) | — | `TripDto` | SUPER_ADMIN/OPERATIONS_MANAGER |
| GET `/api/trips/{id}` | One trip | `id` | — | authenticated |
| GET `/api/trips` | List all | — | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| PUT `/api/trips/{id}` | Generic state update | `id` | `TripDto` | SUPER_ADMIN/OPERATIONS_MANAGER |
| POST `/api/trips/{id}/pickup/arrived` | Driver-app: arrived at pickup (acknowledgement only) | `id` | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| POST `/api/trips/{id}/pickup/confirm` | Confirm pickup, optional proof | `id` | `TripProofRequest` (opt) | SUPER_ADMIN/OPERATIONS_MANAGER |
| POST `/api/trips/{id}/delivery/arrived` | Driver-app: arrived at delivery | `id` | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| POST `/api/trips/{id}/complete` | Complete delivery, optional proof | `id` | `TripProofRequest` (opt) | SUPER_ADMIN/OPERATIONS_MANAGER |
| DELETE `/api/trips/{id}` | Delete | `id` | — | SUPER_ADMIN/OPERATIONS_MANAGER |

### LogisticsBookingDetailController — `/api/logistics-bookings`

| Method + Path | Purpose | Params | Body | Auth |
|---|---|---|---|---|---|
| POST `/api/logistics-bookings` | Create a fleet-service booking (cost engine) | — | `LogisticsBookingDetailDto` | SUPER_ADMIN/OPERATIONS_MANAGER |
| GET `/api/logistics-bookings/{id}` | One booking | `id` | — | authenticated |
| GET `/api/logistics-bookings` | List all | — | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| PUT `/api/logistics-bookings/{id}` | Update | `id` | `LogisticsBookingDetailDto` | SUPER_ADMIN/OPERATIONS_MANAGER |
| DELETE `/api/logistics-bookings/{id}` | Delete | `id` | — | SUPER_ADMIN/OPERATIONS_MANAGER |

### Internal endpoints (`/api/v1/internal/**`, HTTP Basic + `hasRole("SERVICE")`)

| Method + Path | Purpose |
|---|---|
| POST `/api/v1/internal/delivery/serviceability-checks` | Retail delivery serviceability — **per-line** breakdown (`lines[]`) plus an aggregate flag/reason, flat ₹49 charge per serviceable line — consumed by S3 checkout and cart |
| GET `/api/v1/internal/orders/{orderId}/review-eligibility` | May this customer review this product on this order? — consumed by S3 |
| GET `/api/v1/internal/orders/{orderId}` | Order lookup for S6 (refunds/invoices/payments/support tickets) |
| GET `/api/v1/internal/orders/{orderId}/items` | Order line items for S6 |
| GET `/api/v1/internal/trips/by-order/{orderId}` | Trip lookup by order for S6 refunds |
| POST `/api/v1/internal/orders/{orderId}/payment-confirmed` | **New in the order-placement-and-fulfilment pass** — S6 calls this best-effort after capturing a payment, so S4 knows the (simulated) payment succeeded |

---

## 7. S5 — Fleet Operations

Owns `Driver`, `Vehicle`, `VehicleAssignment`, `FleetExpense`. Every create validates the fleet owner's standing directly against S2 (never trusts a client-asserted status).

### DriverController — `/api/drivers`

| Method + Path | Purpose | Params | Body | Auth |
|---|---|---|---|---|---|
| POST `/api/drivers` | Create a driver (fleet owner must be VERIFIED+ACTIVE in S2; license must not be expired) | — | `DriverDto` | SUPER_ADMIN/OPERATIONS_MANAGER |
| GET `/api/drivers/{id}` | One driver | `id` | — | authenticated |
| GET `/api/drivers` | List all | — | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| DELETE `/api/drivers/{id}` | Delete | `id` | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| GET `/api/drivers/available` | ACTIVE drivers with no active assignment | — | — | authenticated |
| PATCH `/api/drivers/{id}/status` | Change status | `id`; `status` (query) | — | SUPER_ADMIN/OPERATIONS_MANAGER |

### VehicleController — `/api/vehicles`

| Method + Path | Purpose | Params | Body | Auth |
|---|---|---|---|---|---|
| POST `/api/vehicles` | Create a vehicle (fleet owner must be ACTIVE/APPROVED/VERIFIED in S2) | — | `VehicleDto` | SUPER_ADMIN/OPERATIONS_MANAGER |
| GET `/api/vehicles/{id}` | One vehicle | `id` | — | authenticated |
| GET `/api/vehicles` | List all | — | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| DELETE `/api/vehicles/{id}` | Delete | `id` | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| GET `/api/vehicles/available` | ACTIVE vehicles with no active assignment | — | — | authenticated |
| PATCH `/api/vehicles/{id}/status` | Change status (blocked while an active assignment exists) | `id`; `status` (query) | — | SUPER_ADMIN/OPERATIONS_MANAGER |

### VehicleAssignmentController — `/api/assignments`

| Method + Path | Purpose | Params | Body | Auth |
|---|---|---|---|---|---|
| POST `/api/assignments` | Assign a vehicle+driver (both ACTIVE, same fleet owner, neither already assigned) | — | `VehicleAssignmentDto` | SUPER_ADMIN/OPERATIONS_MANAGER |
| GET `/api/assignments/{id}` | One assignment | `id` | — | authenticated |
| GET `/api/assignments` | List all | — | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| DELETE `/api/assignments/{id}` | Delete | `id` | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| GET `/api/assignments/active` | All ACTIVE assignments | — | — | authenticated |
| PATCH `/api/assignments/{id}/end` | End an assignment | `id` | — | SUPER_ADMIN/OPERATIONS_MANAGER |

### FleetExpenseController — `/api/expenses`

| Method + Path | Purpose | Params | Body | Auth |
|---|---|---|---|---|---|
| POST `/api/expenses` | Log an expense (fleet owner must be ACTIVE, positive amount, non-future date) | — | `FleetExpenseDto` | SUPER_ADMIN/OPERATIONS_MANAGER |
| GET `/api/expenses/{id}` | One expense | `id` | — | authenticated |
| GET `/api/expenses` | List (optionally by fleet owner) | `fleetOwnerId` (opt) | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| DELETE `/api/expenses/{id}` | Delete | `id` | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| PATCH `/api/expenses/{id}/approve` | Approve (blocks self-approval by the creator; approver taken from the JWT, not a query param) | `id` | — | SUPER_ADMIN/OPERATIONS_MANAGER |
| PATCH `/api/expenses/{id}/reject` | Reject | `id` | — | SUPER_ADMIN/OPERATIONS_MANAGER |

### Internal endpoints (`/internal/v1/**`, HTTP Basic + `hasRole("SERVICE")`)

| Method + Path | Purpose |
|---|---|
| GET `/internal/v1/drivers/{id}` | Driver lookup — consumed by S4 for trip assignment |
| GET `/internal/v1/vehicles/{id}` | Vehicle lookup — consumed by S4 |
| GET `/internal/v1/drivers/nearest-available` | **New in the order-placement-and-fulfilment pass** — `lat`/`lon`/`maxKm`, real haversine distance, ACTIVE + unassigned only — consumed by S4's `retailerAccept()` |
| GET `/internal/v1/vehicles/nearest-available` | **New in the order-placement-and-fulfilment pass** — same shape, for vehicles |

---

## 8. S6 — Finance & Support

Owns `PaymentTransaction`, `Settlement`, `CustomerInvoice`, `CustomerRefund`, `SupportTicket`, `TaxConfiguration`, `Notification`, `AuditLog`. **Entirely a back-office surface** — every endpoint, without exception, requires SUPER_ADMIN or OPERATIONS_MANAGER.

### PaymentTransactionController — `/api/payment-transactions`

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/payment-transactions` | Create (order must not be paid, payment method must match; amount derived from the order, never client-supplied) | — | `PaymentTransactionRequest` |
| GET `/api/payment-transactions` | List all | — | — |
| GET `/api/payment-transactions/{id}` | One transaction | `id` | — |
| POST `/api/payment-transactions/{id}/capture` | PENDING → SUCCESS, escrow HELD | `id` | — |
| POST `/api/payment-transactions/{id}/release-escrow` | HELD → RELEASED (requires SUCCESS+HELD) | `id` | — |
| POST `/api/payment-transactions/{id}/fail` | PENDING → FAILED | `id` | `Map` (`reason`, opt) |

No generic PUT — amount/order/method are immutable after creation; only status-transition actions exist.

### SettlementController — `/api/settlements`

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/settlements` | Create (payment must be SUCCESS/RELEASED, one settlement per payment, fee capped at gross) | — | `SettlementRequest` |
| GET `/api/settlements` | List all | — | — |
| GET `/api/settlements/{id}` | One settlement | `id` | — |
| PUT `/api/settlements/{id}` | Edit reference/date while PENDING | `id` | `SettlementUpdateRequest` |
| POST `/api/settlements/{id}/complete` | PENDING → COMPLETED | `id` | — |
| DELETE `/api/settlements/{id}` | Cancel while PENDING | `id` | — |

### CustomerInvoiceController — `/api/customer-invoices`

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/customer-invoices` | Create — recomputes subtotal from S4's order items, never trusts a client subtotal | — | `CustomerInvoiceRequest` |
| GET `/api/customer-invoices` | List all | — | — |
| GET `/api/customer-invoices/{id}` | One invoice | `id` | — |
| PUT `/api/customer-invoices/{id}` | Rebuild from the order again | `id` | `CustomerInvoiceRequest` |
| DELETE `/api/customer-invoices/{id}` | Delete | `id` | — |

### CustomerRefundController — `/api/customer-refunds`

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/customer-refunds` | Create — requires order DELIVERED + trip COMPLETED; amount capped at remaining refundable balance | — | `CustomerRefundRequest` |
| GET `/api/customer-refunds` | List all | — | — |
| GET `/api/customer-refunds/{id}` | One refund | `id` | — |
| PUT `/api/customer-refunds/{id}` | Edit reference/reason while REQUESTED | `id` | `CustomerRefundUpdateRequest` |
| POST `/api/customer-refunds/{id}/approve` | REQUESTED → APPROVED | `id` | — |
| POST `/api/customer-refunds/{id}/reject` | REQUESTED → REJECTED | `id` | `Map` (`reason`, opt) |
| POST `/api/customer-refunds/{id}/complete` | APPROVED → COMPLETED | `id` | — |
| DELETE `/api/customer-refunds/{id}` | Withdraw while REQUESTED | `id` | — |

### SupportTicketController — `/api/support-tickets`

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/support-tickets` | Create (validates order ownership if `orderId` given, raising account must be ACTIVE) | — | `SupportTicketRequest` |
| GET `/api/support-tickets` | List all | — | — |
| GET `/api/support-tickets/{id}` | One ticket | `id` | — |
| PUT `/api/support-tickets/{id}` | Edit subject/description/priority (blocked once CLOSED) | `id` | `SupportTicketUpdateRequest` |
| POST `/api/support-tickets/{id}/assign` | OPEN → IN_PROGRESS | `id` | `Map` (`supportAccountId`) |
| POST `/api/support-tickets/{id}/resolve` | IN_PROGRESS → RESOLVED | `id` | — |
| POST `/api/support-tickets/{id}/close` | RESOLVED → CLOSED | `id` | — |
| DELETE `/api/support-tickets/{id}` | Delete while OPEN | `id` | — |

### TaxConfigurationController — `/api/tax-configurations`

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/tax-configurations` | Create a GST slab for a state (state must be active in S1) | — | `TaxConfigurationRequest` |
| GET `/api/tax-configurations` | List all | — | — |
| GET `/api/tax-configurations/{id}` | One slab | `id` | — |
| PUT `/api/tax-configurations/{id}` | Update | `id` | `TaxConfigurationRequest` |
| DELETE `/api/tax-configurations/{id}` | Delete | `id` | — |

### NotificationController — `/api/notifications`

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/notifications` | Create (recipient must be ACTIVE) | — | `NotificationRequest` |
| GET `/api/notifications` | List all | — | — |
| GET `/api/notifications/{id}` | One notification | `id` | — |
| PUT `/api/notifications/{id}` | Full rebuild | `id` | `NotificationRequest` |
| PATCH `/api/notifications/{id}/read` | Mark read | `id` | — |
| PATCH `/api/notifications/read-all?userAccountId=` | Mark all of a recipient's notifications read | `userAccountId` | — |
| DELETE `/api/notifications/{id}` | Delete | `id` | — |

### AuditLogController — `/api/audit-logs` — write-once, no PUT/DELETE

| Method + Path | Purpose | Params | Body |
|---|---|---|---|
| POST `/api/audit-logs` | Record an audit entry | — | `AuditLogRequest` |
| GET `/api/audit-logs` | List all | — | — |
| GET `/api/audit-logs/{id}` | One entry | `id` | — |

### AnalyticsController — `/api/analytics`

| Method + Path | Purpose |
|---|---|
| GET `/api/analytics/overview` | Aggregate counts across payments/invoices/refunds/settlements/tickets/notifications/audit logs, plus total recorded payment amount |

### Internal endpoint (`/api/v1/internal/**`, HTTP Basic + `hasRole("SERVICE")`)

| Method + Path | Purpose |
|---|---|
| POST `/api/v1/internal/tax-calculations` | Computes subtotal/tax/total for a cart — consumed by S3's checkout flow. Falls back to a flat 18% GST when no matching state-level `TaxConfiguration` exists |

---

## 9. Internal (service-to-service) endpoints — quick reference

None of these are reachable through the Gateway. All use HTTP Basic with the shared `lbos-service` credential.

| Endpoint | Owning service | Consumed by |
|---|---|---|
| `GET /internal/v1/user-accounts/{id}` | S1 | S4 |
| `GET /internal/v1/operations-managers/resolve` | S1 | (available for any caller needing OM resolution) |
| `GET /internal/v1/operations-managers/city/{id}/active` | S1 | — |
| `GET /internal/v1/operations-managers/{id}/validate-city/{cityId}` | S1 | — |
| `GET /internal/v1/states/{id}` | S1 | S6 |
| `POST /internal/v1/territories/validate` | S1 | S3 |
| `POST /internal/v1/location-managers/{managerId}/verifications` | S1 | S2 |
| `GET /internal/v1/location-managers/active/by-zone/{zoneId}` | S1 | S2 |
| `GET /internal/v1/retailers/{id}` | S2 | S3 |
| `GET /internal/v1/retailers/by-user/{userAccountId}` | S2 | S3 |
| `GET /internal/v1/fleet-owners/{id}/validation` | S2 | S5 |
| `GET /api/v1/internal/customers/{customerProfileId}` | S3 | S6 |
| `POST /api/v1/internal/delivery/serviceability-checks` | S4 | S3 |
| `GET /api/v1/internal/orders/{orderId}/review-eligibility` | S4 | S3 |
| `GET /api/v1/internal/orders/{orderId}` | S4 | S6 |
| `GET /api/v1/internal/orders/{orderId}/items` | S4 | S6 |
| `GET /api/v1/internal/trips/by-order/{orderId}` | S4 | S6 |
| `GET /internal/v1/drivers/{id}` | S5 | S4 |
| `GET /internal/v1/vehicles/{id}` | S5 | S4 |
| `POST /api/v1/internal/tax-calculations` | S6 | S3 |

---

## 10. Known gaps (worth knowing, not blocking)

- **S2's `InternalFleetOwnerController.validate()`** populates both `profileStatus` and `verificationStatus` in its response from the same underlying field — `verificationStatus` isn't actually a distinct signal.
- **S4/S5 have no per-owner ("is this your order/fleet") authorization** beyond the coarse role checks above — deliberate, documented scope limitation, not an oversight.
- **S5 has no exception handler** — every business-rule violation or "not found" surfaces as a generic `500`, not `404`/`409`. Don't infer "server is broken" from a 500 on `/api/drivers`, `/api/vehicles`, `/api/assignments`, or `/api/expenses` — it usually means the request was invalid.
- **S6's internal tax calculation** uses a flat 18% GST fallback when no active `TaxConfiguration` matches, since the request only carries a `cityId` and there's no city→state resolution client wired up yet.
