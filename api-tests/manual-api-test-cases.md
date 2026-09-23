# Manual API Test Cases

All requests go through the API Gateway at `http://localhost:8080` unless a test case explicitly says "direct-to-service" (used only when isolating a single service during development). See `docs/running-the-project.md` for how to start the stack and bootstrap a first account, and `docs/api-catalog.md` for the full endpoint reference these tests exercise.

**Conventions used below:**
- `{token}` = the `accessToken` from a prior successful login step in the same scenario — never a hardcoded/fake token.
- `{id}` placeholders are always filled from a *previous step's response* in the same test case, never invented.
- Every authenticated request needs `Authorization: Bearer {token}`.

---

## Part 1 — Platform-level tests

### TEST-PLATFORM-001 — Eureka registry is reachable

| | |
|---|---|
| Prerequisite | Eureka started (`scripts/start-all.cmd` or manually) |
| Step | `GET http://localhost:8761/actuator/health` |
| Expected status | `200` |
| Expected response | `{"status":"UP", ...}` |

### TEST-PLATFORM-002 — Gateway rejects unauthenticated requests

| | |
|---|---|
| Prerequisite | Gateway + at least one downstream service running |
| Step | `GET http://localhost:8080/api/v1/products` (no `Authorization` header) |
| Expected status | `401` |

### TEST-PLATFORM-003 — Gateway rejects a valid token on the wrong role's route

| | |
|---|---|
| Prerequisite | A logged-in CUSTOMER token (see TEST-AUTH-002) |
| Step | `GET http://localhost:8080/api/vehicles` with `Authorization: Bearer {customerToken}` |
| Expected status | `403` (CUSTOMER is not in the FLEET_MANAGER/SUPER_ADMIN allowed-role set for `/api/vehicles/**`) |

---

## Part 2 — Authentication (S1)

### TEST-AUTH-001 — Login with wrong password

| | |
|---|---|
| Endpoint | `POST /api/v1/auth/login` |
| Headers | `Content-Type: application/json` |
| Body | `{"email":"an-existing-account@example.com","password":"definitely-wrong"}` |
| Expected status | `401` |
| Expected response | `{"status":401, "message":"Invalid email or password", ...}` |

### TEST-AUTH-002 — Login success

| | |
|---|---|
| Prerequisite | A real, ACTIVE `UserAccount` row with a known password (see `running-the-project.md` §8 for bootstrap) |
| Endpoint | `POST /api/v1/auth/login` |
| Body | `{"email":"<real-email>","password":"<real-password>"}` |
| Expected status | `200` |
| Expected response | `{"accessToken":"eyJ...", "tokenType":"Bearer", "expiresInSeconds":3600, "userAccountId":"<uuid>", "email":"<real-email>", "role":"<ROLE>"}` |
| DB expectation | The account's `last_login_at` column is updated to approximately now |

### TEST-AUTH-003 — Resolve current user identity

| | |
|---|---|
| Prerequisite | TEST-AUTH-002 |
| Endpoint | `GET /api/v1/users/me` with `Authorization: Bearer {token}` |
| Expected status | `200` |
| Expected response | The same account's full `UserAccountResponseDto`, with `id` matching TEST-AUTH-002's `userAccountId` |

---

## Part 3 — Geography & user management (S1)

### TEST-S1-001 — List states

| Endpoint | `GET /api/states` | Roles | SUPER_ADMIN | Expected | `200`, array of states |

### TEST-S1-002 — Create a city under a state

| | |
|---|---|
| Prerequisite | TEST-S1-001 to get a real `stateId`; SUPER_ADMIN token |
| Endpoint | `POST /api/v1/cities` |
| Body | `{"stateId":"{stateId}","cityName":"Test City","isActive":true}` |
| Expected status | `201` |
| Expected response | New `CityDtos.Response` with a generated `id` |
| Failure case | Repeat the same request with an *inactive* state's id → `422` (`InvalidAssignmentException`) |

### TEST-S1-003 — Location manager can read cities but not manage operations managers

| | |
|---|---|
| Prerequisite | A LOCATION_MANAGER token |
| Step 1 | `GET /api/v1/cities` → expect `200` |
| Step 2 | `GET /api/v1/operations-managers` → expect `403` |

---

## Part 4 — Partner onboarding & verification (S2)

### TEST-S2-001 — Register a retailer

| | |
|---|---|
| Endpoint | `POST /api/retailers/register` |
| Roles | RETAILER, LOCATION_MANAGER, OPERATIONS_MANAGER, SUPER_ADMIN |
| Body | `{"userAccountId":"{uuid}","cityId":"{uuid}","businessName":"Test Kirana Store", ...}` |
| Expected status | `201` |
| Expected response | Retailer with `retailerStatus:"PENDING_VERIFICATION"` |

### TEST-S2-002 — Submit documents and request verification

| | |
|---|---|
| Prerequisite | TEST-S2-001's `retailerId` |
| Step 1 | `POST /api/retailers/{retailerId}/documents` with a document list body → `200` |
| Step 2 | `POST /api/retailers/{retailerId}/submit-verification` → `200`, retailer/queue status becomes `SENT_TO_LOCATION_MANAGER` |
| Step 3 | `GET /api/retailers/{retailerId}/verification-status` → reflects the current queue status |

### TEST-S2-003 — Location manager assigns a reviewer, then approves

| | |
|---|---|
| Prerequisite | A pending `VerificationQueue` entry (from TEST-S2-002); LOCATION_MANAGER token |
| Step 1 | `PATCH /api/verification-queues/{queueId}/assign` body `{"reviewerAccountId":"{locationManagerAccountId}"}` → `200`, `reviewedByAccountId` set |
| Step 2 | `POST /api/verification-queues/{queueId}/process-result` body `{"result":"APPROVED","reason":"Documents verified"}` → `200` |
| DB expectation | Queue status → `VERIFIED`/`APPROVED`; retailer's `retailerStatus` → `VERIFIED` |

---

## Part 5 — Commerce & customer (S3)

### TEST-S3-001 — Browse products

| Endpoint | `GET /api/v1/products?page=0&size=10` | Roles | CUSTOMER, RETAILER, SUPER_ADMIN | Expected | `200`, `PageResponse<ProductResponse>` with only `ACTIVE` products |

### TEST-S3-002 — Add to cart, validate, checkout-prepare

| | |
|---|---|
| Prerequisite | TEST-S3-001's `productId`; CUSTOMER token; a saved address (create via `POST /api/v1/customers/me/addresses` first if none exists) |
| Step 1 | `POST /api/v1/cart/items` body `{"productId":{id},"quantity":2}` → `201` |
| Step 2 | `POST /api/v1/cart/validate` → `200`, confirms stock still sufficient |
| Step 3 | `POST /api/v1/checkout/prepare` body `{"addressId":"{addressId}"}` |
| **Expected status — as of this pass** | `500` (or a connection-level Feign failure), **not** `200`. This step calls S4's `POST /api/v1/internal/delivery/serviceability-checks`, which is a **confirmed, live gap — S4 does not implement that endpoint** (see `docs/feign-dependencies.md` and `docs/api-catalog.md` §9). Document this as the current expected (broken) result, not as a test failure on your part — this is a genuine backend gap to fix before the checkout screen can work end to end. |
| Downstream calls exercised | S3 → S4 (delivery serviceability — currently fails), S3 → S6 (tax — works) — see `docs/feign-dependencies.md` |

### TEST-S3-003 — Stock cannot go negative

| | |
|---|---|
| Prerequisite | A product with `stock=1` |
| Step | `POST /api/v1/cart/items` body `{"productId":{id},"quantity":5}` |
| Expected status | `422` (`InsufficientStockException`) |

---

## Part 6 — Order & logistics (S4) — cross-service tests

### TEST-S4-S3-001 — Create a retail order item referencing a real S3 product

**Scenario**: prove S4's `OrderItemService` genuinely calls S3 via Feign (`ProductClient`) rather than trusting client-supplied price/name data.

| Step | Action |
|---|---|
| 1 | `GET /api/v1/products` (S3) → note a real `productId`, its `unitPrice`, and `sku` |
| 2 | `POST /api/orders` (S4) with `customerProfileId`, `orderType:"RETAIL"`, minimal required fields → `201`, note `orderId` |
| 3 | `POST /api/order-items` (S4) body `{"orderId":{orderId},"retailerId":"{uuid}","productId":{productId},"quantity":2}` |
| 4 | Verify (via S4 → S3 Feign, transparent to the caller) that the response's `skuSnapshot`/`productNameSnapshot`/`unitPrice` match what step 1 observed on S3 — NOT any value the test client tried to supply |
| Expected status | `201` |
| Expected DB result | New `order_item` row with the S3-sourced snapshot fields, not client-supplied ones |
| Failure scenario to also test | Repeat step 3 with a `productId` that doesn't exist on S3 → expect a not-found error (S3 returns 404, S4 propagates as its own not-found exception type) |

### TEST-S4-S5-001 — Create a trip; verify S4 → S5 vehicle/driver validation

| | |
|---|---|
| Prerequisite | A registered, ACTIVE vehicle and driver on S5 (same `fleetOwnerId`), an order with `orderType:"FLEET_SERVICE"` |
| Step | `POST /api/trips` body with `orderId`, `vehicleId`, `driverId`, `fleetOwnerId`, `createdByAccountId` |
| Expected status | `201`, `tripStatus:"PLANNED"` |
| Failure case | Same request with a vehicle that is `INACTIVE` on S5 → expect a validation error (S4 fetched the vehicle's real status via `VehicleClient`, not a client-asserted one) |
| Failure case | Vehicle and driver with *different* `fleetOwnerId` values → expect a validation error (fleet-owner mismatch check) |

### TEST-S4-001 — Order tracking

| Endpoint | `GET /api/orders/{orderId}/tracking` | Expected | `200`, `{orderId, orderNumber, orderStatus, orderTrackingJson, updatedDatetime}` |

### TEST-S4-002 — Trip lifecycle: pickup confirm → complete

| | |
|---|---|
| Prerequisite | A trip in `ASSIGNED` status (TEST-S4-S5-001) |
| Step 1 | `POST /api/trips/{tripId}/pickup/confirm` body `{"proof":"<photo-url-or-note>"}` → `200`, `tripStatus:"IN_PROGRESS"` |
| Step 2 | `POST /api/trips/{tripId}/complete` body `{"proof":"<delivery-photo-url>"}` → `200`, `tripStatus:"COMPLETED"` |
| Failure case | Call `/complete` on a trip still `PLANNED` (skipping `IN_PROGRESS`) → expect `400` (invalid transition, reusing `TripService`'s existing state-machine validation) |

---

## Part 7 — Fleet operations (S5)

### TEST-S5-001 — Register a vehicle (requires S2 fleet-owner approval)

| | |
|---|---|
| Prerequisite | A fleet owner on S2 with `profileStatus`/`ownerStatus`/verification all in the approved state |
| Endpoint | `POST /api/vehicles` |
| Failure case first | Same request against a fleet owner still `PENDING` on S2 → expect a validation error (S5 → S2 Feign check, live) |
| Success case | Approved fleet owner → `201`, `vehicleStatus:"ACTIVE"` |

### TEST-S5-002 — Assign driver to vehicle; double-booking is rejected

| | |
|---|---|
| Prerequisite | An ACTIVE vehicle and ACTIVE driver, same fleet owner, driver verified on S2 |
| Step 1 | `POST /api/assignments` → `201` |
| Step 2 | Repeat step 1 with the *same* vehicle and a *different* driver → expect a conflict/validation error (vehicle already has an active assignment) |

### TEST-S5-003 — Filter expenses by fleet owner

| Endpoint | `GET /api/expenses?fleetOwnerId={id}` | Expected | `200`, only that owner's expenses (verify against an unfiltered `GET /api/expenses` call returning a superset) |

---

## Part 8 — Finance, support & engagement (S6)

### TEST-S6-S4-001 — Create a payment transaction for a real order

**Scenario**: prove S6 validates against S4's real order state.

| Step | Action |
|---|---|
| 1 | Note an `orderId` from Part 6 with `paymentStatus` not yet `PAID` |
| 2 | `POST /api/payment-transactions` body `{"orderId":{orderId},"paymentMethod":"UPI"}` |
| Expected status | `201`, `paymentStatus:"PENDING"`, `escrowStatus:"NOT_HELD"`, `amount` matching the order's real total (fetched live from S4) |
| Failure case | Repeat against an order S4 already reports as `PAID` → expect a business-rule rejection |

### TEST-S6-002 — Refund requires a delivered order + completed trip

| | |
|---|---|
| Prerequisite | An order/trip NOT yet `DELIVERED`/`COMPLETED` |
| Step | `POST /api/customer-refunds` referencing that order |
| Expected status | Business-rule rejection (`422`-family) — refund is only allowed post-delivery |

### TEST-S6-003 — Notification read-tracking

| | |
|---|---|
| Prerequisite | At least one notification exists for a user (created via `POST /api/notifications`) |
| Step 1 | `PATCH /api/notifications/{id}/read` → `200`, `read:true` |
| Step 2 | `PATCH /api/notifications/read-all?userAccountId={id}` → `200`, all of that user's notifications now `read:true` |

---

## Part 9 — End-to-end role journeys

### E2E-CUSTOMER — retail shopping through to tracking

```text
1. POST /api/v1/auth/login                              → token
2. GET  /api/v1/products?q=rice                          → pick a product
3. POST /api/v1/cart/items                                → add to cart
4. POST /api/v1/checkout/prepare                          → currently FAILS, see TEST-S3-002 (confirmed S4 gap)
5. POST /api/orders                          (S4)         → order created
6. POST /api/order-items                     (S4)         → item added (S4→S3 Feign)
7. POST /api/payment-transactions            (S6)         → payment created (S6→S4 Feign)
8. GET  /api/orders/{id}/tracking            (S4)         → tracking status
```
Expected end state: `201`s on every creation step 5-7, final tracking call returns `200` with a live `orderStatus`. Step 4 is a **known, confirmed exception to this** — see TEST-S3-002 above; steps 5 onward do not actually depend on step 4 succeeding (S4/S6 don't consume checkout-prepare's output), so the rest of the journey is still testable independently.

### E2E-LOGISTICS — book a vehicle through to delivery

```text
1. POST /api/v1/auth/login                                → token
2. POST /api/orders            {"orderType":"FLEET_SERVICE"} (S4)
3. POST /api/logistics-bookings                             (S4) → cost computed
4. GET  /api/vehicles/available                             (S5)
5. GET  /api/drivers/available                               (S5)
6. POST /api/trips              {vehicleId, driverId, ...}   (S4) → S4→S5 validation
7. POST /api/trips/{id}/pickup/confirm                       (S4)
8. POST /api/trips/{id}/complete                             (S4)
9. POST /api/settlements                                     (S6, OPERATIONS_MANAGER)
```

### E2E-RETAILER — onboarding through to settlement

```text
1. POST /api/retailers/register                              (S2)
2. POST /api/retailers/{id}/documents                        (S2)
3. POST /api/retailers/{id}/submit-verification               (S2)
4. [as LOCATION_MANAGER] PATCH /api/verification-queues/{id}/assign
5. [as LOCATION_MANAGER] POST /api/verification-queues/{id}/process-result  → APPROVED
6. [as RETAILER] POST /api/v1/retailers/me/products            (S3) → add product
7. [as RETAILER] GET  /api/v1/retailers/me/products/summary    (S3)
8. [as RETAILER] GET  /api/settlements?...                     (S6)
```

### E2E-LOCATION_MANAGER — verification queue

```text
1. POST /api/v1/auth/login                        → LOCATION_MANAGER token
2. GET  /api/verification-queues?status=PENDING   (S2)
3. GET  /api/verification-documents?verificationQueueId={id}  (S2)
4. PATCH /api/verification-queues/{id}/assign     (S2)
5. POST /api/verification-queues/{id}/process-result  (S2)  → APPROVED or REJECTED
```

### E2E-OPERATIONS_MANAGER — dashboard sweep

```text
1. POST /api/v1/auth/login                         → OPERATIONS_MANAGER token
2. GET  /api/v1/operations-managers/summary         (S1)
3. GET  /api/verification-queues                    (S2)
4. GET  /api/settlements                             (S6)
5. GET  /api/tax-configurations                      (S6)
6. GET  /api/audit-logs                              (S6)
```

### E2E-FLEET_MANAGER — fleet operations sweep

```text
1. POST /api/v1/auth/login                         → FLEET_MANAGER token
2. GET  /api/drivers                                (S5)
3. GET  /api/vehicles                               (S5)
4. GET  /api/assignments/active                     (S5)
5. GET  /api/trips                                  (S4)
6. GET  /api/expenses?fleetOwnerId={id}             (S5)
```

### E2E-SUPER_ADMIN — master dashboard sweep

```text
1. POST /api/v1/auth/login                          → SUPER_ADMIN token
2. GET  /api/user-accounts                           (S1)
3. GET  /api/retailers                               (S2)
4. GET  /api/fleet-owners                            (S2)
5. GET  /api/orders                                  (S4)
6. GET  /api/payment-transactions                    (S6)
7. GET  /api/support-tickets                         (S6)
8. GET  /api/audit-logs                              (S6)
```

---

## Part 10 — What's NOT covered above (documented gaps, not test failures)

- No test case exists for password reset/forgot-password (feature doesn't exist — see `frontend-integration-guide.md` §5).
- No test case exists for token refresh (feature doesn't exist).
- No test proves per-resource ownership enforcement on S2/S4/S5/S6 (because it isn't enforced there yet — see `architecture.md` §10). Tests above only prove role-level access, not "can RETAILER A see RETAILER B's data" (they currently can, if they know/guess the ID).
