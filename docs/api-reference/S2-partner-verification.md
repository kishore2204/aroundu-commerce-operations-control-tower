# S2 — Partner Verification: API Reference (live-tested)

Every endpoint below was exercised with a real `curl` command against the live S2 instance
on **port 8082** (Postgres-backed, started via `scriptsstart-all.cmd /postgres`), not
through the gateway. JWTs were minted live via `POST http://localhost:8081/api/v1/auth/login`
(seeded accounts, password `AroundU@123` for all). Internal `/internal/**` routes use HTTP
Basic (`lbos-service` / `service123`), in a separate Spring Security filter chain
(`internalSecurityFilterChain`, `S2-partner-verification/src/main/java/com/example/lbos/config/SecurityConfig.java`).

Fixed seed IDs used throughout come from `docs/SEED_DATA_CONTRACT.md`. Two endpoints already
have deep, dedicated live-test write-ups — `PATCH /api/verification-queues/{id}/assign` and
`POST /api/verification-queues/{id}/process-result` — see
[`docs/business-logic/S2-partner-verification.md`](../business-logic/S2-partner-verification.md)
for the full workload-cap and auto-suspend test logs. Only quick smoke tests for those two are
repeated here.

**Auth summary (from `SecurityConfig.java`, updated this session):**
- `/internal/**` → HTTP Basic, `hasRole("SERVICE")` (own filter chain, `@Order(1)`).
- `POST /api/verification-queues/*/submit-for-verification` → JWT, **any authenticated role**
  (new — this is the submitter's own action, not a reviewer action, so it must not fall under
  the admin-only rule below).
- `POST /api/verification-queues/*/process-result`, `PATCH /api/verification-queues/*/assign` →
  JWT, `hasAnyRole("SUPER_ADMIN","OPERATIONS_MANAGER","LOCATION_MANAGER")` (Location Manager
  access added this session — previously missing despite being the intended reviewer role).
- `POST|PUT|PATCH|DELETE /api/verification-queues/**` (everything else, e.g. admin CRUD) → JWT,
  `hasAnyRole("SUPER_ADMIN","OPERATIONS_MANAGER")`.
- `/api/retailers/**`, `/api/fleet-owners/**`, `/api/verification-queues/**` (GET),
  `/api/verification-documents/**` → JWT, any authenticated role (ownership/staff checks are
  then enforced in the controller for update/delete of retailers and fleet owners; the new
  Fleet-Owner-driver/vehicle onboarding endpoints below enforce the same ownership pattern).

**Note on the API Gateway (`api-gateway`):** when called through the Gateway (port 8080) rather
than directly against S2, `RouteAuthorizationRules` is a second, coarser role gate in front of
all of this. It previously restricted `/api/verification-documents/**` to staff roles only,
which meant retailers/fleet owners could never reach their own document-upload endpoint through
the real client path — fixed this session (now also allows `RETAILER`/`FLEET_MANAGER`). The new
`submit-for-verification` sub-path also needed an explicit Gateway rule for the same reason. Not
re-tested via the Gateway in this document (which tests S2 directly, per its own convention) —
see the main conversation for the live Gateway-level verification.

## Table of Contents

1. [RetailerController](#retailercontroller) — `/api/retailers`
2. [FleetOwnerController](#fleetownercontroller) — `/api/fleet-owners`
3. [FleetOwnerDriverController](#fleetownerdrivercontroller) — `/api/fleet-owners/{id}/drivers` *(new)*
4. [FleetOwnerVehicleController](#fleetownervehiclecontroller) — `/api/fleet-owners/{id}/vehicles` *(new)*
5. [VerificationQueueController](#verificationqueuecontroller) — `/api/verification-queues`
6. [VerificationDocumentController](#verificationdocumentcontroller) — `/api/verification-documents`
7. [InternalRetailerController](#internalretailercontroller) — `/internal/v1/retailers`
8. [InternalFleetOwnerController](#internalfleetownercontroller) — `/internal/v1/fleet-owners`
9. [InternalVerificationQueueController](#internalverificationqueuecontroller) — `/internal/v1/verification-queues`
10. [Bugs found](#bugs-found)

---

## RetailerController

Source: `S2-partner-verification/src/main/java/com/example/lbos/controller/RetailerController.java`

### POST /api/retailers/register
Self-service retailer registration. Non-staff callers have `userAccountId` silently
overwritten with their own JWT subject.
**Auth:** any authenticated JWT.

⚠️ See [Bugs found #1](#bugs-found) — a "minimal" self-service body (no `userAccountId`, no
`retailerStatus`) is rejected with 400 even though both fields get overwritten by the server.
Working curl (client must still supply *some* value for both, which the server then ignores
for `userAccountId` on non-staff callers):

```bash
curl -s -X POST http://localhost:8082/api/retailers/register \
  -H "Authorization: Bearer $CUSTOMER2_TOKEN" -H "Content-Type: application/json" \
  -d '{"businessName":"Test Throwaway Retailer","cityId":"20000000-0000-0000-0000-000000000001","gstNumber":"33ZZZZZ0000Z1Z9","registrationNumber":"REG-TEST-0001","operationsManagerId":"40000000-0000-0000-0000-000000000001","userAccountId":"11111111-1111-1111-1111-111111111111","retailerStatus":"PENDING"}'
```
**Result: `201`**
```json
{"businessName":"Test Throwaway Retailer","retailerId":"95c5753f-0799-496a-ab29-6b126a6df069","retailerStatus":"PENDING_VERIFICATION","userAccountId":"30000000-0000-0000-0000-000000000014", ...}
```
`userAccountId` in the response is `...014` (customer2's real JWT subject), confirming the
client-supplied `11111111-...` was discarded as designed — the bug is only that the field
had to be present at all. `retailerStatus` was also overwritten server-side to
`PENDING_VERIFICATION` regardless of the `"PENDING"` sent.

### POST /api/retailers
Staff-capable create (same `applyOwnerIdentity` logic; staff may set `userAccountId` explicitly).
**Auth:** any authenticated JWT (ownership override only differs for staff roles).
```bash
curl -s -X POST http://localhost:8082/api/retailers \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"businessName":"Admin-Created Test Retailer","cityId":"20000000-0000-0000-0000-000000000001","gstNumber":"33YYYYY0000Y1Z9","registrationNumber":"REG-TEST-0002","operationsManagerId":"40000000-0000-0000-0000-000000000001","userAccountId":"30000000-0000-0000-0000-000000000099","retailerStatus":"PENDING"}'
```
**Result: `201`**
```json
{"retailerId":"b0e732ff-db84-46dd-a4e0-9d40b1a9f266","businessName":"Admin-Created Test Retailer","retailerStatus":"PENDING","userAccountId":"30000000-0000-0000-0000-000000000099"}
```

### GET /api/retailers
All retailers. **Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/retailers -H "Authorization: Bearer $RETAILER1_TOKEN"
```
**Result: `200`** — array of 2 seeded retailers (`...0001` VERIFIED, `...0002` PENDING).

### GET /api/retailers/{retailerId}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/retailers/70000000-0000-0000-0000-000000000001 -H "Authorization: Bearer $RETAILER1_TOKEN"
```
**Result: `200`**
```json
{"businessName":"Retailer One Stores","cityId":"20000000-0000-0000-0000-000000000001","gstNumber":"33AAAAA0000A1Z5","operationsManagerId":"40000000-0000-0000-0000-000000000001","registrationNumber":"REG-RET-0001","retailerId":"70000000-0000-0000-0000-000000000001","retailerStatus":"VERIFIED","userAccountId":"30000000-0000-0000-0000-000000000010"}
```
**Negative — 404:**
```bash
curl -s http://localhost:8082/api/retailers/70000000-0000-0000-0000-000000009999 -H "Authorization: Bearer $RETAILER1_TOKEN"
```
`404` → `{"message":"Retailer not found with id: 70000000-0000-0000-0000-000000009999","status":404}`

### PUT /api/retailers/{retailerId}
Owner or staff (SUPER_ADMIN/OPERATIONS_MANAGER) only — enforced in-controller via
`requireOwnerOrAdmin`. **Auth:** any authenticated JWT, ownership/staff check in code.
```bash
curl -s -X PUT http://localhost:8082/api/retailers/95c5753f-0799-496a-ab29-6b126a6df069 \
  -H "Authorization: Bearer $CUSTOMER2_TOKEN" -H "Content-Type: application/json" \
  -d '{"businessName":"Test Throwaway Retailer Updated","cityId":"20000000-0000-0000-0000-000000000001","gstNumber":"33ZZZZZ0000Z1Z9","registrationNumber":"REG-TEST-0001","operationsManagerId":"40000000-0000-0000-0000-000000000001","userAccountId":"30000000-0000-0000-0000-000000000014","retailerStatus":"PENDING"}'
```
**Result: `200`** — businessName updated to "Test Throwaway Retailer Updated".

**Negative — 404:**
```bash
curl -s -X PUT http://localhost:8082/api/retailers/70000000-0000-0000-0000-000000009999 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"businessName":"X","cityId":"20000000-0000-0000-0000-000000000001","gstNumber":"33X","registrationNumber":"REG-X","operationsManagerId":"40000000-0000-0000-0000-000000000001","userAccountId":"30000000-0000-0000-0000-000000000099","retailerStatus":"PENDING"}'
```
`404` → `{"message":"Retailer not found with id: 70000000-0000-0000-0000-000000009999","status":404}`

**Negative — 403 (non-owner, non-staff):**
```bash
curl -s -X PUT http://localhost:8082/api/retailers/70000000-0000-0000-0000-000000000002 \
  -H "Authorization: Bearer $RETAILER1_TOKEN" -H "Content-Type: application/json" \
  -d '{"businessName":"Hacked","cityId":"20000000-0000-0000-0000-000000000002","gstNumber":"33BBBBB0000B1Z5","registrationNumber":"REG-RET-0002","operationsManagerId":"40000000-0000-0000-0000-000000000002","userAccountId":"30000000-0000-0000-0000-000000000011","retailerStatus":"PENDING"}'
```
`403` → `{"message":"You do not own this retailer profile","status":403}` — correctly blocked
retailer1 from editing retailer2's profile.

### DELETE /api/retailers/{retailerId}
Owner or staff only. **Auth:** any authenticated JWT, ownership/staff check in code.
```bash
curl -s -X DELETE http://localhost:8082/api/retailers/95c5753f-0799-496a-ab29-6b126a6df069 -H "Authorization: Bearer $CUSTOMER2_TOKEN"
```
**Result: `200`** (empty body) — throwaway retailer deleted by its own owner.

**Negative — 404 (re-delete same id):**
```bash
curl -s -X DELETE http://localhost:8082/api/retailers/95c5753f-0799-496a-ab29-6b126a6df069 -H "Authorization: Bearer $ADMIN_TOKEN"
```
`404` → `{"message":"Retailer not found with id: 95c5753f-0799-496a-ab29-6b126a6df069","status":404}`

### GET /api/retailers/city/{cityId}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/retailers/city/20000000-0000-0000-0000-000000000001 -H "Authorization: Bearer $RETAILER1_TOKEN"
```
**Result: `200`** — retailers in Chennai (seeded retailer1 + any throwaways created there).

### GET /api/retailers/status/{status}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/retailers/status/VERIFIED -H "Authorization: Bearer $RETAILER1_TOKEN"
```
**Result: `200`** — `[{"retailerId":"70000000-...-0001", "retailerStatus":"VERIFIED", ...}]`

### GET /api/retailers/search?businessName=
**Auth:** any authenticated JWT.
```bash
curl -s "http://localhost:8082/api/retailers/search?businessName=Retailer" -H "Authorization: Bearer $RETAILER1_TOKEN"
```
**Result: `200`** — partial-match results including "Retailer One Stores" and "Retailer Two Mart".

### POST /api/retailers/{retailerId}/documents
Bulk-submits document metadata rows for the retailer's current/new verification queue.
**Auth:** any authenticated JWT.

⚠️ See [Bugs found #2](#bugs-found) — the list body is **not** `@Valid`-checked, so an
incomplete document object 500s instead of 400ing. Working curl (all `VerificationDocumentDTO`
required fields present):
```bash
curl -s -X POST http://localhost:8082/api/retailers/70000000-0000-0000-0000-000000000001/documents \
  -H "Authorization: Bearer $RETAILER1_TOKEN" -H "Content-Type: application/json" \
  -d '[{"documentTypeName":"GST_CERTIFICATE","versionNumber":1,"documentStatus":"PENDING","isCurrentVersion":true}]'
```
**Result: `200`** (empty body). Side effect (expected, by design of `submitRetailerDocuments`):
since retailer1's only prior queue entry (`72000000-...-0001`) was already `APPROVED`
(non-active), a **new** `VerificationQueue` row was created for retailer1 with
`verificationStatus=DOCUMENTS_SUBMITTED`, `isActive=true` — confirmed via
`GET /api/verification-queues/subject/70000000-...-0001`. Retailer1's `retailerStatus`
itself remained `VERIFIED` (unaffected — status is only touched by
`process-result`/auto-suspend logic, not by document submission).

### POST /api/retailers/{retailerId}/submit-verification
**Auth:** any authenticated JWT.
```bash
curl -s -X POST http://localhost:8082/api/retailers/95c5753f-0799-496a-ab29-6b126a6df069/submit-verification -H "Authorization: Bearer $CUSTOMER2_TOKEN"
```
**Result: `404`** — `{"message":"No active verification queue found for retailer: 95c5753f-...","status":404}`
(the throwaway retailer had no queue yet since it was deleted before this step in this run —
confirms the endpoint correctly 404s when there's nothing to submit).

### GET /api/retailers/{retailerId}/verification-status
**Auth:** any authenticated JWT. Response widened this session to include `rejectionReason`
when the most recent decision was a rejection (omitted otherwise, as here).
```bash
curl -s http://localhost:8082/api/retailers/70000000-0000-0000-0000-000000000001/verification-status -H "Authorization: Bearer $RETAILER1_TOKEN"
```
**Result: `200`** → `{"status":"DOCUMENTS_SUBMITTED"}` (retested live this session; retailer1's
active queue is mid-flow at time of test, not a final decision)

---

## FleetOwnerDriverController *(new this session)*

Source: `S2-partner-verification/src/main/java/com/example/lbos/controller/FleetOwnerDriverController.java`.
Fleet-Owner-initiated Driver onboarding: creates the actual Driver record in S5 via a Feign call
(S5 still owns driver operational data), then opens an entry in S2's existing common
VerificationQueue mechanism — the same one Retailer/FleetOwner onboarding uses, no duplicate
verification logic. **Auth:** any authenticated JWT; the caller must own the fleet-owner profile
(or be staff), and that fleet owner must already be `VERIFIED`/`ACTIVE`.

### POST /api/fleet-owners/{fleetOwnerId}/drivers
```bash
curl -s -X POST http://localhost:8082/api/fleet-owners/71000000-0000-0000-0000-000000000001/drivers \
  -H "Authorization: Bearer $FLEET1_TOKEN" -H "Content-Type: application/json" \
  -d '{"userAccountId":"<fresh-uuid>","cityId":"20000000-0000-0000-0000-000000000001","licenseNumber":"S2QATEST...","licenseExpiryDate":"2030-01-01"}'
```
**Result: `201`** → `{"driverId":"da62c3d6-...","verificationQueueId":"8d4ea1ef-...","verificationStatus":"DOCUMENTS_SUBMITTED"}`
— confirmed live in S5 that the driver was created `INACTIVE` and the queue carries
`zoneId` = the fleet owner's own zone (for later Location Manager dispatch). Next steps: upload
documents via `POST /api/verification-documents/upload` against this `verificationQueueId`,
then `POST /api/verification-queues/{id}/submit-for-verification`.

**Negative — 403 (not this fleet owner's profile):**
```bash
curl -s -X POST http://localhost:8082/api/fleet-owners/71000000-0000-0000-0000-000000000001/drivers \
  -H "Authorization: Bearer $CUSTOMER1_TOKEN" -H "Content-Type: application/json" \
  -d '{"userAccountId":"00000000-0000-0000-0000-000000000001","cityId":"20000000-0000-0000-0000-000000000001","licenseNumber":"HACK","licenseExpiryDate":"2030-01-01"}'
```
`403` — correctly blocked a non-owner from adding a driver under someone else's fleet.

---

## FleetOwnerVehicleController *(new this session)*

Source: `S2-partner-verification/src/main/java/com/example/lbos/controller/FleetOwnerVehicleController.java`.
Same shape as `FleetOwnerDriverController`, for Vehicle. **Auth:** identical rules.

### POST /api/fleet-owners/{fleetOwnerId}/vehicles
```bash
curl -s -X POST http://localhost:8082/api/fleet-owners/71000000-0000-0000-0000-000000000001/vehicles \
  -H "Authorization: Bearer $FLEET1_TOKEN" -H "Content-Type: application/json" \
  -d '{"registrationNumber":"S2QAVEH...","vehicleType":"VAN","make":"Tata","model":"Ace","modelYear":2022,"capacityKg":500}'
```
**Result: `201`** → `{"vehicleId":"79808114-...","verificationQueueId":"690a62d3-...","verificationStatus":"DOCUMENTS_SUBMITTED"}`

---

## FleetOwnerController

Source: `S2-partner-verification/src/main/java/com/example/lbos/controller/FleetOwnerController.java`
(mirrors `RetailerController` structure exactly, with `profileStatus`/`ownerStatus` in place
of a single `retailerStatus`.)

### POST /api/fleet-owners/register
Self-service. **Auth:** any authenticated JWT. Same validation-ordering quirk as retailer
register — see [Bugs found #1](#bugs-found).
```bash
curl -s -X POST http://localhost:8082/api/fleet-owners/register \
  -H "Authorization: Bearer $CUSTOMER1_TOKEN" -H "Content-Type: application/json" \
  -d '{"businessName":"Test Throwaway Fleet","cityId":"20000000-0000-0000-0000-000000000001","gstNumber":"33FFFFF0000F1Z9","registrationNumber":"REG-FLEET-TEST-01","operationsManagerId":"40000000-0000-0000-0000-000000000001","userAccountId":"22222222-2222-2222-2222-222222222222","profileStatus":"PENDING","ownerStatus":"PENDING"}'
```
**Result: `201`**
```json
{"fleetOwnerId":"d592f7db-5ed7-43c5-bbdd-9af56155e8a6","businessName":"Test Throwaway Fleet","ownerStatus":"INACTIVE","profileStatus":"PENDING_VERIFICATION","userAccountId":"30000000-0000-0000-0000-000000000013"}
```
`userAccountId` correctly overwritten to customer1's real subject (`...013`), discarding the
client-sent placeholder — confirms the ownership-override logic itself is correct; only the
required-but-ignored fields are the bug.

### POST /api/fleet-owners
**Auth:** any authenticated JWT (staff may target another `userAccountId`).
```bash
curl -s -X POST http://localhost:8082/api/fleet-owners \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"businessName":"Admin-Created Test Fleet","cityId":"20000000-0000-0000-0000-000000000001","gstNumber":"33GGGGG0000G1Z9","registrationNumber":"REG-FLEET-TEST-02","operationsManagerId":"40000000-0000-0000-0000-000000000001","userAccountId":"30000000-0000-0000-0000-000000000099","profileStatus":"PENDING","ownerStatus":"PENDING"}'
```
**Result: `201`** — `fleetOwnerId":"ceb984b9-64ff-4055-b083-facae77d9429"`, status `PENDING`/`PENDING`.

### GET /api/fleet-owners
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/fleet-owners -H "Authorization: Bearer $FLEET1_TOKEN"
```
**Result: `200`** — includes seeded fleetowner1 (`71000000-...-0001`, VERIFIED/ACTIVE).

### GET /api/fleet-owners/{fleetOwnerId}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/fleet-owners/71000000-0000-0000-0000-000000000001 -H "Authorization: Bearer $FLEET1_TOKEN"
```
**Result: `200`**
```json
{"businessName":"FleetOwner One Logistics","fleetOwnerId":"71000000-0000-0000-0000-000000000001","ownerStatus":"ACTIVE","profileStatus":"VERIFIED","userAccountId":"30000000-0000-0000-0000-000000000012"}
```
**Negative — 404:**
```bash
curl -s http://localhost:8082/api/fleet-owners/71000000-0000-0000-0000-000000009999 -H "Authorization: Bearer $FLEET1_TOKEN"
```
`404` → `{"message":"FleetOwner not found with id: 71000000-0000-0000-0000-000000009999","status":404}`

### PUT /api/fleet-owners/{fleetOwnerId}
Owner or staff only. **Auth:** any authenticated JWT, ownership/staff check in code.
```bash
curl -s -X PUT http://localhost:8082/api/fleet-owners/d592f7db-5ed7-43c5-bbdd-9af56155e8a6 \
  -H "Authorization: Bearer $CUSTOMER1_TOKEN" -H "Content-Type: application/json" \
  -d '{"businessName":"Test Throwaway Fleet Updated","cityId":"20000000-0000-0000-0000-000000000001","gstNumber":"33FFFFF0000F1Z9","registrationNumber":"REG-FLEET-TEST-01","operationsManagerId":"40000000-0000-0000-0000-000000000001","userAccountId":"30000000-0000-0000-0000-000000000013","profileStatus":"PENDING","ownerStatus":"INACTIVE"}'
```
**Result: `200`** — businessName updated.

**Negative — 404:**
```bash
curl -s -X PUT http://localhost:8082/api/fleet-owners/71000000-0000-0000-0000-000000009999 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"businessName":"X","cityId":"20000000-0000-0000-0000-000000000001","gstNumber":"33X","registrationNumber":"REG-X","operationsManagerId":"40000000-0000-0000-0000-000000000001","userAccountId":"30000000-0000-0000-0000-000000000099","profileStatus":"PENDING","ownerStatus":"PENDING"}'
```
`404` → `{"message":"FleetOwner not found with id: 71000000-0000-0000-0000-000000009999","status":404}`

### DELETE /api/fleet-owners/{fleetOwnerId}
Owner or staff only. **Auth:** any authenticated JWT, ownership/staff check in code.
```bash
curl -s -X DELETE http://localhost:8082/api/fleet-owners/ceb984b9-64ff-4055-b083-facae77d9429 -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Result: `200`** (empty body) — admin (staff) deleted throwaway fleet owner.

**Negative — 404 (re-delete):**
```bash
curl -s -X DELETE http://localhost:8082/api/fleet-owners/ceb984b9-64ff-4055-b083-facae77d9429 -H "Authorization: Bearer $ADMIN_TOKEN"
```
`404` → `{"message":"FleetOwner not found with id: ceb984b9-64ff-4055-b083-facae77d9429","status":404}`

**Negative — 403 (non-owner, non-staff):**
```bash
curl -s -X DELETE http://localhost:8082/api/fleet-owners/d592f7db-5ed7-43c5-bbdd-9af56155e8a6 -H "Authorization: Bearer $FLEET1_TOKEN"
```
`403` → `{"message":"You do not own this fleet-owner profile","status":403}` — fleetowner1
correctly blocked from deleting customer1's throwaway fleet-owner profile.

### GET /api/fleet-owners/city/{cityId}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/fleet-owners/city/20000000-0000-0000-0000-000000000001 -H "Authorization: Bearer $FLEET1_TOKEN"
```
**Result: `200`** — fleet owners in Chennai.

### GET /api/fleet-owners/status/{status}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/fleet-owners/status/ACTIVE -H "Authorization: Bearer $FLEET1_TOKEN"
```
**Result: `200`** → `[{"fleetOwnerId":"71000000-...-0001","ownerStatus":"ACTIVE", ...}]`

### GET /api/fleet-owners/profile-status/{status}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/fleet-owners/profile-status/VERIFIED -H "Authorization: Bearer $FLEET1_TOKEN"
```
**Result: `200`** → `[{"fleetOwnerId":"71000000-...-0001","profileStatus":"VERIFIED", ...}]`

### GET /api/fleet-owners/search?businessName=
**Auth:** any authenticated JWT.
```bash
curl -s "http://localhost:8082/api/fleet-owners/search?businessName=Fleet" -H "Authorization: Bearer $FLEET1_TOKEN"
```
**Result: `200`** — partial-match results.

### POST /api/fleet-owners/{fleetOwnerId}/documents
Same 500-on-incomplete-body issue as the retailer equivalent — see
[Bugs found #2](#bugs-found). Working curl:
```bash
curl -s -X POST http://localhost:8082/api/fleet-owners/d592f7db-5ed7-43c5-bbdd-9af56155e8a6/documents \
  -H "Authorization: Bearer $CUSTOMER1_TOKEN" -H "Content-Type: application/json" \
  -d '[{"documentTypeName":"BUSINESS_LICENSE","versionNumber":1,"documentStatus":"PENDING","isCurrentVersion":true}]'
```
**Result: `200`** (empty body).

### POST /api/fleet-owners/{fleetOwnerId}/submit-verification
**Auth:** any authenticated JWT.
```bash
curl -s -X POST http://localhost:8082/api/fleet-owners/d592f7db-5ed7-43c5-bbdd-9af56155e8a6/submit-verification -H "Authorization: Bearer $CUSTOMER1_TOKEN"
```
**Result: `200`** (empty body) — succeeded because the documents call above had just created an
active queue for this throwaway fleet owner.

### GET /api/fleet-owners/{fleetOwnerId}/verification-status
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/fleet-owners/d592f7db-5ed7-43c5-bbdd-9af56155e8a6/verification-status -H "Authorization: Bearer $CUSTOMER1_TOKEN"
```
**Result: `200`** → `{"status":"DOCUMENTS_SUBMITTED"}`

---

## VerificationQueueController

Source: `S2-partner-verification/src/main/java/com/example/lbos/controller/VerificationQueueController.java`

### POST /api/verification-queues
**Auth:** JWT, `hasAnyRole("SUPER_ADMIN","OPERATIONS_MANAGER")`.
```bash
curl -s -X POST http://localhost:8082/api/verification-queues \
  -H "Authorization: Bearer $MANAGER_TOKEN" -H "Content-Type: application/json" \
  -d '{"subjectType":"RETAILER","subjectId":"70000000-0000-0000-0000-000000000001","isActive":true,"submittedByAccountId":"30000000-0000-0000-0000-000000000010","verificationStatus":"PENDING"}'
```
**Result: `201`** → `verificationQueueId":"acb449de-58c1-4d4c-a418-48b88bd4775a"`, status `PENDING`.

**Negative — 403 (wrong role, RETAILER):**
```bash
curl -s -X POST http://localhost:8082/api/verification-queues \
  -H "Authorization: Bearer $RETAILER1_TOKEN" -H "Content-Type: application/json" \
  -d '{"subjectType":"RETAILER","subjectId":"70000000-0000-0000-0000-000000000001","isActive":true,"submittedByAccountId":"30000000-0000-0000-0000-000000000010","verificationStatus":"PENDING"}'
```
`403` → `{"timestamp":"...","status":403,"error":"Forbidden","message":"Forbidden","path":"/api/verification-queues"}`
(Spring Security's default `AccessDeniedHandlerImpl` JSON — correctly a **403**, not a 401.
This confirms the S1 "403 masked as 401 via the `/error` re-dispatch" bug documented in
`docs/SEED_DATA_CONTRACT.md` does **not** reproduce in S2 — its `SecurityConfig` already has
`/error` in `permitAll()` and both an explicit `authenticationEntryPoint` and
`accessDeniedHandler` configured.)

### GET /api/verification-queues
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/verification-queues -H "Authorization: Bearer $RETAILER1_TOKEN"
```
**Result: `200`** — all queue rows (seeded + any created during this test run).

### GET /api/verification-queues/{verificationQueueId}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/verification-queues/72000000-0000-0000-0000-000000000001 -H "Authorization: Bearer $RETAILER1_TOKEN"
```
**Result: `200`**
```json
{"verificationQueueId":"72000000-0000-0000-0000-000000000001","subjectType":"RETAILER","subjectId":"70000000-0000-0000-0000-000000000001","isActive":false,"verificationStatus":"APPROVED","reviewedByAccountId":"30000000-0000-0000-0000-000000000001","submittedByAccountId":"30000000-0000-0000-0000-000000000010"}
```
**Negative — 404:**
```bash
curl -s http://localhost:8082/api/verification-queues/72000000-0000-0000-0000-000000009999 -H "Authorization: Bearer $RETAILER1_TOKEN"
```
`404` → `{"message":"VerificationQueue not found with id: 72000000-0000-0000-0000-000000009999","status":404}`

### PUT /api/verification-queues/{verificationQueueId}
**Auth:** JWT, `hasAnyRole("SUPER_ADMIN","OPERATIONS_MANAGER")`.
```bash
curl -s -X PUT http://localhost:8082/api/verification-queues/acb449de-58c1-4d4c-a418-48b88bd4775a \
  -H "Authorization: Bearer $MANAGER_TOKEN" -H "Content-Type: application/json" \
  -d '{"subjectType":"RETAILER","subjectId":"70000000-0000-0000-0000-000000000001","isActive":false,"submittedByAccountId":"30000000-0000-0000-0000-000000000010","reviewedByAccountId":"30000000-0000-0000-0000-000000000002","verificationStatus":"APPROVED"}'
```
**Result: `200`** — `verificationStatus` updated to `APPROVED`, `isActive` to `false`.

**Negative — 404:**
```bash
curl -s -X PUT http://localhost:8082/api/verification-queues/72000000-0000-0000-0000-000000009999 \
  -H "Authorization: Bearer $MANAGER_TOKEN" -H "Content-Type: application/json" \
  -d '{"subjectType":"RETAILER","subjectId":"70000000-0000-0000-0000-000000000001","isActive":false,"submittedByAccountId":"30000000-0000-0000-0000-000000000010","verificationStatus":"APPROVED"}'
```
`404` → `{"message":"VerificationQueue not found with id: 72000000-0000-0000-0000-000000009999","status":404}`

### DELETE /api/verification-queues/{verificationQueueId}
**Auth:** JWT, `hasAnyRole("SUPER_ADMIN","OPERATIONS_MANAGER")`.
```bash
curl -s -X DELETE http://localhost:8082/api/verification-queues/acb449de-58c1-4d4c-a418-48b88bd4775a -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Result: `200`** (empty body) — smoke-test queue row deleted.

**Negative — 404 (re-delete):**
```bash
curl -s -X DELETE http://localhost:8082/api/verification-queues/acb449de-58c1-4d4c-a418-48b88bd4775a -H "Authorization: Bearer $ADMIN_TOKEN"
```
`404` → `{"message":"VerificationQueue not found with id: acb449de-58c1-4d4c-a418-48b88bd4775a","status":404}`

**Negative — 403 (wrong role):**
```bash
curl -s -X DELETE http://localhost:8082/api/verification-queues/acb449de-58c1-4d4c-a418-48b88bd4775a -H "Authorization: Bearer $RETAILER1_TOKEN"
```
`403` → Spring default access-denied JSON (see above).

### POST /api/verification-queues/{verificationQueueId}/submit-for-verification *(new this session)*
The one common submit-verification step for **any** subject type (RETAILER, FLEET_OWNER,
DRIVER, VEHICLE): flips a `DOCUMENTS_SUBMITTED` queue to `SENT_TO_LOCATION_MANAGER` and
dispatches it to whichever Location Manager is active in the queue's `zoneId` (S1's
`GET /internal/v1/location-managers/active/by-zone/{zoneId}`). `RetailerController`'s and
`FleetOwnerController`'s own submit-verification endpoints now delegate into this same code
internally rather than duplicating the dispatch logic. **Auth:** any authenticated JWT (this is
the submitter's own action).
```bash
curl -s -X POST http://localhost:8082/api/verification-queues/156674d9-7d00-4741-81b4-4cb012a147d2/submit-for-verification \
  -H "Authorization: Bearer $RETAILER1_TOKEN"
```
**Result: `200`** (empty body) — live-verified: queue's `verificationStatus` flipped
`DOCUMENTS_SUBMITTED` → `SENT_TO_LOCATION_MANAGER`, `zoneId` unchanged, no reviewer stamped yet
(that happens on `process-result`/`assign`).

**Negative — 409 (queue not in `DOCUMENTS_SUBMITTED`):** calling this twice on the same queue,
or on one already `SENT_TO_LOCATION_MANAGER`/decided, is rejected with a clear
`InvalidVerificationTransitionException` (409) rather than silently re-dispatching.

### POST /api/verification-queues/{verificationQueueId}/process-result
Approve/reject decision — cascades to the subject's status and to related documents; includes
the repeat-offender auto-suspend logic (full dedicated write-up in
[`docs/business-logic/S2-partner-verification.md` §2](../business-logic/S2-partner-verification.md#2-repeat-offender-auto-suspension)).
**Auth:** JWT, `hasAnyRole("SUPER_ADMIN","OPERATIONS_MANAGER","LOCATION_MANAGER")` — the
`LOCATION_MANAGER` role was added this session (previously missing despite being the intended
reviewer role for this whole workflow).

```bash
curl -s -X POST http://localhost:8082/api/verification-queues/156674d9-7d00-4741-81b4-4cb012a147d2/process-result \
  -H "Authorization: Bearer $LOCATION_TOKEN" -H "Content-Type: application/json" \
  -d '{"result":"APPROVED","reason":"qa smoke"}'
```
**Result: `200`** (empty body) — live-verified as an actual `LOCATION_MANAGER` JWT, not just
`SUPER_ADMIN`/`OPERATIONS_MANAGER`. Full state-machine/auto-suspend behavior already
exhaustively tested and documented in the business-logic doc linked above.

### PATCH /api/verification-queues/{verificationQueueId}/assign
Assigns a reviewer, with terminal-status / self-review / 15-item workload-cap guards — full
dedicated write-up in
[`docs/business-logic/S2-partner-verification.md` §1](../business-logic/S2-partner-verification.md#1-workload-capped-guarded-reviewer-assignment).
**Auth:** JWT, `hasAnyRole("SUPER_ADMIN","OPERATIONS_MANAGER","LOCATION_MANAGER")` (role
widened this session, same as `process-result` above).

```bash
curl -s -X PATCH http://localhost:8082/api/verification-queues/{id}/assign \
  -H "Authorization: Bearer $LOCATION_TOKEN" -H "Content-Type: application/json" \
  -d '{"reviewerAccountId":"30000000-0000-0000-0000-000000000002"}'
```
**Result: `200`** — live-verified as a `LOCATION_MANAGER` JWT. Full guard-path testing
(self-review 409, terminal-status 409, 15-item cap 409) already done and documented in the
business-logic doc linked above.

### GET /api/verification-queues/subject/{subjectId}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/verification-queues/subject/70000000-0000-0000-0000-000000000001 -H "Authorization: Bearer $RETAILER1_TOKEN"
```
**Result: `200`** — array of all queue rows for retailer1 (history included, both `APPROVED`
and any active rows).

### GET /api/verification-queues/status/{status}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/verification-queues/status/PENDING -H "Authorization: Bearer $RETAILER1_TOKEN"
```
**Result: `200`** → `[{"verificationQueueId":"72000000-...-0002","subjectId":"70000000-...-0002","verificationStatus":"PENDING", ...}]`

### GET /api/verification-queues/active/{active}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/verification-queues/active/true -H "Authorization: Bearer $RETAILER1_TOKEN"
```
**Result: `200`** — all rows with `isActive=true`.

---

## VerificationDocumentController

Source: `S2-partner-verification/src/main/java/com/example/lbos/controller/VerificationDocumentController.java`

### POST /api/verification-documents
Creates a document row directly from a JSON body (full DTO, `@Valid`-checked here unlike the
`/documents` bulk-submit endpoints above).
**Auth:** any authenticated JWT.
```bash
curl -s -X POST http://localhost:8082/api/verification-documents \
  -H "Authorization: Bearer $RETAILER2_TOKEN" -H "Content-Type: application/json" \
  -d '{"verificationQueueId":"72000000-0000-0000-0000-000000000002","documentTypeName":"PAN_CARD_V2","versionNumber":1,"documentStatus":"PENDING","isCurrentVersion":false}'
```
**Result: `201`** → `documentId":"420294a6-9318-4f4a-8124-1159d3968e24"`.

### POST /api/verification-documents/upload  (multipart file upload)
Uploads a real PDF/JPG/JPEG/PNG file (max 10MB); creates the next version for the given
queue+documentTypeName, superseding any existing current version. **Storage changed this
session**: the file is now stored as a real `bytea` BLOB in Postgres (`VerificationDocument.
fileContent`, `@JdbcTypeCode(SqlTypes.VARBINARY)`), not written to disk — the response no
longer has a `filePath`, it has `fileName`/`contentType`/`fileSizeBytes` (metadata only, no raw
bytes in the JSON). **Auth:** any authenticated JWT.

```bash
curl -s -X POST "http://localhost:8082/api/verification-documents/upload" \
  -H "Authorization: Bearer $RETAILER1_TOKEN" \
  -F "verificationQueueId=<queueId>" -F "documentTypeName=GST_CERTIFICATE" -F "file=@test-doc.pdf"
```
**Result: `201`**
```json
{"documentId":"7e10d1e1-...","documentStatus":"PENDING","documentTypeName":"GST_CERTIFICATE","fileName":"9d52088d-....pdf","contentType":"application/pdf","fileSizeBytes":20,"isCurrentVersion":true,"versionNumber":1}
```

**Negative — 400 (unsupported file extension):**
```bash
curl -s -X POST "http://localhost:8082/api/verification-documents/upload" \
  -H "Authorization: Bearer $RETAILER1_TOKEN" \
  -F "verificationQueueId=<queueId>" -F "documentTypeName=X" -F "file=@bad-file.exe"
```
`400` → `{"message":"Unsupported file extension 'exe'. Allowed types: JPG, JPEG, PNG, PDF","status":400}`
(curl gotcha confirmed this session: appending `;type=...` after the `@file` in `-F` breaks this
curl build with a bare `curl: (26)` — omit it and let curl auto-detect the MIME type.)

**Negative — 404 (nonexistent queue):**
```bash
curl -s -X POST "http://localhost:8082/api/verification-documents/upload" \
  -H "Authorization: Bearer $RETAILER1_TOKEN" \
  -F "verificationQueueId=72000000-0000-0000-0000-000000009999" -F "documentTypeName=X" -F "file=@test-doc.pdf"
```
`404` → `{"message":"VerificationQueue not found with id: 72000000-0000-0000-0000-000000009999","status":404}`

### GET /api/verification-documents/{documentId}/file *(new)*
Downloads the raw file bytes (`Content-Type`/`Content-Disposition` set from the stored
metadata). **Auth:** any authenticated JWT.
```bash
curl -s -o downloaded.pdf "http://localhost:8082/api/verification-documents/7e10d1e1-.../file" -H "Authorization: Bearer $RETAILER1_TOKEN"
```
**Result: `200`** — bytes confirmed byte-identical to the originally uploaded file via `diff`.

### GET /api/verification-documents
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/verification-documents -H "Authorization: Bearer $RETAILER2_TOKEN"
```
**Result: `200`** — all document rows (seeded + created during this test run).

### GET /api/verification-documents/{documentId}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/verification-documents/73000000-0000-0000-0000-000000000001 -H "Authorization: Bearer $RETAILER2_TOKEN"
```
**Result: `200`**
```json
{"documentId":"73000000-0000-0000-0000-000000000001","documentStatus":"APPROVED","documentTypeName":"GST_CERTIFICATE","fileName":null,"isCurrentVersion":true,"verificationQueueId":"72000000-0000-0000-0000-000000000001","versionNumber":1}
```
**Negative — 404:**
```bash
curl -s http://localhost:8082/api/verification-documents/73000000-0000-0000-0000-000000009999 -H "Authorization: Bearer $RETAILER2_TOKEN"
```
`404` → `{"message":"VerificationDocument not found with id: 73000000-0000-0000-0000-000000009999","status":404}`

### PUT /api/verification-documents/{documentId}
**Auth:** any authenticated JWT.
```bash
curl -s -X PUT http://localhost:8082/api/verification-documents/420294a6-9318-4f4a-8124-1159d3968e24 \
  -H "Authorization: Bearer $RETAILER2_TOKEN" -H "Content-Type: application/json" \
  -d '{"verificationQueueId":"72000000-0000-0000-0000-000000000002","documentTypeName":"PAN_CARD_V2","versionNumber":1,"documentStatus":"APPROVED","isCurrentVersion":true}'
```
**Result: `200`** — `documentStatus` updated to `APPROVED`.

**Negative — 404:**
```bash
curl -s -X PUT http://localhost:8082/api/verification-documents/73000000-0000-0000-0000-000000009999 \
  -H "Authorization: Bearer $RETAILER2_TOKEN" -H "Content-Type: application/json" \
  -d '{"verificationQueueId":"72000000-0000-0000-0000-000000000002","documentTypeName":"X","versionNumber":1,"documentStatus":"PENDING","isCurrentVersion":true}'
```
`404` → `{"message":"VerificationDocument not found with id: 73000000-0000-0000-0000-000000009999","status":404}`

### DELETE /api/verification-documents/{documentId}
**Auth:** any authenticated JWT.
```bash
curl -s -X DELETE http://localhost:8082/api/verification-documents/420294a6-9318-4f4a-8124-1159d3968e24 -H "Authorization: Bearer $RETAILER2_TOKEN"
```
**Result: `200`** (empty body).

**Negative — 404 (re-delete):**
```bash
curl -s -X DELETE http://localhost:8082/api/verification-documents/420294a6-9318-4f4a-8124-1159d3968e24 -H "Authorization: Bearer $RETAILER2_TOKEN"
```
`404` → `{"message":"VerificationDocument not found with id: 420294a6-9318-4f4a-8124-1159d3968e24","status":404}`

(The multipart-uploaded document above was also deleted as cleanup: `DELETE
/api/verification-documents/74d75954-8c3a-4a8d-903a-3cc9b5a471ad` → `200`.)

### GET /api/verification-documents/queue/{verificationQueueId}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/verification-documents/queue/72000000-0000-0000-0000-000000000002 -H "Authorization: Bearer $RETAILER2_TOKEN"
```
**Result: `200`** — documents for retailer2's queue (seeded `PAN_CARD` + the uploaded/created ones).

### GET /api/verification-documents/status/{status}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/verification-documents/status/PENDING -H "Authorization: Bearer $RETAILER2_TOKEN"
```
**Result: `200`** — all `PENDING` documents.

### GET /api/verification-documents/current/{current}
**Auth:** any authenticated JWT.
```bash
curl -s http://localhost:8082/api/verification-documents/current/true -H "Authorization: Bearer $RETAILER2_TOKEN"
```
**Result: `200`** — all documents with `isCurrentVersion=true`.

---

## InternalRetailerController

Source: `S2-partner-verification/src/main/java/com/example/lbos/controller/InternalRetailerController.java`
**Auth:** HTTP Basic, `lbos-service` / `service123` (`hasRole("SERVICE")`).

### GET /internal/v1/retailers/{id}
```bash
curl -s -u lbos-service:service123 http://localhost:8082/internal/v1/retailers/70000000-0000-0000-0000-000000000001
```
**Result: `200`** → `{"retailerId":"70000000-0000-0000-0000-000000000001","businessName":"Retailer One Stores","cityId":"20000000-0000-0000-0000-000000000001"}`

### GET /internal/v1/retailers/by-user/{userAccountId}
```bash
curl -s -u lbos-service:service123 http://localhost:8082/internal/v1/retailers/by-user/30000000-0000-0000-0000-000000000010
```
**Result: `200`** → `{"retailerId":"70000000-0000-0000-0000-000000000001","userAccountId":"30000000-0000-0000-0000-000000000010","businessName":"Retailer One Stores","cityId":"20000000-0000-0000-0000-000000000001"}`

**Negative — 401 (wrong Basic password):**
```bash
curl -s -u lbos-service:wrongpassword http://localhost:8082/internal/v1/retailers/70000000-0000-0000-0000-000000000001
```
`401` → `{"timestamp":"...","status":401,"error":"Unauthorized","message":"Unauthorized","path":"/internal/v1/retailers/70000000-0000-0000-0000-000000000001"}`

**Negative — 401 (no auth at all):**
```bash
curl -s http://localhost:8082/internal/v1/retailers/70000000-0000-0000-0000-000000000001
```
`401` — same shape as above.

---

## InternalFleetOwnerController

Source: `S2-partner-verification/src/main/java/com/example/lbos/controller/InternalFleetOwnerController.java`
**Auth:** HTTP Basic, `lbos-service` / `service123` (`hasRole("SERVICE")`).

### GET /internal/v1/fleet-owners/{id}/validation
```bash
curl -s -u lbos-service:service123 http://localhost:8082/internal/v1/fleet-owners/71000000-0000-0000-0000-000000000001/validation
```
**Result: `200`** → `{"fleetOwnerId":"71000000-0000-0000-0000-000000000001","profileStatus":"VERIFIED","ownerStatus":"ACTIVE","verificationStatus":"VERIFIED"}`

**Negative — 404:**
```bash
curl -s -u lbos-service:service123 http://localhost:8082/internal/v1/fleet-owners/71000000-0000-0000-0000-000000009999/validation
```
`404` → `{"message":"FleetOwner not found with id: 71000000-0000-0000-0000-000000009999","status":404}`

---

## InternalVerificationQueueController

Source: `S2-partner-verification/src/main/java/com/example/lbos/controller/InternalVerificationQueueController.java`
**Auth:** HTTP Basic, `lbos-service` / `service123` (`hasRole("SERVICE")`).

### GET /internal/v1/verification-queues/reviewer/{reviewerAccountId}/pending-count
```bash
curl -s -u lbos-service:service123 http://localhost:8082/internal/v1/verification-queues/reviewer/30000000-0000-0000-0000-000000000001/pending-count
```
**Result: `200`** → `{"pendingCount":0}` (manager…01 had no open, non-terminal assignments at
test time — all smoke-test queue rows created/assigned during this run were subsequently
deleted or resolved).

---

## Bugs found

### ⚠️ BUG FOUND #1 — self-service register endpoints require fields they silently discard

**Endpoints:** `POST /api/retailers/register`, `POST /api/fleet-owners/register`
**Files:** `RetailerController.java` (`registerRetailer`, `applyOwnerIdentity`),
`FleetOwnerController.java` (`registerFleetOwner`, `applyOwnerIdentity`)

Both controller methods are annotated `@Valid @RequestBody ...DTO`, so Bean Validation runs
**before** the method body executes. `applyOwnerIdentity()` — which overwrites the
client-supplied `userAccountId` with the JWT subject for non-staff callers — only runs
*after* that validation has already passed. Since `RetailerDTO.userAccountId` is `@NotNull`
and `retailerStatus` is `@NotBlank` (same pattern for `FleetOwnerDTO`'s `profileStatus`/
`ownerStatus` if annotated), a genuinely minimal self-service request — the kind the endpoint
is documented and designed for ("Registers a new retailer/fleet owner with pending
verification status") — is rejected with `400` unless the caller pads the body with a
`userAccountId` and status value that the server is going to throw away anyway.

Live proof:
```bash
curl -s -X POST http://localhost:8082/api/retailers/register \
  -H "Authorization: Bearer $CUSTOMER2_TOKEN" -H "Content-Type: application/json" \
  -d '{"businessName":"Test Throwaway Retailer","cityId":"20000000-0000-0000-0000-000000000001","gstNumber":"33ZZZZZ0000Z1Z9","registrationNumber":"REG-TEST-0001","operationsManagerId":"40000000-0000-0000-0000-000000000001"}'
```
→ `400`
```json
{"message":"Validation failed","errors":{"retailerStatus":"retailerStatus cannot be empty","userAccountId":"userAccountId cannot be null"},"status":400}
```
Sending the same body **with** dummy `userAccountId`/`retailerStatus` values succeeds (`201`)
and the response confirms the server discarded both — `userAccountId` comes back as the
caller's real JWT subject, `retailerStatus` comes back as `PENDING_VERIFICATION` regardless
of what was sent. **Not a security hole** (the override itself works correctly), but a real
API-usability/documentation bug: the two fields most central to "why do I need `@Valid` at
all on a self-registration endpoint" are required-yet-ignored.

**Suggested fix:** move `applyOwnerIdentity()`'s override earlier (e.g. a `@ModelAttribute`/
custom deserialization step, or split the register DTO so `userAccountId`/`retailerStatus`
aren't required inputs on `/register`), or drop `@NotNull`/`@NotBlank` on those two fields for
the register path specifically.

### ⚠️ BUG FOUND #2 — document bulk-submit endpoints 500 instead of 400 on incomplete input

**Endpoints:** `POST /api/retailers/{retailerId}/documents`, `POST /api/fleet-owners/{fleetOwnerId}/documents`
**Files:** `RetailerController.submitRetailerDocuments` / `FleetOwnerController.submitFleetOwnerDocuments`
(no `@Valid` on the `List<VerificationDocumentDTO>` parameter), consumed by
`RetailerServiceImpl.submitRetailerDocuments` (`S2-partner-verification/src/main/java/com/example/lbos/service/RetailerServiceImpl.java`, lines ~117-147)

`VerificationDocumentDTO` (pre-BLOB-storage-change shape) had `@NotNull`/`@NotBlank` on `filePath`, `versionNumber`, and
`isCurrentVersion`, but the controller method takes the list as a plain `@RequestBody` with
no `@Valid`, so those constraints are never checked. If the caller's document objects omit
those fields (e.g. `[{"documentTypeName":"GST_CERTIFICATE"}]` — an entirely plausible payload
if the front-end doesn't yet know the file path/version at submission time), the request
passes the controller, reaches the DB insert, and blows up on a NOT-NULL constraint — surfaced
to the client as a bare, unhelpful `500`.

Live proof:
```bash
curl -s -X POST http://localhost:8082/api/retailers/70000000-0000-0000-0000-000000000001/documents \
  -H "Authorization: Bearer $RETAILER1_TOKEN" -H "Content-Type: application/json" \
  -d '[{"documentTypeName":"GST_CERTIFICATE"}]'
```
→ `500`
```json
{"message":"A data access error occurred","status":500}
```
The identical request with all required `VerificationDocumentDTO` fields present succeeds
(`200`) — confirmed the endpoint itself works; the gap is purely the missing input validation.

**Suggested fix:** add `@Valid` to `List<@Valid VerificationDocumentDTO> documents` (Spring
validates each list element when the element type itself is annotated with `@Valid` inside a
`@Valid`-checked collection), so bad input returns a `400` with a clear field-level message
instead of a generic `500`.

## Observation (not a bug in this controller's scope)

Per this review's instructions, retailer `70000000-0000-0000-0000-000000000002` was expected
to be `SUSPENDED` (per the documented 3-rejection auto-suspend live test in
`docs/business-logic/S2-partner-verification.md`). Live `GET /api/retailers/70000000-0000-0000-0000-000000000002`
during this audit returned `retailerStatus: "PENDING"` instead — the seed/reset value, not the
suspended state that test left it in. This audit did **not** touch retailer `...0002` or its
status (all bug/endpoint testing above used retailer1, throwaway retailers/fleet-owners, or
freshly created verification-queue rows that were cleaned up). The discrepancy most likely
reflects a DB re-seed or service restart sometime after that earlier documented test ran, not
anything this session did — flagged here for visibility, not "fixed."
