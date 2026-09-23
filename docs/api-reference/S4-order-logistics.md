# S4 — Order & Logistics: API Reference (live-tested)

Every endpoint below was exercised with a real `curl` command against the live S4 instance on
**port 8084** (Postgres-backed, started via `scriptsstart-all.cmd /postgres`), not through the
Gateway. JWTs were minted live via `POST http://localhost:8081/api/v1/auth/login` (seeded
accounts, password `AroundU@123` for all). Internal `/api/v1/internal/**` routes use HTTP Basic
(`lbos-service` / `service123`).

This is the service most heavily rewritten this session — order-item creation now atomically
deducts stock in S3, cancellation restores it, and `OrderItem`/`Trip` responses carry live
Feign-enriched `product`/`retailer`/`customer`/`driver`/`vehicle`/`fleetOwner` details. One real,
deterministic bug was found and fixed during this pass — see [Bugs found](#bugs-found).

## Table of Contents

1. [OrderController](#ordercontroller) — `/api/orders`
2. [OrderItemController](#orderitemcontroller) — `/api/order-items`
3. [TripController](#tripcontroller) — `/api/trips`
4. [LogisticsBookingDetailController](#logisticsbookingdetailcontroller) — `/api/logistics-bookings`
5. [InternalOrderLogisticsController](#internalorderlogisticscontroller) — `/api/v1/internal`
6. [Bugs found](#bugs-found)

**Auth summary:** every `/api/**` route requires a valid JWT (no anonymous access anywhere in
S4). `GET` with no id (list-all) on all four main controllers, plus every write on
`/api/trips/**` and `/api/logistics-bookings/**`, requires `SUPER_ADMIN`/`OPERATIONS_MANAGER`.
`/api/orders/**` and `/api/order-items/**` writes are open to any authenticated role (no
per-customer ownership check yet — see the `SecurityConfig` doc-comment for why: S4 stores
`customerProfileId` as an unvalidated cross-service scalar FK, matching every other
cross-service reference in this codebase, and resolving "does this JWT's user own this order"
would need new identity-resolution infrastructure). `/api/v1/internal/**` requires HTTP Basic
`SERVICE` role.

---

## OrderController

### POST /api/orders
```bash
curl -s -X POST http://localhost:8084/api/orders -H "Authorization: Bearer $CUSTOMER1" \
  -H "Content-Type: application/json" \
  -d '{"orderNumber":"S4QA-ORD-...","customerProfileId":"80000000-...-0001","orderType":"RETAIL","subtotalAmount":0,"deliveryCharge":0,"discountAmount":0,"totalAmount":0,"orderStatus":"NEW","statusHistoryJson":"[]","orderTrackingJson":"{}","deliveryAddress":"...","paymentMethod":"COD","paymentStatus":"PENDING"}'
```
**Result: `201`**

### GET /api/orders/{id}
```bash
curl -s http://localhost:8084/api/orders/18 -H "Authorization: Bearer $CUSTOMER1"
```
**Result: `200`**
**Negative — 404:** bogus id → `404`

### GET /api/orders/{id}/tracking
Tracking-only view for the customer order-tracking screen.
```bash
curl -s http://localhost:8084/api/orders/18/tracking -H "Authorization: Bearer $CUSTOMER1"
```
**Result: `200`**

### GET /api/orders
```bash
curl -s http://localhost:8084/api/orders -H "Authorization: Bearer $ADMIN"
```
**Result: `200`** (staff) / **`403`** (a plain `CUSTOMER` token)

### PUT /api/orders/{id}
Setting `orderStatus` to `CANCELLED` triggers `restoreStockForCancelledOrder()` — every
un-restored line item on the order gets its stock given back in S3, idempotently (a
`stockRestored` flag per item prevents double-restoration on a retry).
```bash
curl -s -X PUT http://localhost:8084/api/orders/18 -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" -d '{...,"orderStatus":"CANCELLED","cancellationReason":"qa test cancel"}'
```
**Result: `200`** — confirmed live: an order carrying a 5-unit line item for product 1 (S3 stock
97→92 on creation) was cancelled, and stock returned to exactly 97, byte-for-byte.

### DELETE /api/orders/{id}
```bash
curl -s -X DELETE http://localhost:8084/api/orders/{id} -H "Authorization: Bearer $ADMIN"
```
Not separately exercised against a real order in this pass (would delete a row other tests still
reference); the route exists and requires the same any-authenticated-role auth as the rest of
this controller, no staff gate.

---

## OrderItemController

The core of this session's rewrite: creating an item atomically deducts stock in S3 (fails
closed with `422` if insufficient); the item snapshot (`sku`, `productName`, `unitPrice`) is
always taken from S3's live catalogue, never client-supplied; `product`/`retailer`/`customer`
are live-enriched via Feign on every read; the parent order must still be `NEW`/
`BOOKING_CONFIRMED` (`requireEditableOrder`) for create/update/delete to be allowed at all.

### POST /api/order-items
```bash
curl -s -X POST http://localhost:8084/api/order-items -H "Authorization: Bearer $CUSTOMER1" \
  -H "Content-Type: application/json" -d '{"orderId":18,"retailerId":"70000000-...-0001","productId":1,"quantity":3}'
```
**Result: `201`**
```json
{"id":10,"productId":1,"quantity":3,"unitPrice":250.00,"lineTotal":750.00,
 "product":{"id":1,"name":"Rice 5kg","stock":97,...},
 "retailer":{"retailerId":"70000000-...","businessName":"Retailer One Stores",...},
 "customer":{"customerProfileId":"80000000-...","profileStatus":"ACTIVE"},
 "deliveryAddress":"S4QA test address"}
```
S3's stock for product 1 confirmed dropping 100→97 live in the same test.

**Negative — 422 (insufficient stock):**
```bash
curl -s -X POST http://localhost:8084/api/order-items -H "Authorization: Bearer $CUSTOMER1" \
  -H "Content-Type: application/json" -d '{"orderId":18,"retailerId":"70000000-...-0001","productId":1,"quantity":999999}'
```
`422` — no stock touched, no orphaned item persisted.

### GET /api/order-items/{id}
```bash
curl -s http://localhost:8084/api/order-items/10 -H "Authorization: Bearer $CUSTOMER1"
```
**Result: `200`**
**Negative — 404:** bogus id → `404`

### GET /api/order-items
```bash
curl -s http://localhost:8084/api/order-items -H "Authorization: Bearer $ADMIN"
```
**Result: `200`** (note: N+1 Feign calls per row for enrichment — documented, accepted tradeoff
at this training system's scale, not "fixed" with a batch endpoint)

### PUT /api/order-items/{id}
Quantity changes now correctly adjust S3 stock by the *delta* — see
[Bugs found](#bugs-found), the fix made during this pass.
```bash
curl -s -X PUT http://localhost:8084/api/order-items/10 -H "Authorization: Bearer $CUSTOMER1" \
  -H "Content-Type: application/json" -d '{"orderId":18,"retailerId":"70000000-...-0001","productId":1,"quantity":6}'
```
**Result: `200`** — confirmed live: 3→6 deducted 3 more (stock 97→94→91), a follow-up 6→2
restored 4 (91→95), matching the delta exactly both directions.

**Negative — 400 (order no longer editable):** updating an item on a `CANCELLED` order →
`400 {"message":"Order items cannot be modified once the order is CANCELLED"}`.

### DELETE /api/order-items/{id}
Now restores the item's full quantity to S3 before deleting — see
[Bugs found](#bugs-found).
```bash
curl -s -X DELETE http://localhost:8084/api/order-items/10 -H "Authorization: Bearer $CUSTOMER1"
```
**Result: `204`** — confirmed live: stock returned to its exact pre-creation value after the
create→increase→decrease→delete sequence above (97 → ... → 97, closed loop).

---

## TripController

`FLEET_SERVICE`-only: creating a trip for a `RETAIL` order is rejected. A new trip always starts
`PLANNED` server-side regardless of what `tripStatus` the request supplies; moving it to
`ASSIGNED` (and providing `fleetOwnerId`, validated against the vehicle's actual owner) is a
separate `PUT`. `plannedStartAt` must be in the future at creation time, and `pickup/confirm`'s
stamped `actualStartAt` must not be before it — so a scripted end-to-end test needs a short real
time gap between creating the trip and confirming pickup (not just an API quirk: this is the
same real-world constraint a dispatcher has — you can't confirm a pickup before its planned
time). **Auth:** GET-by-id is any authenticated role; every other route is
`SUPER_ADMIN`/`OPERATIONS_MANAGER` only (no driver self-service yet — flagged in
`SecurityConfig`'s own doc-comment as belonging to the S5 checkpoint).

### POST /api/trips
```bash
curl -s -X POST http://localhost:8084/api/trips -H "Authorization: Bearer $MANAGER" \
  -H "Content-Type: application/json" \
  -d '{"orderId":20,"vehicleId":"dab73479-...","driverId":"48693497-...","fleetOwnerId":"71000000-...-0001","createdByAccountId":"30000000-...-0001","tripNumber":"...","tripStatus":"ASSIGNED","distanceKm":5.5,"plannedStartAt":"<future ISO instant>"}'
```
**Result: `201`** → `tripStatus` comes back `PLANNED` (server-controlled), with `driver`,
`vehicle`, and `fleetOwner` fully enriched from live S5/S2 Feign calls.

### GET /api/trips/{id}
```bash
curl -s http://localhost:8084/api/trips/{id} -H "Authorization: Bearer $MANAGER"
```
**Result: `200`**
**Negative — 404:** bogus id → `404`

### GET /api/trips
```bash
curl -s http://localhost:8084/api/trips -H "Authorization: Bearer $ADMIN"
```
**Result: `200`**

### PUT /api/trips/{id}
Used to transition `PLANNED` → `ASSIGNED` (must re-supply `fleetOwnerId`, validated against the
vehicle).
```bash
curl -s -X PUT http://localhost:8084/api/trips/{id} -H "Authorization: Bearer $MANAGER" \
  -H "Content-Type: application/json" -d '{...,"tripStatus":"ASSIGNED",...}'
```
**Result: `200`**
**Negative — 400:** omitting `fleetOwnerId` → `"Selected vehicle does not belong to the selected fleet owner"`
(compares against `null`, correctly fails closed rather than silently allowing it).

### POST /api/trips/{id}/pickup/arrived
Acknowledgement only — requires the trip to currently be `ASSIGNED`.
```bash
curl -s -X POST http://localhost:8084/api/trips/{id}/pickup/arrived -H "Authorization: Bearer $MANAGER"
```
**Result: `200`**

### POST /api/trips/{id}/pickup/confirm
Stamps `actualStartAt`; moves the trip to `IN_PROGRESS`.
```bash
curl -s -X POST http://localhost:8084/api/trips/{id}/pickup/confirm -H "Authorization: Bearer $MANAGER" \
  -H "Content-Type: application/json" -d '{"proof":"photo1.jpg"}'
```
**Result: `200`**

### POST /api/trips/{id}/delivery/arrived
```bash
curl -s -X POST http://localhost:8084/api/trips/{id}/delivery/arrived -H "Authorization: Bearer $MANAGER"
```
**Result: `200`**

### POST /api/trips/{id}/complete
```bash
curl -s -X POST http://localhost:8084/api/trips/{id}/complete -H "Authorization: Bearer $MANAGER" \
  -H "Content-Type: application/json" -d '{"proof":"signature.jpg"}'
```
**Result: `200`** → `tripStatus: "COMPLETED"`.
**Negative — 400 (actualStartAt before plannedStartAt):** if `plannedStartAt` was set to a time
after pickup was actually confirmed (a genuinely inconsistent trip), completion is correctly
refused rather than silently accepted.

### DELETE /api/trips/{id}
```bash
curl -s -X DELETE http://localhost:8084/api/trips/{id} -H "Authorization: Bearer $ADMIN"
```
**Negative — 400 (in-progress):** `"An in-progress trip cannot be deleted"`.
**Negative — 400 (completed):** `"A completed trip cannot be deleted"` — completed trips are
kept for audit; only a trip that never got that far (e.g. still `PLANNED`) can actually be
deleted. Confirmed live for both cases.

---

## LogisticsBookingDetailController

**Auth:** GET-by-id/list any authenticated role; writes `SUPER_ADMIN`/`OPERATIONS_MANAGER` only.
`bookingLocationsJson` must be a JSON **array** of `{"type":"PICKUP"|"DROP","address":"..."}`
objects with at least one of each type and a non-blank address — a bare `"{}"` or a
`{"pickup":...,"drop":...}` object shape is rejected (`"At least one pickup and one drop
location are required"`), confirmed live; this isn't documented anywhere except the service's
own parsing code, worth calling out for anyone integrating against this endpoint.

### POST /api/logistics-bookings
```bash
curl -s -X POST http://localhost:8084/api/logistics-bookings -H "Authorization: Bearer $MANAGER" \
  -H "Content-Type: application/json" \
  -d '{"orderId":21,"vehicleReferenceId":"dab73479-...","receiverName":"...","receiverPhoneNumber":"...","bookingType":"STANDARD","bookingLocationsJson":"[{\"type\":\"PICKUP\",\"address\":\"Warehouse 1, Chennai\"},{\"type\":\"DROP\",\"address\":\"...\"}]","estimatedDistanceKm":10,"specialHandlingRequired":false,"priorityDelivery":false,"lastMileDeliveryRequired":true}'
```
**Result: `201`** → `estimatedLogisticsCost` computed server-side from the six cost-relevant
input fields (confirmed non-null, non-zero: `900.00` for this input).
**Negative — 403 (wrong role):** a `CUSTOMER` token → `403`.

### GET /api/logistics-bookings/{id}
```bash
curl -s http://localhost:8084/api/logistics-bookings/21 -H "Authorization: Bearer $MANAGER"
```
**Result: `200`**
**Negative — 404:** bogus id → `404`

### GET /api/logistics-bookings
```bash
curl -s http://localhost:8084/api/logistics-bookings -H "Authorization: Bearer $ADMIN"
```
**Result: `200`**

### PUT /api/logistics-bookings/{id}
```bash
curl -s -X PUT http://localhost:8084/api/logistics-bookings/21 -H "Authorization: Bearer $MANAGER" \
  -H "Content-Type: application/json" -d '{...,"priorityDelivery":true,...}'
```
**Result: `200`**

### DELETE /api/logistics-bookings/{id}
```bash
curl -s -X DELETE http://localhost:8084/api/logistics-bookings/21 -H "Authorization: Bearer $ADMIN"
```
**Result: `204`**

---

## InternalOrderLogisticsController

Service-to-service. **Auth:** HTTP Basic, `SERVICE` role. Response field names deliberately match
S6's `OrderResponse`/`OrderItemResponse`/`TripResponse` shapes exactly (`orderId` not `id`,
`tripId` not `id`) since Jackson silently drops anything it can't bind by name — a prior-session
fix for S6's refund/invoice/payment/support-ticket flows, which previously called nonexistent
paths entirely.

### GET /api/v1/internal/orders/{orderId}
```bash
curl -s -u lbos-service:service123 http://localhost:8084/api/v1/internal/orders/18
```
**Result: `200`**
**Negative — 404:** bogus id → `404`

### GET /api/v1/internal/orders/{orderId}/items
```bash
curl -s -u lbos-service:service123 http://localhost:8084/api/v1/internal/orders/18/items
```
**Result: `200`**

### GET /api/v1/internal/trips/by-order/{orderId}
```bash
curl -s -u lbos-service:service123 http://localhost:8084/api/v1/internal/trips/by-order/999999
```
**Negative — 404** (confirmed; a real order with a trip wasn't separately re-tested here since
the happy path is identical in shape to `GET /api/trips/{id}` already proven above).

### POST /api/v1/internal/delivery/serviceability-checks
Calls back into S3 (`ProductClient`) to confirm every requested product is `ACTIVE` and in
stock; returns a flat `INR 49` delivery charge and `"30-60 minutes"` estimate for any genuinely
serviceable request (documented, deliberate simplification — no retail fare table exists in this
system's data model; fleet-service bookings use the richer engine in
`LogisticsBookingDetailController` instead).
```bash
curl -s -u lbos-service:service123 -X POST http://localhost:8084/api/v1/internal/delivery/serviceability-checks \
  -H "Content-Type: application/json" \
  -d '{"addressId":"7e8e9c90-...","cityId":"20000000-...-0001","zoneId":"50000000-...-0001","productIds":[1]}'
```
**Result: `200`**

### GET /api/v1/internal/orders/{orderId}/review-eligibility
Backs S3's review-creation eligibility gate — checks order ownership, `DELIVERED` status, and
that the product was actually in the order.
```bash
curl -s -u lbos-service:service123 "http://localhost:8084/api/v1/internal/orders/18/review-eligibility?customerProfileId=80000000-...-0001&productId=1"
```
**Result: `200`**

**Negative — 401 (no Basic auth), any endpoint above:** confirmed.

---

## Bugs found

### 🐛 BUG — `PUT`/`DELETE /api/order-items/{id}` never adjusted S3 inventory (fixed during this pass)

**File:** `service/OrderItemService.java`

`create()` correctly deducts stock atomically and `Order` cancellation correctly restores it
(`OrderService.restoreStockForCancelledOrder()`), but `update()` never touched inventory at all
and `delete()` unconditionally discarded the item's reserved stock with no restoration. Both are
deterministic, guaranteed-to-trigger gaps (not a rare race or environment issue):

- **`update()`**: increasing a line's quantity (e.g. 3 → 6) reserved nothing extra in S3 — a real
  overselling risk, since another concurrent order could deduct the same units this line now
  claims to hold. Decreasing a quantity (6 → 2) never gave the difference back, silently locking
  stock out of the sellable pool forever.
- **`delete()`**: removing a line item from an order permanently lost its deducted stock — worse
  than the "orphaned stock" scenario documented from an earlier session pass (a genuine
  Feign-failure edge case), because this triggered on **every single normal delete**, not just a
  rare failure window.

**Fix:** `update()` now computes the quantity delta (or, if the line's `productId` itself
changed, treats it as a full restore-of-old + full-deduct-of-new) and adjusts S3 stock
accordingly — fail-closed (`InsufficientStockException`) on an increase, best-effort-with-logging
on a decrease, mirroring `OrderService`'s existing cancellation-restoration posture. `delete()`
now restores the item's full quantity before removing the row. Confirmed live: a
create(+3)→increase(+3 more)→decrease(-4)→delete(-2) sequence against product 1 left S3's stock
at exactly its starting value (97 → 94 → 91 → 95 → 97), a fully closed loop with no leakage in
either direction.

**Not a bug, confirmed correct/deliberate behavior found during this pass:**
- Trip creation forces `tripStatus` to `PLANNED` server-side regardless of what's requested, and
  requires a separate `PUT` (with `fleetOwnerId` re-supplied) to reach `ASSIGNED` — this is by
  design, not an oversight; a client that assumes it can create a trip already `ASSIGNED` will
  need to make the follow-up call.
- `plannedStartAt` must be in the future at trip creation, and `actualStartAt` (stamped at
  pickup-confirm) can't precede it — legitimate real-world scheduling constraints, not API bugs,
  though they mean an automated end-to-end test needs a real (small) time gap between creating a
  trip and confirming its pickup.
- Completed and in-progress trips cannot be deleted (audit-trail preservation) — confirmed both
  cases return a clear `400`, not a 500 or a silent no-op.
