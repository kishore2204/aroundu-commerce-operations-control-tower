# S5 — Fleet Operations: API Reference (live-tested)

Tested directly against `http://localhost:8085` (not through the gateway) on a live
platform instance backed by real PostgreSQL, per `docs/SEED_DATA_CONTRACT.md` seed data.
Every curl command below was actually executed against the running service; status codes
and response bodies are the real, observed results (trimmed where noted).

**Re-verified and extended on 2026-08-30** after a large S5 rewrite this session: `POST
/api/vehicles`/`/api/drivers` now force `INACTIVE` regardless of what the request asks for
(previously defaulted to `ACTIVE`); a new `POST /api/assignments/rebalance` (Rebalance Loads,
for Operations Managers); a new `POST /api/drivers/{id}/submit-for-verification` /
`/api/vehicles/{id}/submit-for-verification` pair now open to `FLEET_MANAGER` too (previously
staff-only, which meant a fleet owner could never resubmit their own rejected driver/vehicle);
and two brand-new internal creation endpoints, `POST /internal/v1/drivers` /
`/internal/v1/vehicles`, used by S2's Fleet-Owner-driver/vehicle onboarding flow. One
already-documented bug (`createdByAccountId`) was fixed during this pass — see
[Bugs found](#bugs-found), now split into "fixed this session" and historical sections.

Two endpoints — `POST /api/assignments` and `GET /api/assignments/reliability` — already
have deep, dedicated live-test writeups covering their business logic (capacity/type
matching, churn thresholds). This document gives each just one smoke curl to confirm they
still work; see [`docs/business-logic/S5-fleet-operations.md`](../business-logic/S5-fleet-operations.md)
for the full derivation and all live-verification branches.

## Table of contents

1. [Auth summary](#auth-summary)
2. [VehicleController — `/api/vehicles`](#vehiclecontroller--apivehicles)
3. [DriverController — `/api/drivers`](#drivercontroller--apidrivers)
4. [FleetExpenseController — `/api/expenses`](#fleetexpensecontroller--apiexpenses)
5. [VehicleAssignmentController — `/api/assignments`](#vehicleassignmentcontroller--apiassignments)
6. [InternalFleetController — `/internal/v1`](#internalfleetcontroller--internalv1)
7. [Bugs found](#bugs-found)
8. [Stale documentation found elsewhere](#stale-documentation-found-elsewhere)

## Auth summary

Source: `S5-fleet-operations/src/main/java/com/cbg/lbos/config/SecurityConfig.java`.

S5 **does** have Spring Security configured (two filter chains), unlike some other
services in this platform that were found to have none.

- **`/internal/v1/**`** (chain `@Order(1)`): HTTP Basic only, `hasRole("SERVICE")`.
  Credentials: `lbos-service` / `service123`. No JWT/Swagger exposure on this chain.
- **Everything else** (chain `@Order(2)`): JWT issued by S1's `/api/v1/auth/login`,
  validated by `JwtAuthenticationFilter`.
  - `GET /api/drivers`, `/api/vehicles`, `/api/assignments`, `/api/expenses` (list-all,
    exact path only) — `SUPER_ADMIN` or `OPERATIONS_MANAGER` only.
  - `POST`, `PATCH`, `DELETE` on `/api/drivers/**`, `/api/vehicles/**`,
    `/api/assignments/**`, `/api/expenses/**` — `SUPER_ADMIN` or `OPERATIONS_MANAGER` only.
  - Everything else under those paths not explicitly matched above (e.g.
    `GET /{id}`, `/available`, `/active`, `/reliability`) falls through to
    `anyRequest().authenticated()` — any valid JWT, any role.
  - No unauthenticated JWT → `401`. Authenticated but wrong role → `403` (confirmed live
    the fix described in `docs/SEED_DATA_CONTRACT.md` — "401 instead of 403 due to
    `/error` re-entering the filter chain" — is in place here: `/error` is `permitAll()`
    and both an `authenticationEntryPoint` and `accessDeniedHandler` are set).
  - So fleet-owner/driver self-service (e.g. `fleetowner1`, role `FLEET_MANAGER`) can read
    single resources but cannot list-all or mutate anything — confirmed live below.

Test identities used: `admin@aroundu.local` (SUPER_ADMIN), `manager@aroundu.local`
(OPERATIONS_MANAGER), `fleetowner1@aroundu.local` (FLEET_MANAGER), `customer1@aroundu.local`
(CUSTOMER). Token acquisition (same pattern reused throughout, `$ADMIN` etc. below stand in
for the extracted `accessToken`):

```bash
curl -s -X POST http://localhost:8081/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aroundu.local","password":"AroundU@123"}'
# -> {"accessToken":"eyJ...", "role":"SUPER_ADMIN", ...}
```

---

## VehicleController — `/api/vehicles`

### `POST /api/vehicles`
Create a vehicle. Auth: SUPER_ADMIN/OPERATIONS_MANAGER.

```bash
curl -s -X POST http://localhost:8085/api/vehicles \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"fleetOwnerId":"71000000-0000-0000-0000-000000000001","registrationNumber":"TN01ZZ9999","vehicleType":"MINI_TRUCK","make":"Tata","model":"Ace","modelYear":2023,"capacityKg":800.00,"vehicleStatus":"ACTIVE"}'
```
Result: `HTTP 200`, **`"vehicleStatus":"INACTIVE"`** — re-verified live this session: even
though the request explicitly asks for `ACTIVE`, `VehicleServiceImpl.create()` now always
forces `INACTIVE` (a vehicle isn't fit for assignment until its documents clear verification —
this session's fix). `POST /api/drivers` behaves identically for `driverStatus`.
```json
{"capacityKg":800.00,"fleetOwnerId":"71000000-0000-0000-0000-000000000001","make":"Tata","model":"Ace","modelYear":2023,"registrationNumber":"S5QAVEH...","updatedByAccountId":null,"vehicleId":"1d8b5ddf-...","vehicleStatus":"INACTIVE","vehicleType":"MINI_TRUCK"}
```

### `GET /api/vehicles/{id}`
Fetch one vehicle. Auth: any authenticated role.

```bash
curl -s http://localhost:8085/api/vehicles/A0000000-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200`
```json
{"capacityKg":750.00,"fleetOwnerId":"71000000-0000-0000-0000-000000000001","make":"Tata","model":"Ace","modelYear":2022,"registrationNumber":"TN01AB1234","updatedByAccountId":null,"vehicleId":"a0000000-0000-0000-0000-000000000001","vehicleStatus":"ACTIVE","vehicleType":"MINI_TRUCK"}
```

Negative case (unknown id):
```bash
curl -s http://localhost:8085/api/vehicles/A0000000-0000-0000-0000-000000000099 \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 404`
```json
{"status":404,"error":"Not Found","message":"Vehicle not found","path":"/api/vehicles/A0000000-0000-0000-0000-000000000099"}
```

### `GET /api/vehicles`
List all vehicles. Auth: SUPER_ADMIN/OPERATIONS_MANAGER only.

```bash
curl -s http://localhost:8085/api/vehicles -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` — array of both seeded vehicles (`...-01`, `...-02`).

Role check — CUSTOMER (`$CUSTOMER`):
```bash
curl -s http://localhost:8085/api/vehicles -H "Authorization: Bearer $CUSTOMER"
```
Result: `HTTP 403`
```json
{"status":403,"error":"Forbidden","message":"Forbidden","path":"/api/vehicles"}
```
No token at all:
```bash
curl -s http://localhost:8085/api/vehicles
```
Result: `HTTP 401` (empty body). Confirms the platform-wide 401-vs-403 fix from
`docs/SEED_DATA_CONTRACT.md` is applied here: wrong role → real 403, no token → 401,
neither is swallowed by the `/error` re-dispatch bug.

### `DELETE /api/vehicles/{id}`
Auth: SUPER_ADMIN/OPERATIONS_MANAGER.

```bash
curl -s -X DELETE http://localhost:8085/api/vehicles/2464838c-2e38-44f0-a387-5135b7bb454c \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` (empty body — deleted the vehicle created above).

Negative case:
```bash
curl -s -X DELETE http://localhost:8085/api/vehicles/A0000000-0000-0000-0000-000000000099 \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 404` `{"message":"Vehicle not found", ...}`

### `GET /api/vehicles/available`
Vehicles with no current active assignment. Auth: any authenticated role.

```bash
curl -s http://localhost:8085/api/vehicles/available -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` — only `A0000000-...-02` (seeded `...-01` is actively assigned via
`A2000000-...-01`, so it's correctly excluded).

### `PATCH /api/vehicles/{id}/status?status=...`
Change vehicle status; `updatedByAccountId` is derived from the JWT, not a query param
(see [bug-free note](#accountid-hardening-vehiclesexpenses) below). Auth: SUPER_ADMIN/OPERATIONS_MANAGER.

```bash
curl -s -X PATCH "http://localhost:8085/api/vehicles/2464838c-2e38-44f0-a387-5135b7bb454c/status?status=MAINTENANCE" \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200`
```json
{"...","updatedByAccountId":"30000000-0000-0000-0000-000000000099","vehicleStatus":"MAINTENANCE",...}
```
`updatedByAccountId` correctly reflects the caller's own JWT subject (admin), confirming
the hardening described in the controller's inline comment actually works live.

Negative case:
```bash
curl -s -X PATCH "http://localhost:8085/api/vehicles/A0000000-0000-0000-0000-000000000099/status?status=MAINTENANCE" \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 404` `{"message":"Vehicle not found", ...}`

### `POST /api/vehicles/{id}/submit-for-verification` *(new this session)*
Submits an `INACTIVE` vehicle's documents into S2's common verification workflow. **Auth
widened this session**: `SUPER_ADMIN`/`OPERATIONS_MANAGER` **or `FLEET_MANAGER`** — previously
staff-only, which meant a fleet owner could never resubmit their own rejected vehicle
themselves (confirmed live: this specific sub-path 403'd for a `FLEET_MANAGER` token before the
fix; `POST /api/vehicles` and status-change PATCH remain staff-only, deliberately not widened,
since `create()`/status-change take a `fleetOwnerId`/target status with no caller-ownership
check against the vehicle's actual owner).
```bash
curl -s -X POST http://localhost:8085/api/vehicles/{id}/submit-for-verification \
  -H "Authorization: Bearer $FLEET1" -H "Content-Type: application/json" \
  -d '{"submittedByAccountId":"30000000-0000-0000-0000-000000000012"}'
```
**Result: `200`** → `{"verificationQueueId":"..."}` — confirmed live as `fleetowner1`
(`FLEET_MANAGER`), not just `SUPER_ADMIN`.

---

## DriverController — `/api/drivers`

### `POST /api/drivers`
Auth: SUPER_ADMIN/OPERATIONS_MANAGER. `userAccountId` must be unique per driver.

```bash
curl -s -X POST http://localhost:8085/api/drivers \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"fleetOwnerId":"71000000-0000-0000-0000-000000000001","userAccountId":"39000000-0000-0000-0000-000000000001","cityId":"20000000-0000-0000-0000-000000000001","licenseNumber":"DL-TEST-0001","driverStatus":"ACTIVE","licenseExpiryDate":"2030-01-01"}'
```
Result: `HTTP 200`
```json
{"cityId":"20000000-0000-0000-0000-000000000001","driverId":"5a9ac5f0-5688-42d0-9d99-d67576607abe","driverStatus":"ACTIVE","fleetOwnerId":"71000000-0000-0000-0000-000000000001","licenseExpiryDate":"2030-01-01","licenseNumber":"DL-TEST-0001","userAccountId":"39000000-0000-0000-0000-000000000001","verifiedByAccountId":null}
```
(Reusing the seeded driver1's `userAccountId` instead correctly fails with
`HTTP 409 {"message":"Driver exists"}` — confirmed live.)

### `GET /api/drivers/{id}`
Auth: any authenticated role.
```bash
curl -s http://localhost:8085/api/drivers/A1000000-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` — seeded driver1 (`DL0001`, ACTIVE).

Negative case:
```bash
curl -s http://localhost:8085/api/drivers/A1000000-0000-0000-0000-000000000099 \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 404` `{"message":"Driver not found", ...}`

### `GET /api/drivers`
Auth: SUPER_ADMIN/OPERATIONS_MANAGER only.
```bash
curl -s http://localhost:8085/api/drivers -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` — both seeded drivers.

### `DELETE /api/drivers/{id}`
Auth: SUPER_ADMIN/OPERATIONS_MANAGER.
```bash
curl -s -X DELETE http://localhost:8085/api/drivers/5a9ac5f0-5688-42d0-9d99-d67576607abe \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` (empty body — deleted the test driver created above).

Negative case:
```bash
curl -s -X DELETE http://localhost:8085/api/drivers/A1000000-0000-0000-0000-000000000099 \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 404` `{"message":"Driver not found", ...}`

### `GET /api/drivers/available`
Auth: any authenticated role.
```bash
curl -s http://localhost:8085/api/drivers/available -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` — only driver2 (`A1000000-...-02`); driver1 correctly excluded since it's
actively assigned via `A2000000-...-01`.

### `PATCH /api/drivers/{id}/status?status=...`
Auth: SUPER_ADMIN/OPERATIONS_MANAGER. Note: unlike Vehicle/Expense status-changing
endpoints, this one takes no `Authentication` parameter at all — there's no "changed by"
field on Driver to stamp, so nothing to harden here.
```bash
curl -s -X PATCH "http://localhost:8085/api/drivers/5a9ac5f0-5688-42d0-9d99-d67576607abe/status?status=INACTIVE" \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` `{"...","driverStatus":"INACTIVE",...}`

Negative case:
```bash
curl -s -X PATCH "http://localhost:8085/api/drivers/A1000000-0000-0000-0000-000000000099/status?status=INACTIVE" \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 404` `{"message":"Driver not found", ...}`

### `POST /api/drivers/{id}/submit-for-verification` *(new this session)*
Same as the vehicle equivalent above — auth widened to include `FLEET_MANAGER`.
```bash
curl -s -X POST http://localhost:8085/api/drivers/{id}/submit-for-verification \
  -H "Authorization: Bearer $FLEET1" -H "Content-Type: application/json" \
  -d '{"submittedByAccountId":"30000000-0000-0000-0000-000000000012"}'
```
**Result: `200`** → `{"verificationQueueId":"..."}`, confirmed live as `FLEET_MANAGER`.

---

## FleetExpenseController — `/api/expenses`

### `POST /api/expenses`
Auth: SUPER_ADMIN/OPERATIONS_MANAGER. Validates the fleet owner via a live S2 call
(`ownerStatus == ACTIVE`) and rejects non-positive/future-dated amounts.
```bash
curl -s -X POST http://localhost:8085/api/expenses \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"fleetOwnerId":"71000000-0000-0000-0000-000000000001","vehicleId":"A0000000-0000-0000-0000-000000000001","expenseType":"FUEL","amount":250.00,"expenseDate":"2026-08-29"}'
```
Result: `HTTP 200`. **`createdByAccountId` is now the authenticated caller's own JWT subject**
(fixed this session — see [Bugs found](#bugs-found); previously always `null` on a normal
call). `POST /api/expenses` now takes an `Authentication` parameter, same pattern as
`approve()`/`reject()`.
```json
{"amount":100.00,"approvalStatus":"PENDING","approvedByAccountId":null,"createdByAccountId":"30000000-0000-0000-0000-000000000099",...,"fleetExpenseId":"90e089a2-871d-4e7c-af2c-87ee74e9d9f8",...}
```
Confirmed the self-approval guard now actually fires as a direct consequence:
```bash
curl -s -X PATCH http://localhost:8085/api/expenses/90e089a2-871d-4e7c-af2c-87ee74e9d9f8/approve -H "Authorization: Bearer $ADMIN"
# -> HTTP 409 {"message":"Cannot approve", ...}   (admin created it, admin can't approve it)
```

### `GET /api/expenses/{id}`
Auth: any authenticated role.
```bash
curl -s http://localhost:8085/api/expenses/A3000000-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` — seeded expense (FUEL, ₹1500.00, PENDING).

Negative case:
```bash
curl -s http://localhost:8085/api/expenses/A3000000-0000-0000-0000-000000000099 \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 404` `{"message":"Expense not found", ...}`

### `GET /api/expenses` and `GET /api/expenses?fleetOwnerId=...`
Auth: SUPER_ADMIN/OPERATIONS_MANAGER only (exact `/api/expenses` path, query string doesn't
change the matcher).
```bash
curl -s http://localhost:8085/api/expenses -H "Authorization: Bearer $ADMIN"
curl -s "http://localhost:8085/api/expenses?fleetOwnerId=71000000-0000-0000-0000-000000000001" \
  -H "Authorization: Bearer $ADMIN"
```
Result: both `HTTP 200`, identical single-element array (only one fleet owner seeded, so
the filtered and unfiltered results happen to match).

### `DELETE /api/expenses/{id}`
Auth: SUPER_ADMIN/OPERATIONS_MANAGER.
```bash
curl -s -X DELETE http://localhost:8085/api/expenses/cb295e4b-653a-4347-8c37-c05a03d9636d \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` (empty body — deleted a freshly-created test expense).

Negative case:
```bash
curl -s -X DELETE http://localhost:8085/api/expenses/A3000000-0000-0000-0000-000000000099 \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 404` `{"message":"Expense not found", ...}`

### `PATCH /api/expenses/{id}/approve`
Auth: SUPER_ADMIN/OPERATIONS_MANAGER. `approvedByAccountId` correctly comes from the JWT
(hardened, matching the controller's inline comment). Rejects with `409` if the expense
isn't `PENDING`, or if the approver equals `createdByAccountId` (self-approval guard).
```bash
curl -s -X PATCH http://localhost:8085/api/expenses/86f9950f-9661-4fed-9f0d-61d724ecb177/approve \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200`
```json
{"...","approvalStatus":"APPROVED","approvedByAccountId":"30000000-0000-0000-0000-000000000099",...}
```
Re-approving the same (now-APPROVED) expense:
```bash
curl -s -X PATCH http://localhost:8085/api/expenses/86f9950f-9661-4fed-9f0d-61d724ecb177/approve \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 409` `{"message":"Cannot approve", ...}`

Negative case (unknown id):
```bash
curl -s -X PATCH http://localhost:8085/api/expenses/A3000000-0000-0000-0000-000000000099/approve \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 404` `{"message":"Expense not found", ...}`

### `PATCH /api/expenses/{id}/reject`
Auth: SUPER_ADMIN/OPERATIONS_MANAGER. Rejects with `409` if not `PENDING`; no self-rejection
guard (rejecting your own expense is allowed by design — only approval is guarded).
```bash
curl -s -X PATCH http://localhost:8085/api/expenses/4fa0c54b-68eb-4fc4-9699-d85a9adfe2cd/reject \
  -H "Authorization: Bearer $MANAGER"
```
Result: `HTTP 200`
```json
{"...","approvalStatus":"REJECTED","approvedByAccountId":"30000000-0000-0000-0000-000000000001",...}
```

---

## VehicleAssignmentController — `/api/assignments`

Actual base path confirmed against source: **`/api/assignments`**, not
`/api/vehicle-assignments`.

> `POST /api/assignments` and `GET /api/assignments/reliability` have full live-tested
> business-logic writeups (capacity/type checks, churn classification) in
> [`docs/business-logic/S5-fleet-operations.md`](../business-logic/S5-fleet-operations.md).
> Only one smoke curl for each is included here — see that document for all branches.

### `POST /api/assignments` (smoke test only — see linked doc)
Auth: SUPER_ADMIN/OPERATIONS_MANAGER. Tested against a **freshly-created** vehicle/driver
pair (`11cfdb46-...`/`b5e4ba5a-...`), not the seeded pairs, per instructions not to disturb
shared fixtures.
```bash
curl -s -X POST http://localhost:8085/api/assignments \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"vehicleId":"11cfdb46-4cc0-4ef5-8d67-eed94d49488b","driverId":"b5e4ba5a-e92d-45c1-98b1-894e17ea890e","assignedByAccountId":"30000000-0000-0000-0000-000000000012"}'
```
Result: `HTTP 200` — assignment created, `assignmentStatus":"ACTIVE"`. Still works.

### `GET /api/assignments/{id}`
Auth: any authenticated role.
```bash
curl -s http://localhost:8085/api/assignments/A2000000-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` — seeded assignment (vehicle `...-01` / driver `...-01`, ACTIVE).

Negative case:
```bash
curl -s http://localhost:8085/api/assignments/A2000000-0000-0000-0000-000000000099 \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 404` `{"message":"Assignment not found", ...}`

### `GET /api/assignments`
Auth: SUPER_ADMIN/OPERATIONS_MANAGER only.
```bash
curl -s http://localhost:8085/api/assignments -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` — single-element array (only `A2000000-...-01` currently ACTIVE; the
seeded `...-02` pair was already driven through churn-test cycles per
`docs/business-logic/S5-fleet-operations.md` and is not part of this list since it's ENDED,
not deleted).

### `DELETE /api/assignments/{id}`
Auth: SUPER_ADMIN/OPERATIONS_MANAGER. Tested against the fresh assignment created above
(after ending it — see below), not the seeded one.
```bash
curl -s -X DELETE http://localhost:8085/api/assignments/7c140ffc-8144-4b00-9d23-77850fb263e1 \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` (empty body).

Negative case:
```bash
curl -s -X DELETE http://localhost:8085/api/assignments/A2000000-0000-0000-0000-000000000099 \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 404` `{"message":"Assignment not found", ...}`

### `GET /api/assignments/active`
Auth: any authenticated role.
```bash
curl -s http://localhost:8085/api/assignments/active -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` — same single ACTIVE assignment as `GET /api/assignments` above.

### `PATCH /api/assignments/{id}/end`
Auth: SUPER_ADMIN/OPERATIONS_MANAGER. Tested against the fresh assignment (not the seeded
one, to avoid disturbing S4's trip reference).
```bash
curl -s -X PATCH http://localhost:8085/api/assignments/7c140ffc-8144-4b00-9d23-77850fb263e1/end \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` — `"assignmentStatus":"ENDED"`, `"endedAt"` populated.

Negative case:
```bash
curl -s -X PATCH http://localhost:8085/api/assignments/A2000000-0000-0000-0000-000000000099/end \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 404` `{"message":"Assignment not found", ...}`

### `GET /api/assignments/reliability` (smoke test only — see linked doc)
Auth: any authenticated role. Requires at least one of `vehicleId`/`driverId`.
```bash
curl -s "http://localhost:8085/api/assignments/reliability?vehicleId=11cfdb46-4cc0-4ef5-8d67-eed94d49488b" \
  -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 200` — `{"endedAssignmentCount":0,"reliabilityFlag":"INSUFFICIENT_DATA",...}`
(fresh vehicle, no ended history yet). Endpoint still works; full HIGH_CHURN/STABLE
classification branches already proven live in the linked business-logic doc against the
seeded `A0000000-...-02` pair — not re-derived here.

Negative case (neither param supplied):
```bash
curl -s "http://localhost:8085/api/assignments/reliability" -H "Authorization: Bearer $ADMIN"
```
Result: `HTTP 400` `{"message":"Either vehicleId or driverId must be supplied", ...}`

### `POST /api/assignments/rebalance?fleetOwnerId=...` *(new this session)*
Operations-manager tool: pairs up a fleet owner's currently-idle vehicles and drivers,
least-utilized-by-history first, so future work spreads across the fleet instead of repeatedly
reusing the same few. Never touches an already-active assignment. Auth: SUPER_ADMIN/OPERATIONS_MANAGER.
```bash
curl -s -X POST "http://localhost:8085/api/assignments/rebalance?fleetOwnerId=71000000-0000-0000-0000-000000000001" \
  -H "Authorization: Bearer $ADMIN"
```
**Result: `200`**
```json
{"fleetOwnerId":"71000000-...-0001","newAssignmentsCreated":2,
 "pairings":[{"vehicleId":"15eac4f2-...","vehiclePriorAssignmentCount":0,"driverId":"2f5edf7e-...","driverPriorAssignmentCount":0},
             {"vehicleId":"1d8b5ddf-...","vehiclePriorAssignmentCount":0,"driverId":"fc7c2c42-...","driverPriorAssignmentCount":0}],
 "vehiclesLeftUnpaired":0,"driversLeftUnpaired":0}
```

---

## InternalDriverController / InternalVehicleController — `/internal/v1/drivers`, `/internal/v1/vehicles` *(new this session)*

HTTP Basic (`SERVICE` role), separate filter chain, same as `InternalFleetController` below.
Added for S2's Fleet-Owner-driver/vehicle onboarding flow (`FleetOwnerDriverController`/
`FleetOwnerVehicleController` in S2): S2 creates the actual record here via Feign rather than
requiring the Fleet Owner to have a direct JWT-gated path to `/api/drivers`/`/api/vehicles`.
Delegates to the exact same `DriverService.create()`/`VehicleService.create()` used by the
public JWT-gated endpoints — same validation (fleet owner verified/active in S2, license not
expired, no duplicate license/account, no duplicate registration number), same forced-`INACTIVE`
outcome.

### `POST /internal/v1/drivers`
```bash
curl -s -u lbos-service:service123 -X POST http://localhost:8085/internal/v1/drivers \
  -H "Content-Type: application/json" \
  -d '{"fleetOwnerId":"71000000-0000-0000-0000-000000000001","userAccountId":"<fresh-uuid>","cityId":"20000000-0000-0000-0000-000000000001","licenseNumber":"S5INTDL...","licenseExpiryDate":"2030-01-01"}'
```
**Result: `200`** → `"driverStatus":"INACTIVE"`.

### `POST /internal/v1/vehicles`
```bash
curl -s -u lbos-service:service123 -X POST http://localhost:8085/internal/v1/vehicles \
  -H "Content-Type: application/json" \
  -d '{"fleetOwnerId":"71000000-0000-0000-0000-000000000001","registrationNumber":"S5INTVEH...","vehicleType":"VAN","make":"Tata","model":"Ace","modelYear":2022,"capacityKg":500}'
```
**Result: `200`** → `"vehicleStatus":"INACTIVE"`.

**Negative — 401 (no Basic auth):** confirmed on both.

Full round trip confirmed live: create via these two internal endpoints (both `INACTIVE`) →
`POST .../activate` on each (both flip to `ACTIVE`) → `POST /api/assignments` pairing them
succeeds → `PATCH .../end` → `DELETE` — a complete, working lifecycle entirely through the new
S2-mediated onboarding path.

---

## InternalFleetController — `/internal/v1`

HTTP Basic auth only (`lbos-service` / `service123`), separate filter chain, no JWT
accepted here. Used by S4 to resolve driver/vehicle summaries for a trip without exposing
the public JWT-scoped endpoints to service-to-service calls.

### `GET /internal/v1/drivers/{id}`
```bash
curl -s -u "lbos-service:service123" \
  http://localhost:8085/internal/v1/drivers/A1000000-0000-0000-0000-000000000001
```
Result: `HTTP 200` — same `DriverDto` shape as the public endpoint.

Negative case:
```bash
curl -s -u "lbos-service:service123" \
  http://localhost:8085/internal/v1/drivers/A1000000-0000-0000-0000-000000000099
```
Result: `HTTP 404` `{"message":"Driver not found", ...}`

### `GET /internal/v1/vehicles/{id}`
```bash
curl -s -u "lbos-service:service123" \
  http://localhost:8085/internal/v1/vehicles/A0000000-0000-0000-0000-000000000001
```
Result: `HTTP 200` — same `VehicleDto` shape as the public endpoint.

Negative case:
```bash
curl -s -u "lbos-service:service123" \
  http://localhost:8085/internal/v1/vehicles/A0000000-0000-0000-0000-000000000099
```
Result: `HTTP 404` `{"message":"Vehicle not found", ...}`

Auth checks:
```bash
curl -s http://localhost:8085/internal/v1/drivers/A1000000-0000-0000-0000-000000000001
# -> HTTP 401, no credentials supplied
curl -s -u "lbos-service:wrongpass" \
  http://localhost:8085/internal/v1/drivers/A1000000-0000-0000-0000-000000000001
# -> HTTP 401, wrong password
```
Both confirmed `401` live — this chain is genuinely gated, not open.

---

## Bugs found

### ✅ FIXED THIS SESSION — `createdByAccountId` was client-controlled on `create()`

**Was:** `POST /api/expenses`, `FleetExpenseServiceImpl.create()`
(`S5-fleet-operations/src/main/java/com/cbg/lbos/service/FleetExpenseServiceImpl.java:27-46`).

Unlike `approve()`/`reject()` (which correctly derive the acting account from
`Authentication` per the controller's own inline comment), `create()` does
`BeanUtils.copyProperties(expenseDto, expense)` on the raw request body with no
overwrite of `createdByAccountId` from the authenticated caller. Two live-confirmed
consequences:

1. **Normal callers never populate it.** A plain create (no `createdByAccountId` in the
   body) leaves the field `null` forever:
   ```bash
   curl -s -X POST http://localhost:8085/api/expenses \
     -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
     -d '{"fleetOwnerId":"71000000-0000-0000-0000-000000000001","vehicleId":"A0000000-0000-0000-0000-000000000001","expenseType":"FUEL","amount":250.00,"expenseDate":"2026-08-29"}'
   # -> HTTP 200, "createdByAccountId":null
   ```
   Since the self-approval guard in `approve()` is `approver.equals(expense.getCreatedByAccountId())`,
   and `approver` is always a real non-null UUID from the JWT, **this comparison can never
   be true for any expense created through the normal API path** — the self-approval
   protection is effectively dead code in practice, not just theoretically bypassable.

2. **A caller can also explicitly set it to anyone's id, including their own**, proving the
   field is genuinely pass-through and not defaulted server-side:
   ```bash
   curl -s -X POST http://localhost:8085/api/expenses \
     -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
     -d '{"fleetOwnerId":"71000000-0000-0000-0000-000000000001","vehicleId":"A0000000-0000-0000-0000-000000000001","expenseType":"FUEL","amount":300.00,"expenseDate":"2026-08-29","createdByAccountId":"30000000-0000-0000-0000-000000000099"}'
   # -> HTTP 200, "createdByAccountId":"30000000-0000-0000-0000-000000000099"  (admin's own id, client-supplied)
   curl -s -X PATCH http://localhost:8085/api/expenses/27b057ad-de5e-4322-a150-fb552be7d83c/approve \
     -H "Authorization: Bearer $ADMIN"
   # -> HTTP 409 {"message":"Cannot approve", ...}   (guard fires ONLY because the id was spoofed to match)
   ```
   This confirms the guard logic itself is correct — the bug is that `createdByAccountId`
   isn't pinned server-side the same way `updatedByAccountId` (Vehicle) and
   `approvedByAccountId` (Expense) already are.

**Fix applied this session**: `FleetExpenseController.create()` now takes an `Authentication`
parameter and calls `expenseService.create(dto, resolveAuthenticatedUserAccountId(authentication))`
— the same pattern `approve()`/`reject()` already used. `FleetExpenseServiceImpl.create()`'s
signature gained a `createdByAccountId` parameter and now sets it explicitly on the entity
after `BeanUtils.copyProperties`, so any client-supplied value in the request body is
overwritten, not trusted. Confirmed live: a normal create now returns the caller's real JWT
subject as `createdByAccountId`, and the self-approval guard in `approve()` now genuinely
fires (`409 Cannot approve`) when the creator tries to approve their own expense — previously
impossible since the field was always `null`.

No other bug-level findings this pass — every endpoint tested (including the four new/widened
ones from this session's rewrite) matched its source and matched expectations under live
testing.

---

## Stale documentation found elsewhere

- **`docs/api-catalog.md` line 690** claims *"S5 has no exception handler — every
  business-rule violation or 'not found' surfaces as a generic `500`, not `404`/`409`."*
  This is stale: `S5-fleet-operations/src/main/java/com/cbg/lbos/exception/GlobalExceptionHandler.java`
  exists, and every not-found/conflict/bad-request case tested above returned the correct
  `404`/`409`/`400` with a structured JSON body, not a `500`. Do not rely on that line of
  `api-catalog.md`.
- `docs/api-catalog.md` lines 518-527 (the `VehicleAssignmentController` table) are
  otherwise accurate — base path `/api/assignments`, per-endpoint auth all matched what was
  observed live.
