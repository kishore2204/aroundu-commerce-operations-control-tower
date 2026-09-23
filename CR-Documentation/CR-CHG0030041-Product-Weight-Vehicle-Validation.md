# CHG0030041 — Product Weight Management and Vehicle Validation

## 1. CR Overview

| Item | Detail |
| --- | --- |
| CR number | CHG0030041 |
| Title | Product Weight Management and Vehicle Validation |
| Purpose | Let retailers record a weight for every product, total it per order, and stop a Fleet Manager from assigning an order to a vehicle that cannot carry it |
| Main affected area | S3 (catalogue), S4 (orders and trips), Retailer catalogue screen, Fleet "Delivery Requests" (assignments) screen |

## 2. Understanding the CR

**What was requested**

- A retailer maintains a weight (kg) for each product. It can be captured on the product form and edited later.
- The weight is used in order calculations.
- When a Fleet Manager assigns an order to a vehicle, the system compares the **total order weight** with the vehicle's **maximum capacity** and refuses the assignment if the order is heavier.

**Why it was required**

A truck or van has a fixed capacity in kg. Without a real weight per product there was no way to know whether an order fits in the vehicle.

**What the system now does**

```text
Product weight (kg)  →  order items  →  total order weight  →  vehicle capacity  →  Allow / Block
```

## 3. Existing Problem

- Products had **no weight field** anywhere (S3 `Product`, `ProductRequest`, bulk upload, S4 `OrderItem`).
- The Fleet Manager screen (`assignments.component.ts`) only *guessed* a weight from the number of items. The old code computed `Math.max(1, totalUnits)` and labelled it "UI estimate; product weight is not stored".
- The only capacity check was in the browser (the vehicle option was greyed out). The backend `TripService` did **not** check capacity, so a direct API call could assign any vehicle to any order.

## 4. Root Cause

1. **Missing data.** Weight was never stored, so there was nothing real to add up.
2. **Missing server-side rule.** The capacity rule existed only as a browser convenience based on an estimate. `TripService.create(...)` and `updateTripAssignment(...)` never compared order weight with `VehicleSummary.capacityKg`.

## 5. Solution

The solution stores weight in S3, copies it onto each order line in S4 when the line is written, totals it in one place, and enforces the capacity rule in the service that creates the trip.

```text
Retailer enters Weight (kg)
    ↓
Frontend catalogue form  →  PATCH/POST product  (weightKg)
    ↓
S3 ProductRequest (validated)  →  CatalogueServiceImpl.copyFields  →  products.weight_kg
    ↓
Customer places order → S4 OrderItemService fetches product from S3
    ↓
order_item.weight_kg_snapshot  (weight of ONE unit at order time)
    ↓
Fleet Manager opens Delivery Requests
    ↓
GET pending-fleet-assignment → OrderService → OrderWeightService (one batched query)
    ↓
OrderDto.totalWeightKg shown on screen
    ↓
Fleet Manager selects a vehicle and clicks Accept & Dispatch
    ↓
TripService.create / updateTripAssignment → validateVehicleCapacity
    ↓
weight <= capacity → trip saved        weight > capacity → 400 with clear message
```

Key design decisions taken from the code:

| Decision | Where |
| --- | --- |
| Weight is **kg only**, up to 3 decimals | `ProductRequest` (`@Digits(integer=6, fraction=3)`) |
| Blank / missing weight = **1 kg** | `Product.effectiveWeightKg()`, `OrderItem.effectiveWeightKg()` |
| Old products and old order lines need **no data migration** | Columns are nullable; `null` is read as 1 kg |
| Weight is **snapshotted** on the order line | So a later product edit cannot change an existing order's weight, and assignment needs no call to S3 |
| Each order is measured on its own | A multi-store checkout is several orders; they are never combined |
| Customers never see it | `OrderDto.totalWeightKg` is only filled by the fleet endpoint |

## 6. Implementation Details

### 6.1 Database

| Table | New column | Meaning |
| --- | --- | --- |
| `products` (S3) | `weight_kg numeric(10,3)`, nullable | Weight of one unit in kg |
| `order_item` (S4) | `weight_kg_snapshot numeric(10,3)`, nullable | Weight of one unit when the order line was written |

Both services use `spring.jpa.hibernate.ddl-auto=update`, so Hibernate adds the columns on startup. Existing rows keep `NULL`.

### 6.2 S3 — product weight (Backend)

- **`entity/Product.java`** → added `weightKg`, `DEFAULT_WEIGHT_KG = 1` and `effectiveWeightKg()` → one method that always returns a usable weight, so no caller repeats the null check.
- **`dto/request/ProductRequest.java`** → added optional `weightKg` with `@DecimalMin("0.001")` and `@Digits(integer=6, fraction=3)` → rejects zero, negative and over-precise values through the normal Bean Validation path (so create, update and bulk upload all get the same rule).
- **`service/impl/CatalogueServiceImpl.java`** → `copyFields(...)` stores `weightKg`, defaulting to 1 kg when empty. This method is shared by create, update and bulk upload, so all three behave the same.
- **`dto/response/ProductResponse.java` + `mapper/CommerceMapper.java`** → the response carries `weightKg` (from `effectiveWeightKg()`), so the edit form is pre-filled and S4 can read it.
- **`service/impl/BulkProductUploadService.java`** → new optional column **Weight (kg)** in the template and file; text/zero/negative values become a row error; a blank cell means 1 kg for a new product, and *keeps the current weight* for an existing product being updated.

### 6.3 S4 — order weight and capacity check (Backend)

- **`client/dto/ProductSummary.java`** → added `weightKg` so the product fetched from S3 carries the weight.
- **`service/OrderItemService.java`** → `copyDtoToEntity` calls `item.setWeightKgSnapshot(product.weightKg())` when the line is created.
- **`entity/OrderItem.java`** → new `weight_kg_snapshot` column and `effectiveWeightKg()` (null → 1).
- **`repository/OrderItemRepository.java`** → `findByOrder_IdIn(Collection<Long>)` loads the lines of many orders in **one** query (no N+1).
- **`service/OrderWeightService.java`** (new) → the single place that calculates `SUM(unit weight × quantity)`.
- **`dto/OrderDto.java`** → new `totalWeightKg`, populated only on the fleet endpoint.
- **`service/OrderService.java`** → `getPendingFleetAssignment()` fills `totalWeightKg` for every pending order using the batched calculation.
- **`service/TripService.java`** → `validateVehicleCapacity(orderId, vehicle)` is called in `create(...)` and in `updateTripAssignment(...)`, so both first assignment and re-assignment are protected. Failure is an `IllegalArgumentException`, which S4's `GlobalExceptionHandler` turns into **HTTP 400** with the message.

### 6.4 Frontend

- **`core/models/product.model.ts`** → `weightKg` on `Product` and `ProductRequest`.
- **`features/retailer/catalogue/catalogue.component.ts/.html`** → optional **Weight (kg)** field (`min 0.001`, `max 999999.999`), pre-filled on edit and sent with the request.
- **`core/models/order.model.ts`** → `totalWeightKg?`.
- **`features/fleet/assignments/assignments.component.ts/.html`** → shows **Total Order Weight** (from the server, no longer an estimate), shows the selected vehicle's capacity, shows the message under the vehicle picker when it is too small, and keeps **Accept & Dispatch** disabled (`canAccept` → `vehicleCanHandle`).

### 6.5 Validation summary

| Layer | Rule |
| --- | --- |
| Product form (browser) | Number between 0.001 and 999999.999 |
| S3 API | `weightKg` > 0, at most 3 decimals |
| Bulk upload | Must be a number, greater than 0, at most 3 decimals; blank allowed |
| S4 assignment | Total order weight must be `<=` vehicle `capacityKg`. If the vehicle has no recorded capacity, or the order has no items (logistics booking), there is nothing to check |

## 7. Execution Flow

**Happy path**

1. Retailer opens **Catalogue → Add product**, enters *Weight (kg)* `2.5`, saves. S3 stores `weight_kg = 2.5`.
2. A customer orders 4 units. S4 fetches the product from S3 and stores `weight_kg_snapshot = 2.5` on the line (`quantity = 4`).
3. The order reaches `FINDING_DELIVERY_PARTNER`. The Fleet Manager opens **Delivery Requests**; S4 returns the order with `totalWeightKg = 10`.
4. The Fleet Manager selects a vehicle with capacity 100 kg; the screen shows *Vehicle capacity: 100 kg*.
5. Accept & Dispatch → `TripService.create` → `10 <= 100` → trip is created.

**Alternate flows**

| Situation | Result |
| --- | --- |
| Weight field left empty | Product stored with 1 kg |
| Weight `0`, `-2`, or `abc` on the form/API | Rejected (`weightKg` validation) |
| Bulk row with weight `heavy` | Row rejected: *"Weight must be a number (in kg)."* |
| Bulk row with weight `0` or negative | Row rejected: *"Weight must be greater than 0 kg."* |
| Order weight 120 kg, vehicle capacity 100 kg | Screen shows the message and disables Accept; if the API is called directly, `TripService` returns 400 |
| Old order line with no snapshot | Counted as 1 kg per unit |
| Vehicle changed later (re-assignment) | Same check runs in `updateTripAssignment` |

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Backend S3 | `entity/Product.java` | `weightKg`, default 1 kg, `effectiveWeightKg()` |
| Backend S3 | `dto/request/ProductRequest.java` | Optional `weightKg` with validation |
| Service S3 | `service/impl/CatalogueServiceImpl.java` | `copyFields` stores weight (shared by create/update/bulk) |
| Service S3 | `service/impl/BulkProductUploadService.java` | Optional *Weight (kg)* column and its validation |
| Backend S3 | `dto/response/ProductResponse.java`, `mapper/CommerceMapper.java` | Returns weight |
| Backend S4 | `entity/OrderItem.java` | `weight_kg_snapshot` |
| Service S4 | `service/OrderItemService.java` | Copies product weight onto the line |
| Service S4 | `service/OrderWeightService.java` (new) | `SUM(unit weight × quantity)` |
| Repository S4 | `repository/OrderItemRepository.java` | Batched `findByOrder_IdIn` |
| Service S4 | `service/OrderService.java` | Adds `totalWeightKg` to pending fleet orders |
| Service S4 | `service/TripService.java` | `validateVehicleCapacity` on create and re-assign |
| Backend S4 | `client/dto/ProductSummary.java`, `dto/OrderDto.java` | Carry weight |
| Frontend | `catalogue.component.ts/.html` | Weight input on product form |
| Frontend | `assignments.component.ts/.html` | Total Order Weight, capacity, message, disabled Accept |
| Frontend | `product.model.ts`, `order.model.ts` | New fields |
| Tests | `OrderWeightServiceTest`, `TripServiceTest`, `BulkProductUploadServiceTest` | Weight, capacity and bulk-weight cases |

## 9. Important Code Changes

### 9.1 Product weight and default — `S3-commerce-customer/.../entity/Product.java`

Purpose: store the weight and give every caller a safe value.

```java
/** Weight of ONE unit in kilograms. NULL (products created before weights existed, or no weight given) means {@link #DEFAULT_WEIGHT_KG}. */
@Column(name="weight_kg",precision=10,scale=3) private BigDecimal weightKg;
public static final BigDecimal DEFAULT_WEIGHT_KG=BigDecimal.ONE;
public BigDecimal getWeightKg(){return weightKg;} public void setWeightKg(BigDecimal v){weightKg=v;}
/** The weight to use everywhere: the stored value, or 1 kg when none is stored. */
public BigDecimal effectiveWeightKg(){return weightKg==null?DEFAULT_WEIGHT_KG:weightKg;}
```

Explanation: `null` is legal in the database (old rows) but is never used directly; code always calls `effectiveWeightKg()`.

### 9.2 Validation — `S3-commerce-customer/.../dto/request/ProductRequest.java`

```java
/** Weight of one unit in kg. Optional: empty means 1 kg. Must be positive when given. */
@DecimalMin(value="0.001") @Digits(integer=6,fraction=3) BigDecimal weightKg) {
```

Explanation: a positive number with at most 3 decimals; `null` passes (optional).

### 9.3 Store it on create/update/bulk — `S3-commerce-customer/.../service/impl/CatalogueServiceImpl.java`

```java
product.setWeightKg(r.weightKg()==null?Product.DEFAULT_WEIGHT_KG:r.weightKg());
```

Explanation: the last statement of `copyFields(...)`, which every write path uses.

### 9.4 Bulk upload weight parsing — `S3-commerce-customer/.../service/impl/BulkProductUploadService.java`

```java
WEIGHT("Weight (kg)", false, "Optional, in kilograms (kg), greater than 0. Leave blank for 1 kg.", "weightkg", "weight"),
```

```java
// Weight is optional: blank -> null -> 1 kg. Anything else must be a positive number.
BigDecimal weight = null;
if (!cell.get(Column.WEIGHT).isEmpty()) {
    weight = decimal(cell.get(Column.WEIGHT));
    if (weight == null) {
        errors.put(Column.WEIGHT, "Weight must be a number (in kg).");
```

```java
case "DecimalMin" -> column == Column.WEIGHT ? "Weight must be greater than 0 kg." : "Price must be greater than 0.";
case "Digits" -> column == Column.WEIGHT ? "Weight can have at most 3 decimal places." : "Price can have at most 2 decimal places.";
```

```java
// A blank weight cell means "not supplied": keep the product's current (effective) weight.
java.math.BigDecimal weight = uploaded.weightKg() != null ? uploaded.weightKg() : existing.effectiveWeightKg();
```

Explanation: the column is optional; each row error names the exact reason; updating a product with a blank weight does not reset it.

### 9.5 Snapshot weight on the order line — `S4-order-logistics/.../service/OrderItemService.java`

```java
ProductSummary product = fetchProduct(dto.getProductId());

item.setSkuSnapshot(product.sku());
item.setProductNameSnapshot(product.name());
item.setWeightKgSnapshot(product.weightKg());
```

Explanation: same moment and same style as the existing SKU/name snapshot.

### 9.6 Order-line storage — `S4-order-logistics/.../entity/OrderItem.java`

```java
@Column(name = "weight_kg_snapshot", precision = 10, scale = 3)
private BigDecimal weightKgSnapshot;

/** Per-unit weight to use in calculations: the snapshot, or 1 kg when none was recorded. */
public BigDecimal effectiveWeightKg() {
    return weightKgSnapshot == null ? BigDecimal.ONE : weightKgSnapshot;
}
```

### 9.7 Total order weight — `S4-order-logistics/.../service/OrderWeightService.java`

```java
/** Total weight of one order in kg, or null when the order has no items (e.g. a logistics booking). */
public BigDecimal totalWeightKg(Long orderId) {
    List<OrderItem> items = orderItemRepository.findByOrder_Id(orderId);
    return items.isEmpty() ? null : sum(items);
}

/** Total weight per order for many orders with ONE item query; orders without items are absent. */
public Map<Long, BigDecimal> totalWeightKgByOrderId(Collection<Long> orderIds) {
    Map<Long, BigDecimal> totals = new HashMap<>();
    if (orderIds == null || orderIds.isEmpty()) {
        return totals;
    }
    for (OrderItem item : orderItemRepository.findByOrder_IdIn(orderIds)) {
        totals.merge(item.getOrder().getId(), lineWeight(item), BigDecimal::add);
    }
    return totals;
}

private static BigDecimal lineWeight(OrderItem item) {
    int quantity = item.getQuantity() == null ? 0 : item.getQuantity();
    return item.effectiveWeightKg().multiply(BigDecimal.valueOf(quantity));
}
```

Explanation: unit weight × quantity, summed per order; the batch version keeps each order separate and uses one query for all pending orders.

### 9.8 Show the weight to the fleet — `S4-order-logistics/.../service/OrderService.java`

```java
public List<OrderDto> getPendingFleetAssignment() {
    List<Order> pending = orderRepository.findByOrderStatusIn(List.of("FINDING_DELIVERY_PARTNER", "BOOKING_CONFIRMED"));
    // Fleet managers see each order's total weight before assigning it (one item query for all orders).
    java.util.Map<Long, java.math.BigDecimal> weights =
            orderWeightService.totalWeightKgByOrderId(pending.stream().map(Order::getId).toList());
    return pending.stream().map(order -> {
        OrderDto dto = toDto(order);
        dto.setTotalWeightKg(weights.get(order.getId()));
        return dto;
    }).toList();
}
```

### 9.9 The capacity rule — `S4-order-logistics/.../service/TripService.java`

```java
validateVehicle(vehicle);
validateVehicleCapacity(order.getId(), vehicle);   // in create(...)
validateDriver(driver);
```

```java
validateVehicle(vehicle);
validateVehicleCapacity(trip.getOrder().getId(), vehicle);   // in updateTripAssignment(...)
validateDriver(driver);
```

```java
private void validateVehicleCapacity(Long orderId, VehicleSummary vehicle) {
    BigDecimal capacityKg = vehicle.capacityKg();
    BigDecimal orderWeightKg = orderWeightService.totalWeightKg(orderId);
    if (capacityKg == null || orderWeightKg == null || orderWeightKg.compareTo(capacityKg) <= 0) {
        return;
    }
    throw new IllegalArgumentException("Order weight (" + OrderWeightService.format(orderWeightKg)
            + " kg) exceeds the selected vehicle capacity (" + OrderWeightService.format(capacityKg)
            + " kg). Please select another vehicle.");
}
```

Explanation: runs before the trip is saved. `S4 GlobalExceptionHandler` maps `IllegalArgumentException` to a 400 response with the message.

### 9.10 Retailer form — `frontend/src/app/features/retailer/catalogue/catalogue.component.ts`

```ts
weightKg: [null as number | null, [Validators.min(0.001), Validators.max(999999.999)]],
```

```ts
const { name, sku, categoryId, unitPrice, stock, status, description, lowStockThreshold, weightKg } = this.form.getRawValue();
const request = { name, sku, categoryId: categoryId!, unitPrice, stock, status, description, lowStockThreshold, weightKg };
```

`catalogue.component.html`:

```html
<label class="form-label">Weight (kg) (optional)</label>
<input class="input" type="number" min="0.001" step="0.001" formControlName="weightKg" placeholder="1" />
@if (form.controls.weightKg.invalid) {
  <span class="text-xs text-rose-600">Weight must be a positive number in kg.</span>
} @else {
  <span class="text-xs text-slate-400">Weight of one unit in kg. Leave blank for 1 kg.</span>
}
```

### 9.11 Fleet screen — `frontend/src/app/features/fleet/assignments/assignments.component.ts`

```ts
// The order's real total weight (unit weight x quantity) is calculated by the server.
const totalWeightKg = order.totalWeightKg ?? null;
```

```ts
capacityError(order: Order): string | null {
  const vehicle = this.selectedVehicle(order);
  const weight = this.contextFor(order)?.approximateWeightKg;
  if (!vehicle || weight == null || this.vehicleCanHandle(vehicle, order)) return null;
  return `Order weight (${this.formatKg(weight)} kg) exceeds the selected vehicle capacity (${this.formatKg(vehicle.capacityKg!)} kg). Please select another vehicle.`;
}
```

```ts
canAccept(order: Order): boolean {
  const vehicleId = this.selectedVehicleIds[order.id];
  const driverId = this.selectedDriverIds[order.id];
  const vehicle = this.availableVehicles().find((item) => item.vehicleId === vehicleId);
  return !!(this.fleetOwnerId && vehicleId && driverId && vehicle && this.vehicleCanHandle(vehicle, order));
}
```

`assignments.component.html`:

```html
<p class="text-xs font-bold uppercase tracking-wide text-slate-400">{{ order.orderType === 'RETAIL' ? 'Total Order Weight' : 'Approx. load' }}</p>
...
@if (selectedVehicle(order); as vehicle) {
  <span class="text-xs text-slate-500">Vehicle capacity: {{ vehicle.capacityKg == null ? 'not recorded' : (vehicle.capacityKg | number: '1.0-3') + ' kg' }}</span>
}
@if (capacityError(order); as message) {
  <span class="text-xs text-rose-600">{{ message }}</span>
}
```

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| Product data | No weight | Optional weight in kg (default 1 kg) |
| Order weight | Guessed in the browser from item count | `SUM(unit weight × quantity)` calculated by S4 |
| Capacity check | Browser only, based on the guess | Enforced in `TripService` on create and re-assign, plus shown in the browser |
| Bulk upload | No weight column | Optional *Weight (kg)* column with row-level errors |
| Existing data | — | Works without migration (`null` = 1 kg) |
| Customers | — | Order weight and vehicle capacity are never sent to customer screens |
| Performance | — | One batched item query for all pending orders |

## 11. Testing

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Add product with weight `2.5` | Saved; edit form shows `2.5` |
| 2 | Add product with weight left empty | Saved as 1 kg |
| 3 | Weight `0`, `-1`, or `abc` | Field error / API rejects |
| 4 | Weight `1.2345` (4 decimals) | API rejects it (max 3 decimals); the error is shown on the form |
| 5 | Bulk file: weight `heavy`, `0`, `-2`, `0.5` | First three rejected with the messages above; `0.5` created |
| 6 | Bulk update, weight cell blank | Product keeps its existing weight |
| 7 | Order 4 × 2.5 kg, vehicle 100 kg | Screen shows *Total Order Weight 10 kg*; dispatch succeeds |
| 8 | Order 120 kg, vehicle 100 kg | Message *"Order weight (120 kg) exceeds the selected vehicle capacity (100 kg). Please select another vehicle."*; Accept disabled |
| 9 | Same order sent directly to the trip API | HTTP 400 with the same message; no trip saved |
| 10 | Order exactly equal to capacity | Allowed |
| 11 | Order with old lines (no snapshot) | Each unit counted as 1 kg |
| 12 | Customer order screens | No weight/capacity fields |

Automated tests: `OrderWeightServiceTest` (16 kg case, null-weight case, no-items case, many orders in one query), `TripServiceTest` (120 vs 100, exact capacity), `BulkProductUploadServiceTest` (blank/invalid/updated weights).

## 12. Final Result

Retailers can now maintain product weights (form and bulk upload). Every order line carries a weight, the fleet screen shows the real total order weight, and an order that is heavier than the selected vehicle can no longer be assigned — on the screen **and** on the server.

---

## Test Files Created for This CR

These are the backend test files that belong to this change request (paths from the project root):

| Test file | What it checks |
| --- | --- |
| `S4-order-logistics/src/test/java/com/cbg/lbos/service/OrderWeightServiceTest.java` | Order weight = SUM(unit weight x quantity), default 1 kg. |
| `S4-order-logistics/src/test/java/com/cbg/lbos/service/TripServiceTest.java` | Vehicle capacity validation on trip create and re-assign. |
| `S3-commerce-customer/src/test/java/com/lbos/commercecustomer/service/BulkProductUploadServiceTest.java` | Optional Weight (kg) column and its validation in the bulk upload. |

---

## Main Code Location

| Item | Location |
| --- | --- |
| File | `S4-order-logistics/src/main/java/com/cbg/lbos/service/TripService.java` |
| Place | method `validateVehicleCapacity(Long, VehicleSummary)` |
| Why this is the main place | Rejects a trip whose order weight exceeds the vehicle capacity. |

A banner comment `CR_CHG0030041_Product_Weight_Vehicle_Validation_3240010` marks this place in the source code.
