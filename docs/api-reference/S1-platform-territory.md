# S1 — Platform & Territory: API Reference

Live-tested against the running S1 service directly on **port 8081** (not through the API
Gateway) on 2026-08-29, backed by a real PostgreSQL instance (`scriptsstart-all.cmd /postgres`).
Every curl command below was actually executed against the live stack during this session; status
codes and response snippets are the real, observed results — not derived from source reading alone.

Auth quick reference (from `SecurityConfig.java`):
- **None** — `permitAll()`
- **JWT: `<ROLE>`** — end-user JWT obtained from `POST /api/v1/auth/login`, must carry one of the
  listed roles (`Authorization: Bearer <token>`)
- **JWT: any authenticated** — any valid JWT regardless of role
- **Basic (SERVICE)** — HTTP Basic with `lbos-service` / `service123`, service-to-service only,
  routed under `/internal/**`

For the two endpoints with genuine business logic beyond plain CRUD — the login password-age
policy and the location-manager cross-service deactivation guard — full detail (including the
live Feign round-trip against S2) is in
[`docs/business-logic/S1-platform-territory.md`](../business-logic/S1-platform-territory.md).
This document only smoke-tests those two here and links out rather than re-deriving them.

## Table of Contents

1. [AuthController](#authcontroller) — `/api/v1/auth`
2. [CityController](#citycontroller) — `/api/v1/cities`
3. [CurrentUserController](#currentusercontroller) — `/api/v1/users`
4. [InternalLocationManagerController](#internallocationmanagercontroller) — `/internal/v1/location-managers`
5. [InternalOperationsManagerController](#internaloperationsmanagercontroller) — `/internal/v1/operations-managers`
6. [InternalStateController](#internalstatecontroller) — `/internal/v1/states`
7. [InternalTerritoryController](#internalterritorycontroller) — `/internal/v1/territories`
8. [InternalUserAccountController](#internaluseraccountcontroller) — `/internal/v1/user-accounts`
9. [LocationManagerController](#locationmanagercontroller) — `/api/v1/location-managers`
10. [OperationsManagerController](#operationsmanagercontroller) — `/api/v1/operations-managers`
11. [StateController](#statecontroller) — `/api/states`
12. [UserAccountController](#useraccountcontroller) — `/api/user-accounts`
13. [ZoneController](#zonecontroller) — `/api/v1/zones`
14. [Role-enforcement spot checks](#role-enforcement-spot-checks)
15. [⚠️ Bugs found](#bugs-found)

Test fixtures used throughout (see `docs/SEED_DATA_CONTRACT.md`):
- State `10000000-0000-0000-0000-000000000001` (Tamil Nadu), City `20000000-...-0001` (Chennai),
  Zone `50000000-...-0001` (North Zone)
- OperationsManager `40000000-...-0001` (manager@aroundu.local, Chennai),
  `40000000-...-0002` (manager2@aroundu.local, Coimbatore)
- LocationManager `60000000-...-0001` (location@aroundu.local, North Zone) — **shared demo
  fixture, read-only in this pass, confirmed still `ACTIVE` at the end**
- Several throwaway `UserAccount`/`OperationsManager`/`LocationManager` rows were created and
  (where a delete endpoint exists) deleted during this pass — none of the protected seeded IDs
  above were mutated or deleted.

---

## AuthController

Base path `/api/v1/auth`. Auth: **none** (`permitAll`) on both routes.

### `POST /api/v1/auth/login`

Issues a JWT for a seeded `UserAccount`. Full password-age-policy business logic (90-day
expiry, `423 LOCKED`, `null`-treated-as-expired) documented and live-verified in
[business-logic/S1-platform-territory.md](../business-logic/S1-platform-territory.md#1-password-age-policy-at-login) —
this is just the plain happy-path smoke test.

```bash
curl -s -X POST http://localhost:8081/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aroundu.local","password":"AroundU@123"}'
```
**Result: `200 OK`**
```json
{"accessToken":"eyJhbGciOiJIUzM4NCJ9...","expiresInSeconds":3600,
 "userAccountId":"30000000-0000-0000-0000-000000000099","email":"admin@aroundu.local",
 "role":"SUPER_ADMIN","tokenType":"Bearer"}
```
Also smoke-tested for `manager@aroundu.local`, `manager2@aroundu.local`, `location@aroundu.local`,
`customer1@aroundu.local` — all `200`, all issued a role-correct JWT used for the rest of this
document's tests.

### `POST /api/v1/auth/register/customer`

Self-registration for a `CUSTOMER` account.

```bash
curl -s -X POST http://localhost:8081/api/v1/auth/register/customer \
  -H "Content-Type: application/json" \
  -d '{"email":"qatest_customer_reg@aroundu.local","phoneNumber":"9876543213","password":"Test@1234","firstName":"QA","lastName":"CustomerReg"}'
```
**Result: `201 Created`**
```json
{"id":"077b1274-5889-4387-b229-76a2a7465869","email":"qatest_customer_reg@aroundu.local",
 "role":"CUSTOMER","accountStatus":"ACTIVE","passwordChangedOn":"2026-08-29T19:22:39.75...", ...}
```

---

## CityController

Base path `/api/v1/cities`. Auth: **JWT: `SUPER_ADMIN` or `OPERATIONS_MANAGER`** for all routes.

### `GET /api/v1/cities`
```bash
curl -s "http://localhost:8081/api/v1/cities?active=true" -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — paged list, 3 seeded cities (Bengaluru, Chennai, Coimbatore).

### `GET /api/v1/cities/{id}`
```bash
curl -s http://localhost:8081/api/v1/cities/20000000-0000-0000-0000-000000000001 -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`**
```json
{"id":"20000000-0000-0000-0000-000000000001","cityName":"Chennai","stateId":"10000000-...-0001","stateName":"Tamil Nadu","active":true}
```
Negative case, bogus id:
```bash
curl -s http://localhost:8081/api/v1/cities/99999999-0000-0000-0000-000000000001 -H "Authorization: Bearer $ADMIN"
```
**Result: `404 Not Found`** — `{"message":"City not found: 99999999-0000-0000-0000-000000000001", ...}`

### `POST /api/v1/cities`
```bash
curl -s -X POST http://localhost:8081/api/v1/cities -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"stateId":"10000000-0000-0000-0000-000000000001","cityName":"Test City QA"}'
```
**Result: `201 Created`** — `{"id":"2a38c239-...","cityName":"Test City QA","active":true, ...}`

### `PUT /api/v1/cities/{id}`
```bash
curl -s -X PUT http://localhost:8081/api/v1/cities/2a38c239-4039-4604-bb55-d04cd7112dc2 \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"stateId":"10000000-0000-0000-0000-000000000001","cityName":"Test City QA Updated","active":true}'
```
**Result: `200 OK`** — `cityName` updated as expected.

### `PATCH /api/v1/cities/{id}/deactivate`
```bash
curl -s -X PATCH http://localhost:8081/api/v1/cities/2a38c239-4039-4604-bb55-d04cd7112dc2/deactivate -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — `"active":false`

### `PATCH /api/v1/cities/{id}/activate`
```bash
curl -s -X PATCH http://localhost:8081/api/v1/cities/2a38c239-4039-4604-bb55-d04cd7112dc2/activate -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — `"active":true`

### `DELETE /api/v1/cities/{id}`
```bash
curl -s -X DELETE http://localhost:8081/api/v1/cities/99999999-0000-0000-0000-000000000001 -H "Authorization: Bearer $ADMIN"
```
**Result (bogus id): `404 Not Found`** — `{"message":"City not found: 99999999-...", ...}`
```bash
curl -s -X DELETE http://localhost:8081/api/v1/cities/2a38c239-4039-4604-bb55-d04cd7112dc2 -H "Authorization: Bearer $ADMIN"
```
**Result (valid, our throwaway city): `204 No Content`**

---

## CurrentUserController

Base path `/api/v1/users`. Auth: **JWT: any authenticated role**.

### `GET /api/v1/users/me`

Resolves identity purely from the JWT subject claim — never from a client-supplied id.

```bash
curl -s http://localhost:8081/api/v1/users/me -H "Authorization: Bearer $CUSTOMER"
```
**Result: `200 OK`**
```json
{"id":"30000000-0000-0000-0000-000000000013","email":"customer1@aroundu.local","role":"CUSTOMER","accountStatus":"ACTIVE", ...}
```
Negative case, no token:
```bash
curl -s http://localhost:8081/api/v1/users/me
```
**Result: `401 Unauthorized`** (empty body)

---

## InternalLocationManagerController

Base path `/internal/v1/location-managers`. Auth: **Basic (SERVICE)** — `lbos-service:service123`.

### `GET /internal/v1/location-managers/active/by-zone/{zoneId}`

Service-to-service equivalent of the JWT-gated `GET /api/v1/location-managers/active/by-zone/{zoneId}`
— used by S2 to resolve the active reviewer for a zone.

```bash
curl -s -u lbos-service:service123 http://localhost:8081/internal/v1/location-managers/active/by-zone/50000000-0000-0000-0000-000000000001
```
**Result: `200 OK`**
```json
{"locationManagerId":"60000000-0000-0000-0000-000000000001","assignmentStatus":"ACTIVE","zoneName":"North Zone", "email":"location@aroundu.local", ...}
```

### `POST /internal/v1/location-managers/{managerId}/verifications`

```bash
curl -s -u lbos-service:service123 -X POST \
  http://localhost:8081/internal/v1/location-managers/60000000-0000-0000-0000-000000000001/verifications \
  -H "Content-Type: application/json" -d '{"note":"qa smoke test"}'
```
**Result: `202 Accepted`**
```json
{"locationManagerId":"60000000-0000-0000-0000-000000000001","verificationDetailsReceived":true,"accepted":true}
```
Negative case, bogus id:
```bash
curl -s -u lbos-service:service123 -X POST \
  http://localhost:8081/internal/v1/location-managers/99999999-0000-0000-0000-000000000001/verifications \
  -H "Content-Type: application/json" -d '{"note":"qa smoke test"}'
```
**Result: `404 Not Found`** — `{"message":"Location Manager not found: 99999999-...", ...}`

---

## InternalOperationsManagerController

Base path `/internal/v1/operations-managers`. Auth: **Basic (SERVICE)**.

### `GET /internal/v1/operations-managers/{id}`
```bash
curl -s -u lbos-service:service123 http://localhost:8081/internal/v1/operations-managers/40000000-0000-0000-0000-000000000001
```
**Result: `200 OK`**
```json
{"operationsManagerId":"40000000-...-0001","userAccountId":"30000000-...-0001","cityId":"20000000-...-0001","status":"ACTIVE","canOperate":true}
```
Negative case, bogus id:
```bash
curl -s -u lbos-service:service123 http://localhost:8081/internal/v1/operations-managers/99999999-0000-0000-0000-000000000001
```
**Result: `404 Not Found`** — `{"message":"Manager not found", ...}`

### `GET /internal/v1/operations-managers/resolve?userAccountId={id}`
```bash
curl -s -u lbos-service:service123 "http://localhost:8081/internal/v1/operations-managers/resolve?userAccountId=30000000-0000-0000-0000-000000000001"
```
**Result: `200 OK`** — same `InternalAssignment` shape as above.

### `GET /internal/v1/operations-managers/city/{id}/active`
```bash
curl -s -u lbos-service:service123 http://localhost:8081/internal/v1/operations-managers/city/20000000-0000-0000-0000-000000000001/active
```
**Result: `200 OK`** — resolves the active OM for Chennai (`40000000-...-0001`).

### `GET /internal/v1/operations-managers/{id}/validate-city/{cityId}`
```bash
curl -s -u lbos-service:service123 http://localhost:8081/internal/v1/operations-managers/40000000-0000-0000-0000-000000000001/validate-city/20000000-0000-0000-0000-000000000001
```
**Result: `200 OK`** — `{"valid":true,"reason":"Valid active city assignment"}`

---

## InternalStateController

Base path `/internal/v1/states`. Auth: **Basic (SERVICE)**.

### `GET /internal/v1/states/{id}`
```bash
curl -s -u lbos-service:service123 http://localhost:8081/internal/v1/states/10000000-0000-0000-0000-000000000001
```
**Result: `200 OK`** — `{"stateId":"10000000-...-0001","stateName":"Tamil Nadu","countryCode":"IN","active":true}`

Negative case, bogus id:
```bash
curl -s -u lbos-service:service123 http://localhost:8081/internal/v1/states/99999999-0000-0000-0000-000000000001
```
**Result: `404 Not Found`** — `{"message":"State not found with ID: 99999999-...", ...}`

---

## InternalTerritoryController

Base path `/internal/v1/territories`. Auth: **Basic (SERVICE)**.

### `POST /internal/v1/territories/validate`
```bash
curl -s -u lbos-service:service123 -X POST http://localhost:8081/internal/v1/territories/validate \
  -H "Content-Type: application/json" \
  -d '{"cityId":"20000000-0000-0000-0000-000000000001","zoneId":"50000000-0000-0000-0000-000000000001","postalCode":"600001","latitude":13.08,"longitude":80.27}'
```
**Result: `200 OK`** — `{"valid":true,"reasonCode":null}`

### `GET /internal/v1/territories/cities` *(new)*

Lets a caller (e.g. S3 resolving a customer-typed city name to S1's internal UUID for an address)
look up active cities by human-readable name, without needing the SUPER_ADMIN/OPERATIONS_MANAGER
role the public `GET /api/v1/cities` requires. Blank/absent `name` returns every active city.

```bash
curl -s -u lbos-service:service123 "http://localhost:8081/internal/v1/territories/cities?name=Chennai"
```
**Result: `200 OK`**
```json
[{"cityId":"20000000-0000-0000-0000-000000000001","cityName":"Chennai","stateId":"10000000-...-0001","stateName":"Tamil Nadu"}]
```

### `GET /internal/v1/territories/zones` *(new)*

Same idea, scoped to one city's active zones.

```bash
curl -s -u lbos-service:service123 "http://localhost:8081/internal/v1/territories/zones?cityId=20000000-0000-0000-0000-000000000001&name=North"
```
**Result: `200 OK`**
```json
[{"zoneId":"50000000-0000-0000-0000-000000000001","zoneName":"North Zone","cityId":"20000000-0000-0000-0000-000000000001"}]
```

---

## InternalUserAccountController

Base path `/internal/v1/user-accounts`. Auth: **Basic (SERVICE)**.

### `GET /internal/v1/user-accounts/{id}`
```bash
curl -s -u lbos-service:service123 http://localhost:8081/internal/v1/user-accounts/30000000-0000-0000-0000-000000000099
```
**Result: `200 OK`** — `{"id":"30000000-...-0099","email":"admin@aroundu.local","role":"SUPER_ADMIN", ...}`

Negative case, bogus id:
```bash
curl -s -u lbos-service:service123 http://localhost:8081/internal/v1/user-accounts/99999999-0000-0000-0000-000000000001
```
**Result: `404 Not Found`** — `{"message":"User account not found with ID: 99999999-...", ...}`

---

## LocationManagerController

Base path `/api/v1/location-managers`. Auth: **JWT: `SUPER_ADMIN` or `OPERATIONS_MANAGER`**.

The deactivate endpoint's cross-service pending-review guard (live Feign call into S2) is fully
documented and live-verified (blocked at `422`, then unblocked, full round trip) in
[business-logic/S1-platform-territory.md](../business-logic/S1-platform-territory.md#2-cross-service-deactivation-guard).
Here it's smoke-tested only, on a throwaway assignment with zero pending reviews (so it takes the
`200` fast path, not the `422` guard path).

### `POST /api/v1/location-managers`
```bash
curl -s -X POST http://localhost:8081/api/v1/location-managers -H "Authorization: Bearer $MANAGER" \
  -H "Content-Type: application/json" \
  -d '{"userAccountId":"01733e78-b75b-408b-b02f-40a53600698d","zoneId":"50000000-0000-0000-0000-000000000002","operationsManagerId":"40000000-0000-0000-0000-000000000001"}'
```
**Result: `201 Created`** — `{"locationManagerId":"8080676b-...","assignmentStatus":"ACTIVE","zoneName":"South Zone", ...}`
(`userAccountId` above is a throwaway `LOCATION_MANAGER`-role account created via
`POST /api/user-accounts` for this test.)

### `GET /api/v1/location-managers/{id}`
```bash
curl -s http://localhost:8081/api/v1/location-managers/8080676b-ae7c-4589-9407-7992bdb36083 -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`**

Negative case, bogus id:
```bash
curl -s http://localhost:8081/api/v1/location-managers/99999999-0000-0000-0000-000000000001 -H "Authorization: Bearer $ADMIN"
```
**Result: `404 Not Found`** — `{"message":"Location Manager not found: 99999999-...", ...}`

### `GET /api/v1/location-managers/active/by-zone/{zoneId}`
```bash
curl -s http://localhost:8081/api/v1/location-managers/active/by-zone/50000000-0000-0000-0000-000000000001 -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — resolves the seeded North Zone LM (`60000000-...-0001`).

### `GET /api/v1/location-managers`
```bash
curl -s "http://localhost:8081/api/v1/location-managers?status=ACTIVE" -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — paged list including seeded + throwaway assignments.

### `PUT /api/v1/location-managers/{id}/transfer`
```bash
curl -s -X PUT http://localhost:8081/api/v1/location-managers/8080676b-ae7c-4589-9407-7992bdb36083/transfer \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"userAccountId":"01733e78-b75b-408b-b02f-40a53600698d","zoneId":"50000000-0000-0000-0000-000000000003","operationsManagerId":"40000000-0000-0000-0000-000000000002"}'
```
**Result: `200 OK`** — moved to Central Zone / OM `...0002` (Coimbatore, matching city).

### `PATCH /api/v1/location-managers/{id}/operations-manager`
Business rule discovered live: the new OM must be in the **same city** as the LM's current zone.
```bash
curl -s -X PATCH http://localhost:8081/api/v1/location-managers/8080676b-ae7c-4589-9407-7992bdb36083/operations-manager \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"operationsManagerId":"40000000-0000-0000-0000-000000000001"}'
```
**Result: `422 Unprocessable Entity`** — `{"message":"Operations Manager and Zone must belong to the same City", ...}`
(expected: LM is now in Central Zone/Coimbatore, OM `...0001` is Chennai — cross-city rejected)

Valid same-city case:
```bash
curl -s -X PATCH http://localhost:8081/api/v1/location-managers/8080676b-ae7c-4589-9407-7992bdb36083/operations-manager \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"operationsManagerId":"40000000-0000-0000-0000-000000000002"}'
```
**Result: `200 OK`**

### `PATCH /api/v1/location-managers/{id}/deactivate`
```bash
curl -s -X PATCH http://localhost:8081/api/v1/location-managers/8080676b-ae7c-4589-9407-7992bdb36083/deactivate -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — `"assignmentStatus":"INACTIVE"` (throwaway assignment, zero pending
reviews, so the S2 guard's fast path returns clean — see business-logic doc for the `422`-blocked
case with a real pending review).

### `PATCH /api/v1/location-managers/{id}/activate`
```bash
curl -s -X PATCH http://localhost:8081/api/v1/location-managers/8080676b-ae7c-4589-9407-7992bdb36083/activate -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — `"assignmentStatus":"ACTIVE"`

No delete endpoint exists on this controller (confirmed from source — only the 8 routes above).

---

## OperationsManagerController

Base path `/api/v1/operations-managers`. Auth: **JWT: `SUPER_ADMIN` only**.

### `POST /api/v1/operations-managers`
```bash
curl -s -X POST http://localhost:8081/api/v1/operations-managers -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"userAccountId":"8c7ac701-86c5-425b-98ed-ccb91c8f5fb7","cityId":"20000000-0000-0000-0000-000000000003","assignmentStatus":"ACTIVE"}'
```
**Result: `201 Created`** — `{"id":"4a8715cc-...","cityName":"Bengaluru","assignmentStatus":"ACTIVE", ...}`
(`userAccountId` is a throwaway `OPERATIONS_MANAGER`-role account created for this test.)

### `GET /api/v1/operations-managers/{id}`
```bash
curl -s http://localhost:8081/api/v1/operations-managers/4a8715cc-b284-468a-839d-d8e21f37c653 -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`**

Negative case, bogus id:
```bash
curl -s http://localhost:8081/api/v1/operations-managers/99999999-0000-0000-0000-000000000001 -H "Authorization: Bearer $ADMIN"
```
**Result: `404 Not Found`** — `{"message":"Manager not found", ...}`

### `GET /api/v1/operations-managers/by-user/{id}`
```bash
curl -s http://localhost:8081/api/v1/operations-managers/by-user/8c7ac701-86c5-425b-98ed-ccb91c8f5fb7 -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — same record as above, looked up by `userAccountId`.

### `GET /api/v1/operations-managers`
```bash
curl -s "http://localhost:8081/api/v1/operations-managers?status=ACTIVE" -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — paged list, includes both seeded OMs plus the throwaway.

### `GET /api/v1/operations-managers/summary`
```bash
curl -s http://localhost:8081/api/v1/operations-managers/summary -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — `{"total":3,"active":3,"inactive":0,"suspended":0,"transferred":0}`

### `PUT /api/v1/operations-managers/{id}`
```bash
curl -s -X PUT http://localhost:8081/api/v1/operations-managers/4a8715cc-b284-468a-839d-d8e21f37c653 \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"cityId":"20000000-0000-0000-0000-000000000001","assignmentStatus":"ACTIVE"}'
```
**Result: `200 OK`** — `cityName` now `"Chennai"`.

### `PATCH /api/v1/operations-managers/{id}/city`
```bash
curl -s -X PATCH http://localhost:8081/api/v1/operations-managers/4a8715cc-b284-468a-839d-d8e21f37c653/city \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"cityId":"20000000-0000-0000-0000-000000000002"}'
```
**Result: `200 OK`** — `cityName` now `"Coimbatore"`, `version` bumped 0→1.

### `PATCH /api/v1/operations-managers/{id}/status`
```bash
curl -s -X PATCH http://localhost:8081/api/v1/operations-managers/4a8715cc-b284-468a-839d-d8e21f37c653/status \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"status":"SUSPENDED"}'
```
**Result: `200 OK`** — `"assignmentStatus":"SUSPENDED"`, `version` bumped 1→2.

### `DELETE /api/v1/operations-managers/{id}`
```bash
curl -s -X DELETE http://localhost:8081/api/v1/operations-managers/99999999-0000-0000-0000-000000000001 -H "Authorization: Bearer $ADMIN"
```
**Result (bogus id): `404 Not Found`** — `{"message":"Manager not found", ...}`
```bash
curl -s -X DELETE http://localhost:8081/api/v1/operations-managers/4a8715cc-b284-468a-839d-d8e21f37c653 -H "Authorization: Bearer $ADMIN"
```
**Result (valid, our throwaway): `204 No Content`**

---

## StateController

Base path `/api/states`. Auth: **JWT: `SUPER_ADMIN` only**.

### `POST /api/states`
```bash
curl -s -X POST http://localhost:8081/api/states -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"stateName":"Test State QA","countryCode":"IN","isActive":true}'
```
**Result: `201 Created`** — `{"id":"5b8ddae3-...","stateName":"Test State QA","countryCode":"IN","isActive":true}`

### `GET /api/states`
```bash
curl -s http://localhost:8081/api/states -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — `[{"stateName":"Tamil Nadu",...},{"stateName":"Karnataka",...}]`

### `GET /api/states/{id}`
```bash
curl -s http://localhost:8081/api/states/10000000-0000-0000-0000-000000000001 -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`**

Negative case, bogus id:
```bash
curl -s http://localhost:8081/api/states/99999999-0000-0000-0000-000000000001 -H "Authorization: Bearer $ADMIN"
```
**Result: `404 Not Found`** — `{"message":"State not found with ID: 99999999-...", ...}`

### `GET /api/states/country/{countryCode}`
```bash
curl -s http://localhost:8081/api/states/country/IN -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — both Tamil Nadu and Karnataka.

### `GET /api/states/active?isActive={bool}`
```bash
curl -s "http://localhost:8081/api/states/active?isActive=true" -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`**

### `PUT /api/states/{id}`
```bash
curl -s -X PUT http://localhost:8081/api/states/5b8ddae3-69a6-4466-be7f-7ea36d21af1b \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"stateName":"Test State QA Updated","countryCode":"IN","isActive":true}'
```
**Result: `200 OK`**

Negative case, bogus id:
```bash
curl -s -X PUT http://localhost:8081/api/states/99999999-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{"stateName":"X","countryCode":"IN","isActive":true}'
```
**Result: `404 Not Found`**

### `DELETE /api/states/{id}`
```bash
curl -s -X DELETE http://localhost:8081/api/states/99999999-0000-0000-0000-000000000001 -H "Authorization: Bearer $ADMIN"
```
**Result (bogus id): `404 Not Found`**
```bash
curl -s -X DELETE http://localhost:8081/api/states/5b8ddae3-69a6-4466-be7f-7ea36d21af1b -H "Authorization: Bearer $ADMIN"
```
**Result (valid, our throwaway state): `204 No Content`**

---

## UserAccountController

Base path `/api/user-accounts`. Auth: **JWT: `SUPER_ADMIN` only**.

### `POST /api/user-accounts`
```bash
curl -s -X POST http://localhost:8081/api/user-accounts -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"email":"qatest_throwaway@aroundu.local","phoneNumber":"9876543210","password":"Test@1234","firstName":"QA","lastName":"Throwaway","role":"OPERATIONS_MANAGER","accountStatus":"ACTIVE"}'
```
**Result: `201 Created`** — `{"id":"8c7ac701-...","email":"qatest_throwaway@aroundu.local","role":"OPERATIONS_MANAGER", ...}`

### `GET /api/user-accounts`
```bash
curl -s http://localhost:8081/api/user-accounts -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — full account list (seeded + all test throwaways created this session).

### `GET /api/user-accounts/{id}`
```bash
curl -s http://localhost:8081/api/user-accounts/8c7ac701-86c5-425b-98ed-ccb91c8f5fb7 -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`**

Negative case, bogus id:
```bash
curl -s http://localhost:8081/api/user-accounts/99999999-0000-0000-0000-000000000001 -H "Authorization: Bearer $ADMIN"
```
**Result: `404 Not Found`** — `{"message":"User account not found with ID: 99999999-...", ...}`

### `GET /api/user-accounts/search-by-email?email={email}`
```bash
curl -s "http://localhost:8081/api/user-accounts/search-by-email?email=admin@aroundu.local" -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — returns the seeded `admin@aroundu.local` record.

### `GET /api/user-accounts/role/{role}`
```bash
curl -s http://localhost:8081/api/user-accounts/role/CUSTOMER -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — list of `CUSTOMER`-role accounts.

### `GET /api/user-accounts/status/{accountStatus}`
```bash
curl -s http://localhost:8081/api/user-accounts/status/ACTIVE -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — list of `ACTIVE` accounts.

### `PUT /api/user-accounts/{id}`
```bash
curl -s -X PUT http://localhost:8081/api/user-accounts/8c7ac701-86c5-425b-98ed-ccb91c8f5fb7 \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"email":"qatest_throwaway@aroundu.local","phoneNumber":"9876543211","firstName":"QA","lastName":"ThrowawayUpdated","role":"OPERATIONS_MANAGER","accountStatus":"ACTIVE"}'
```
**Result: `200 OK`** — `lastName` and `phoneNumber` updated.

Negative case, bogus id:
```bash
curl -s -X PUT http://localhost:8081/api/user-accounts/99999999-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","phoneNumber":"9876543210","firstName":"X","lastName":"Y","role":"CUSTOMER","accountStatus":"ACTIVE"}'
```
**Result: `404 Not Found`**

### `PATCH /api/user-accounts/{id}/status`
```bash
curl -s -X PATCH http://localhost:8081/api/user-accounts/8c7ac701-86c5-425b-98ed-ccb91c8f5fb7/status \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{"accountStatus":"SUSPENDED"}'
```
**Result: `200 OK`** — `"accountStatus":"SUSPENDED"` (immediately restored to `ACTIVE` with a
follow-up call, same endpoint, to avoid leaving a throwaway account suspended).

### `PATCH /api/user-accounts/{id}/last-login`
```bash
curl -s -X PATCH http://localhost:8081/api/user-accounts/8c7ac701-86c5-425b-98ed-ccb91c8f5fb7/last-login -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — `lastLoginAt` stamped to current time.

### `DELETE /api/user-accounts/{id}`
**Not tested against a seeded account** (per instructions, seeded `UserAccount` rows must never
be hard-deleted). Tested against a second throwaway account created solely for this:
```bash
curl -s -X DELETE http://localhost:8081/api/user-accounts/99999999-0000-0000-0000-000000000001 -H "Authorization: Bearer $ADMIN"
```
**Result (bogus id): `404 Not Found`**
```bash
curl -s -X DELETE http://localhost:8081/api/user-accounts/4c00192f-ae06-48ca-89c4-855a946d7b95 -H "Authorization: Bearer $ADMIN"
```
**Result (valid, throwaway `qatest_delete_me@aroundu.local`): `204 No Content`**

---

## ZoneController

Base path `/api/v1/zones`. Auth: **JWT: `SUPER_ADMIN` or `OPERATIONS_MANAGER`**.

### `POST /api/v1/zones`
```bash
curl -s -X POST http://localhost:8081/api/v1/zones -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"cityId":"20000000-0000-0000-0000-000000000001","zoneName":"Test Zone QA"}'
```
**Result: `201 Created`** — `{"zoneId":"1d567a98-...","zoneName":"Test Zone QA","active":true, ...}`

### `GET /api/v1/zones/{id}`
```bash
curl -s http://localhost:8081/api/v1/zones/50000000-0000-0000-0000-000000000001 -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`**

Negative case, bogus id:
```bash
curl -s http://localhost:8081/api/v1/zones/99999999-0000-0000-0000-000000000001 -H "Authorization: Bearer $ADMIN"
```
**Result: `404 Not Found`** — `{"message":"Zone not found: 99999999-...", ...}`

### `GET /api/v1/zones`
```bash
curl -s "http://localhost:8081/api/v1/zones?cityId=20000000-0000-0000-0000-000000000001" -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — 3 zones for Chennai (North, South, our throwaway).

### `PUT /api/v1/zones/{id}`
```bash
curl -s -X PUT http://localhost:8081/api/v1/zones/1d567a98-0843-48af-8465-8d283f8ac8ac \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"cityId":"20000000-0000-0000-0000-000000000001","zoneName":"Test Zone QA Updated"}'
```
**Result: `200 OK`**

### `PATCH /api/v1/zones/{id}/deactivate`
```bash
curl -s -X PATCH http://localhost:8081/api/v1/zones/1d567a98-0843-48af-8465-8d283f8ac8ac/deactivate -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — `"active":false`

### `PATCH /api/v1/zones/{id}/activate`
```bash
curl -s -X PATCH http://localhost:8081/api/v1/zones/1d567a98-0843-48af-8465-8d283f8ac8ac/activate -H "Authorization: Bearer $ADMIN"
```
**Result: `200 OK`** — `"active":true`

No delete endpoint exists on this controller (confirmed from source — only the 6 routes above).

---

## Role-enforcement spot checks

A few extra live checks beyond the per-endpoint CRUD, confirming `SecurityConfig.java`'s declared
role restrictions actually hold and that the documented 401-vs-403 fix (see
`docs/SEED_DATA_CONTRACT.md` — `/error` needed to be added to `permitAll()`) is in place:

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:8081/api/states -H "Authorization: Bearer $CUSTOMER"
```
**Result: `403 Forbidden`** — `{"status":403,"error":"Forbidden", ...}` (SUPER_ADMIN-only route, correctly
rejects a CUSTOMER JWT with 403, not 401 — confirms the `/error` permitAll fix from
SEED_DATA_CONTRACT.md is live and working)

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:8081/api/v1/cities -H "Authorization: Bearer $CUSTOMER"
```
**Result: `403 Forbidden`**

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:8081/api/states
```
**Result: `401 Unauthorized`** (no JWT at all)

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:8081/internal/v1/states/10000000-0000-0000-0000-000000000001
```
**Result: `401 Unauthorized`** — `/internal/**` route with no Basic credentials.

---

## ⚠️ Bugs found

**None.** Re-verified on 2026-08-30 after adding the two new `InternalTerritoryController`
lookup endpoints above (for S3's human-readable address resolution). All 61 endpoints across the
13 controllers returned the expected status code and response shape for both their happy-path
and (where applicable) 404-style negative case. No 500s, no wrong status codes, no route
mismatches, and no divergence from the controller source were observed during this pass. Role
enforcement (`SUPER_ADMIN` / `OPERATIONS_MANAGER` / `SERVICE` gates) behaved exactly as declared
in `SecurityConfig.java`, including the documented 401-vs-403-on-`/error` fix still being in
effect live.

One apparent failure during this pass turned out to be a test-script mistake, not a bug: a
`PUT /location-managers/{id}/transfer` to North Zone correctly `409`'d because that zone already
has an active Location Manager (the seeded demo fixture) — the "one active LM per zone" rule
working as intended. Retried against a free zone and got `200` as expected.

---

## Post-test fixture integrity check

Confirmed at the end of this session:
- `LocationManager 60000000-0000-0000-0000-000000000001` — still `"assignmentStatus":"ACTIVE"`.
- `manager2@aroundu.local` and `admin@aroundu.local` — `passwordChangedOn` not touched by any
  call in this session (both remain at the previously-restored `NOW()`-era timestamp).
- No seeded `UserAccount` row was deleted. All `DELETE` calls in this document targeted
  purpose-created throwaway rows (`qatest_throwaway@...`, `qatest_delete_me@...`, throwaway
  State/City/Zone/OperationsManager rows).
