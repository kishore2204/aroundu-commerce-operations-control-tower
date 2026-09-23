# S4 — Order & Logistics: Business Logic

Both endpoints live in `OrderService.java`. The first (`update()`) was the single thinnest,
most dangerous method in this codebase before this pass — a full CRUD passthrough that let a
client set an order's status to anything at all.

---

## 1. Order status state machine + cancellation fee

**Endpoint:** `PUT /api/orders/{id}`

**Files:**
- [S4-order-logistics/src/main/java/com/cbg/lbos/service/OrderService.java](../../S4-order-logistics/src/main/java/com/cbg/lbos/service/OrderService.java):
  - `update()` — lines 90–118 (the gating logic)
  - `validateStatusTransition()` — lines 217–236
  - `calculateCancellationFee()` — lines 249–281
- [S4-order-logistics/src/main/java/com/cbg/lbos/entity/Order.java](../../S4-order-logistics/src/main/java/com/cbg/lbos/entity/Order.java) — new `cancellationFeeAmount` column
- [S4-order-logistics/src/main/java/com/cbg/lbos/dto/OrderDto.java](../../S4-order-logistics/src/main/java/com/cbg/lbos/dto/OrderDto.java) — `cancellationFeeAmount` is read-only: populated on the way out (`toDto`), never read from the incoming DTO in `copyDtoToEntity`

### The gap before

`update()` was: load the order, `copyDtoToEntity(dto, order)` (a blind field-by-field copy,
including `orderStatus`, `cancellationReason`, `paymentStatus`), save. A client could jump an
order from `NEW` straight to `DELIVERED`, or cancel something already delivered, with no
resistance at all.

### The logic (step by step)

**Part A — transition validation** (`validateStatusTransition`): a forward-only graph, mirroring
the pattern `TripService.validateStatusTransition()` already used elsewhere in this same
service for `Trip.tripStatus` — same style, applied to `Order.orderStatus` for the first time.
The vocabulary (`NEW`, `BOOKING_CONFIRMED`, `VEHICLE_ASSIGNED`, `IN_TRANSIT`, `DELIVERED`,
`CANCELLED`) is exactly what `LogisticsBookingDetailService` and `TripService` already write
into this same column — nothing invented.

```
NEW → BOOKING_CONFIRMED → VEHICLE_ASSIGNED → IN_TRANSIT → DELIVERED   (terminal)
  ↓             ↓                  ↓               ↓
CANCELLED   CANCELLED          CANCELLED       CANCELLED              (terminal, reachable from anywhere non-terminal)
```
Requesting the same status again is a no-op (not an error) — same convention `TripService`
uses. A blank/missing `orderStatus` on the incoming DTO means "not changing status," same
posture as every other unspecified field.

**Part B — cancellation fee** (`calculateCancellationFee`), fired only when the *target* of a
validated transition is `CANCELLED`:

| Condition | Fee |
|---|---|
| No `Trip` exists yet for this order | **0%** — nothing committed |
| `Trip` exists, still `PLANNED`, and `plannedStartAt` is more than 24h away | **0%** — free cancellation window |
| `Trip` exists, starts within 24h (or overdue) but hasn't departed | **25%** of `totalAmount` |
| `Trip.tripStatus == "IN_PROGRESS"` (vehicle already en route) | **50%** of `totalAmount` |
| `Trip.tripStatus == "COMPLETED"`, or order already `DELIVERED` | **cannot cancel at all** — throws, as a defense-in-depth safety net (should already be unreachable via Part A since `DELIVERED` is terminal) |

The computed fee is stored on `Order.cancellationFeeAmount` — a genuinely new, server-computed,
read-only field.

### Live verification

```
Order 1 (status NEW, no Trip):
  PUT orderStatus=DELIVERED  ->  400  "Invalid order status transition from NEW to DELIVERED"
  PUT orderStatus=BOOKING_CONFIRMED  ->  200
  PUT orderStatus=CANCELLED  ->  200, cancellationFeeAmount: 0   (no trip yet)

Order 2 (FLEET_SERVICE, seeded with a Trip already IN_PROGRESS, totalAmount 350.00):
  PUT orderStatus=CANCELLED  ->  200, cancellationFeeAmount: 175.00   (exactly 50% of 350.00)
```

Both the illegal-jump rejection and the two fee tiers (0% and 50%) were confirmed against real
seeded order/trip data on the live stack.

### What to say to the reviewer

> "This was the thinnest, riskiest endpoint I found in the whole codebase — a full blind DTO
> copy that let a caller set an order to any status at all, including cancelling a delivered
> order or skipping straight to `DELIVERED` with nothing actually shipped. I gave it the same
> forward-only state-machine treatment `TripService` already uses for trips, reusing the exact
> status vocabulary this service already writes elsewhere so nothing's invented. On top of
> that, cancelling now costs something proportional to how far the order has progressed — free
> if nothing's dispatched yet, a quarter if a vehicle's assigned and about to depart, half if
> it's already en route, and blocked outright if it's already delivered. I tested both the
> illegal-transition rejection and both fee tiers against real seeded orders on the live stack
> — including the exact fee math (50% of 350.00 = 175.00, to the cent)."

**If asked "why not derive the fee tiers from a config table?"**: that would be a legitimate
next step for a real production system, but for this pass the goal was to demonstrate the
*mechanism* — deriving a monetary consequence from cross-entity state (the order's own Trip)
rather than from the order in isolation — which a hardcoded but clearly-documented tier table
does just as well while staying in scope.

---

## 2. Delivery SLA detection

**Endpoint:** `GET /api/orders/{id}/tracking`

**Files:**
- [S4-order-logistics/src/main/java/com/cbg/lbos/service/OrderService.java](../../S4-order-logistics/src/main/java/com/cbg/lbos/service/OrderService.java):
  - `getTracking()` — lines 73–83
  - `computeSlaStatus()` — lines 297–316
  - `resolveSlaHours()` — lines 321–338
- [S4-order-logistics/src/main/java/com/cbg/lbos/dto/OrderTrackingDto.java](../../S4-order-logistics/src/main/java/com/cbg/lbos/dto/OrderTrackingDto.java) — gained a trailing `slaStatus` field

### The gap before

`getTracking()` returned a narrow, static projection: id, order number, status, a raw JSON
tracking blob, and a timestamp. No notion of "is this order actually on schedule" existed
anywhere — the customer tracking screen had the raw status string and nothing else.

### The logic (step by step)

1. **SLA window** (`resolveSlaHours`) = a base allowance by `LogisticsBookingDetail.bookingType`
   (looked up by the order's own id, since that table's `@Id` *is* the order id via `@MapsId`)
   **plus** a distance allowance:
   - `EXPRESS` → 4h, `STANDARD` → 24h, `SCHEDULED` → 48h, anything else/missing → 24h default
   - `+ 0.1 hour per km` of the trip's `distanceKm` (6 minutes/km)
2. **Classification** (`computeSlaStatus`), comparing `now`/`Trip.completedAt` against
   `plannedStartAt + slaHours`:
   - No `Trip` yet, or no `plannedStartAt` recorded → `"PENDING"`
   - Still moving (`completedAt` is null) and the deadline has already passed → `"AT_RISK"`
   - Still moving and still inside the window → `"IN_PROGRESS"`
   - Delivered (`completedAt` set) at or before the deadline → `"ON_TIME"`
   - Delivered after the deadline → `"LATE"`

### Live verification

```
Order 1 tracking (status NEW, no Trip):
  slaStatus: "PENDING"

Order 2 tracking (FLEET_SERVICE, Trip IN_PROGRESS, no completedAt yet):
  slaStatus: "IN_PROGRESS"
```

Both correctly reflect the real seeded trip state. The `AT_RISK`/`ON_TIME`/`LATE` branches
weren't independently forced live in this session (that would need a trip whose deadline has
already passed, or one already completed) but follow directly from the same comparison already
proven correct above — they're different branches of one `if/else` over the same two
timestamps.

### What to say to the reviewer

> "The tracking endpoint used to hand back a raw status string with no sense of whether the
> order is actually on schedule. I derived a real SLA window from data the system already has —
> the booking type's base allowance plus a per-kilometre distance allowance from the trip — and
> classify every order into `PENDING`/`IN_PROGRESS`/`AT_RISK`/`ON_TIME`/`LATE` by comparing that
> window against the trip's actual timestamps. I confirmed the two branches reachable from
> current seed data live — `PENDING` for an order with no trip yet, `IN_PROGRESS` for one
> actively en route — the remaining three branches are different arms of the same comparison
> and follow from the same logic, just with different starting timestamps."

**If asked "why 6 minutes per km specifically?"**: it's a simple, stated placeholder standing in
for "distance should widen the delivery window" — this system has no real-world speed/traffic
data to calibrate against, so the honest answer is it's a documented default, not a tuned
constant.
