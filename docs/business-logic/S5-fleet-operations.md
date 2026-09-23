# S5 — Fleet Operations: Business Logic

Both endpoints live in `VehicleAssignmentServiceImpl.java`. The first tightens an existing
create path; the second is a brand-new analytics endpoint with no prior equivalent.

---

## 1. Cargo capacity / vehicle-type matching

**Endpoint:** `POST /api/assignments`

**Files:**
- [S5-fleet-operations/src/main/java/com/cbg/lbos/service/VehicleAssignmentServiceImpl.java](../../S5-fleet-operations/src/main/java/com/cbg/lbos/service/VehicleAssignmentServiceImpl.java) — `create()`, lines 38–68 (new checks at 49–58)
- [S5-fleet-operations/src/main/java/com/cbg/lbos/entity/VehicleAssignment.java](../../S5-fleet-operations/src/main/java/com/cbg/lbos/entity/VehicleAssignment.java) — new nullable `cargoWeightKg`/`requiredVehicleType` fields
- [S5-fleet-operations/src/main/java/com/cbg/lbos/dto/VehicleAssignmentDto.java](../../S5-fleet-operations/src/main/java/com/cbg/lbos/dto/VehicleAssignmentDto.java) — same two fields, flow through automatically via the existing `BeanUtils.copyProperties` mapping

### The gap before

`create()` already had real logic — license expiry, active-status checks on both vehicle and
driver, same-fleet-owner ownership match, and an active-assignment exclusivity check (no double
booking a vehicle or driver). What it had no concept of at all: whether the *vehicle itself* was
actually fit for the job it was about to be assigned to. A 750kg mini-truck could be assigned to
haul a 5-tonne load with no resistance, because nothing about "the job" was ever compared
against "the vehicle."

### The logic (step by step)

Two new, independent, **optional** checks, inserted after the existing ownership check and
before the existing exclusivity check — optional because they only fire when the caller
actually supplies the corresponding field, so every pre-existing caller that doesn't send them
is completely unaffected:

1. **Capacity check** — if `cargoWeightKg` is supplied: reject with `ConflictException`
   (`409`) unless `vehicle.getCapacityKg() >= cargoWeightKg`. Message names both numbers.
2. **Type check** — if `requiredVehicleType` is supplied (and non-blank): reject with
   `BadRequestException` (`400`) unless the vehicle's `vehicleType` matches, **case-insensitively**.

### Live verification

```
Vehicle A0000000-...-02: capacityKg=750.00, vehicleType=MINI_TRUCK

cargoWeightKg=1000 (exceeds 750):
  POST /api/assignments  ->  409  "Vehicle capacity (750.00kg) is insufficient for
    required cargo weight (1000kg)"

requiredVehicleType="TRUCK" (vehicle is MINI_TRUCK):
  POST /api/assignments  ->  400  "Vehicle type MINI_TRUCK does not match required type TRUCK"

cargoWeightKg=500, requiredVehicleType="mini_truck" (lowercase, valid):
  POST /api/assignments  ->  200  (created successfully - case-insensitive match confirmed)
```

All three cases fired exactly as designed against the live service, including confirming the
case-insensitive match actually works (not just documented as intended).

### What to say to the reviewer

> "The assignment endpoint already had solid eligibility checks — license expiry, active
> status, ownership, double-booking — but nothing about matching the *vehicle's own physical
> capability* to the job. I added two optional checks: cargo weight against the vehicle's rated
> capacity, and vehicle type against a required type, both rejecting with a clear message
> naming the mismatch. They're additive — a caller who doesn't supply either field sees no
> behavior change at all, so nothing existing breaks. I tested all three branches live: over
> capacity rejected at 409, wrong type rejected at 400, and a valid case-insensitive match
> succeeding."

**If asked "why optional instead of required?"**: making them required would be a breaking
change to every existing caller of this endpoint that doesn't yet send cargo/type information.
Optional-but-enforced-when-present is the standard way to add a stricter rule to an existing API
surface without a coordinated client migration.

---

## 2. Assignment reliability/churn analytics

**Endpoint:** `GET /api/assignments/reliability?vehicleId=...&driverId=...`

**Files:**
- [S5-fleet-operations/src/main/java/com/cbg/lbos/service/VehicleAssignmentServiceImpl.java](../../S5-fleet-operations/src/main/java/com/cbg/lbos/service/VehicleAssignmentServiceImpl.java) — `reliability()`, lines 106–140
- [S5-fleet-operations/src/main/java/com/cbg/lbos/dto/AssignmentReliabilityDto.java](../../S5-fleet-operations/src/main/java/com/cbg/lbos/dto/AssignmentReliabilityDto.java) — new response record
- [S5-fleet-operations/src/main/java/com/cbg/lbos/repository/VehicleAssignmentRepository.java](../../S5-fleet-operations/src/main/java/com/cbg/lbos/repository/VehicleAssignmentRepository.java) — new finders `findByVehicleIdAndAssignmentStatus`/`findByDriverIdAndAssignmentStatus`
- Controller route note: the actual base path on this controller is `/api/assignments`, not
  `/api/vehicle-assignments` — confirmed against the sibling `/active` and `/{id}/end` routes
  already there before this change.

### The gap before

No endpoint existed at all. `VehicleAssignment` tracked `assignedAt`/`endedAt` on every row, but
nothing ever aggregated that history into a signal — there was no way to tell, from the API,
whether a given vehicle or driver had a stable assignment history or was being rapidly
reassigned (a potential sign of a reliability problem with that vehicle or driver).

### The logic (step by step)

1. Requires at least one of `vehicleId`/`driverId` (`BadRequestException` if both are missing).
   Supports either alone, or both together (vehicle assignments filtered further down to just
   that driver, in-memory).
2. Loads every `ENDED` assignment matching the filter, and for each one with both `assignedAt`
   and `endedAt` populated, computes its duration in hours (`Duration.between(...).toMinutes() / 60.0`).
3. Averages those durations (`averageDurationHours`, rounded to 2 decimals).
4. Classifies:
   - `< 3` ended assignments → `"INSUFFICIENT_DATA"` (not enough history for the signal to
     mean anything)
   - `>= 3` ended assignments **and** average duration `< 168 hours` (one week) →
     `"HIGH_CHURN"`
   - `>= 3` ended assignments and average `>= 168 hours` → `"STABLE"`

### Live verification

```
Vehicle A0000000-...-01 (0 ended assignments so far):
  GET .../reliability?vehicleId=...-01  ->  endedAssignmentCount: 0, reliabilityFlag: "INSUFFICIENT_DATA"

Vehicle A0000000-...-02 after 3 create-then-immediately-end cycles (durations of a few seconds each):
  GET .../reliability?vehicleId=...-02  ->  endedAssignmentCount: 3, averageDurationHours: 0.00,
    reliabilityFlag: "HIGH_CHURN"
```

Both the "not enough data yet" and "high churn" branches were fired live by deliberately
driving a vehicle through three rapid create/end cycles and confirming the flag flips exactly
at the 3-assignment threshold.

### What to say to the reviewer

> "This is a brand-new endpoint — there was no equivalent before at all. `VehicleAssignment`
> already recorded start/end timestamps on every row, but nothing ever turned that history into
> a signal. I built an aggregation that flags a vehicle or driver as `HIGH_CHURN` when their
> average assignment duration is under a week across at least 3 ended assignments — short
> average tenure is a real proxy for 'something's wrong with this pairing, or this
> vehicle/driver keeps getting pulled off jobs early.' I proved both branches live: a fresh
> vehicle correctly reports `INSUFFICIENT_DATA`, and I drove a second vehicle through three
> rapid assignment/end cycles and watched it flip to `HIGH_CHURN` exactly once the third one
> completed, not before."

**If asked "why a minimum of 3 and a week threshold?"**: the minimum-sample floor exists so a
single unlucky short assignment doesn't brand a vehicle as unreliable on day one; the one-week
threshold is a simple, clearly-labeled placeholder for "assignments this short are unusual,"
again with no real operational history in this system to calibrate a tighter number against.
