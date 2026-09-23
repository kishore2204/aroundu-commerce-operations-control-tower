# CHG0030044 — Enhanced Customer Order Tracker Experience

## 1. CR Overview

| Item | Detail |
| --- | --- |
| CR number | CHG0030044 |
| Title | Enhanced Customer Order Tracker Experience |
| Purpose | Show the order tracker horizontally, and for an order that ships from several stores let the customer switch between stores on the same page, each with its own status, milestones, driver, ETA and progress |
| Main affected area | S4 order service (new tracking-group endpoint) and the customer **Order detail** page with the shared order-status stepper |

## 2. Understanding the CR

**What was requested**

- Horizontal tracker instead of the vertical one.
- For an order containing deliveries from more than one store: a **store dropdown in the top-right** of the tracking page. Switching stores must not leave the page.
- Each store view shows order status, tracking milestones, assigned driver information, estimated delivery timeline and delivery progress for that store only.

**Why it was required**

A checkout that spans several shops creates one order per shop. Each shop can be at a different stage, but the customer had a single-order view and had to leave the page to see another shop's order.

**What the system now does**

```text
Customer opens Order → one poll returns every store's tracking
   → dropdown (only when more than one store) → pick a store
   → horizontal stepper + ETA + driver card for that store
```

## 3. Existing Problem

- The tracker was a **vertical** list.
- The order page tracked **one order only** (`GET /api/orders/{id}/tracking`). For a multi-shop checkout the other shops' orders were separate pages.
- Driver, vehicle and phone details and an ETA were not part of the customer tracking view.

## 4. Root Cause

- The order model is deliberately **one order per shop** (own status, own trip). Nothing tied together "the orders created by the same checkout", and there was no stored checkout id.
- The tracking API returned one order's tracking only, and the page was built around a single order.
- The stepper component was styled as a vertical list.

## 5. Solution

The order architecture is **unchanged**: every shop keeps its own order, status and trip. A new read-only endpoint returns all shops of the checkout in one payload, and the page renders one selected shop at a time.

```text
Customer opens /orders/{id}
    ↓
order-detail.component  (polls every 5 s)
    ↓
GET /api/orders/{id}/tracking-group
    ↓
OrderTrackingGroupController
    ↓
OrderTrackingGroupService.getGroup
    ↓  finds sibling orders (same customer, type, address, payment method, created within 2 s)
    ↓  for each order → OrderService.getTracking (existing per-order tracking)
    ↓  + shop name (S2), driver/vehicle/fleet owner (S5/S2/S1) once a trip exists, ETA
    ↓
OrderTrackingGroupDto { shops: [ { orderId, shopName, tracking, delivery, etaText } ] }
    ↓
Frontend: dropdown switches the selected shop in memory (no reload)
    ↓
order-status-stepper (horizontal) + ETA + Delivery details card
```

## 6. Implementation Details

### 6.1 Grouping (Backend — `OrderTrackingGroupService`)

There is no stored checkout id, so the group is **derived** from what checkout already writes: every shop's order is created in the same instant for the same customer with the same delivery address and payment method. `siblingsOf(anchor)` selects orders with the same customer profile and order type within ±2 seconds (`SAME_CHECKOUT_WINDOW`) and keeps those with equal delivery address and payment method. A single-shop order (or a logistics booking) is simply a group of one.

Repository: `OrderRepository.findByCustomerProfileIdAndOrderTypeAndOrderDateBetweenOrderByIdAsc(...)`.

### 6.2 Per-store data (`toShopTracking`)

| Field | Source |
| --- | --- |
| `tracking` | The **existing** `OrderService.getTracking(orderId)` (status, `steps`, `haltedState`, `displayStage`, SLA) — unchanged and reused |
| `shopName` | First `retailerId` on the order's items → S2 `RetailerClient.getRetailer(...).businessName()`. Never an id |
| `delivery` | Only if the order has a trip and is not halted: fleet-owner business name (S2), vehicle registration number (S5), driver name and phone (driver → S5, contact → S1 `UserAccountClient.getUserContact`) |
| `etaText` | Countdown from the retail estimate (`RETAIL_DELIVERY_ESTIMATE_MAX_MINUTES = 60`) measured from order placement, e.g. `Within 35 minutes`; `Arriving shortly` after; `null` when delivered/cancelled/rejected/unavailable or not a retail order |

Display-only lookups (shop name, driver info) go through a small in-memory cache (5-minute TTL, max 1000 entries) so the 5-second poll does not repeat the same Feign calls. A failed lookup leaves that one field empty and never fails tracking.

### 6.3 Milestones

The milestones are the existing 9 retail stages derived in `OrderService`: *Order Placed → Waiting for Retailer → Retailer Accepted → Finding Delivery Partner → Delivery Partner Accepted → Going to Shop → Order Picked Up → Out for Delivery → Delivered*. A logistics booking uses its own 7 stages. Each step is `DONE`, `CURRENT` or `PENDING`. Halted states (`RETAILER_REJECTED`, `SHOP_UNAVAILABLE`, `CANCELLED`) are reported through `haltedState` instead of `steps`.

### 6.4 Controller

`OrderTrackingGroupController` adds `GET /api/orders/{id}/tracking-group`. The existing `GET /api/orders/{id}/tracking` is untouched.

### 6.5 Frontend

- **`order.service.ts`** → `getTrackingGroup(id)`.
- **`order.model.ts`** → `OrderTrackingGroup`, `ShopTracking`, `OrderDeliveryInfo`.
- **`order-detail.component.ts`** →
  - one `interval(5000)` poll for the whole group (never one per shop);
  - `shops`, `selectedOrderId`, `selectedShop`, `tracking` are signals/computed values;
  - `hasMultipleShops` decides whether the dropdown is rendered;
  - `selectShop` changes the displayed shop **in memory**; a shop's order and items are fetched only the first time it is selected;
  - `overallStatus` (Delivered / Partially Delivered / In Progress / Cancelled) is **derived** from the shop statuses, nothing new is stored;
  - polling stops when every shop is in a final state.
- **`order-detail.component.html`** → dropdown in the top-right of the header, the "Overall" line, the stepper, the **Estimated delivery** line and the **Delivery details** card (fleet owner, driver, vehicle number, phone) for the selected shop.
- **`order-status-stepper` (ts/html/css)** → horizontal layout: equal-width columns, a continuous progress line drawn from the centre of the previous step to the centre of the next, current step highlighted, long labels wrap, and it scrolls sideways (and scrolls the current step into view when it changes) if the columns do not fit.

## 7. Execution Flow

1. Customer places an order containing products from two shops. Checkout creates two orders (one per shop).
2. Customer opens the tracking page of either order.
3. The page calls `GET /api/orders/{id}/tracking-group` immediately and then every 5 seconds.
4. The backend returns both shops with their own tracking, ETA and (if assigned) driver details.
5. The header shows a **shop dropdown** (top-right) and *"Your items shipped from 2 shops – pick a shop to see its tracking. Overall: In Progress"*.
6. The customer selects the other shop; the stepper, ETA and driver card change instantly without navigation.
7. When one shop's order is delivered, its stepper shows all steps done while the other shop continues; Overall becomes *Partially Delivered*.
8. When all shops are delivered/cancelled/rejected, polling stops.

**Alternate flows**

| Situation | Behavior |
| --- | --- |
| Single-store order or logistics booking | No dropdown; group of one |
| Shop rejected the order or did not respond | Stepper replaced by the halted banner (with "Find Another Shop") for that shop only |
| No driver assigned yet | Delivery details card not shown |
| A lookup (shop name, driver phone) fails | The field is left out; tracking still works. If the shop name is missing the dropdown shows "Shop 1", "Shop 2" |
| Delivered / cancelled | No ETA text |
| Two different checkouts to different addresses | Not grouped |

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Controller (S4) | `controller/OrderTrackingGroupController.java` | New `GET /api/orders/{id}/tracking-group` |
| Service (S4) | `service/OrderTrackingGroupService.java` | Groups sibling orders, adds shop name, delivery info, ETA, caching |
| DTO (S4) | `dto/OrderTrackingGroupDto.java` | Group / shop / delivery-info shapes |
| Client (S4) | `client/UserAccountClient.java`, `client/dto/UserContactSummary.java` | Driver name and phone lookup |
| Controller (S4) | `controller/InternalOrderLogisticsController.java` | Shared `RETAIL_DELIVERY_ESTIMATE_MAX_MINUTES` constant |
| Frontend | `features/orders/order-detail/order-detail.component.ts/.html` | One poll, store dropdown, ETA, driver card |
| Frontend | `shared/order-status-stepper/*` | Horizontal stepper |
| Frontend | `core/services/order.service.ts`, `core/models/order.model.ts` | API call and types |
| Tests | `OrderTrackingGroupServiceTest` | Grouping, driver info, ETA |

## 9. Important Code Changes

### 9.1 New endpoint — `S4-order-logistics/.../controller/OrderTrackingGroupController.java`

```java
@RestController
@RequestMapping("/api/orders")
public class OrderTrackingGroupController {
    ...
    @GetMapping("/{id}/tracking-group")
    public ResponseEntity<OrderTrackingGroupDto> getTrackingGroup(@PathVariable Long id) {
        return ResponseEntity.ok(trackingGroupService.getGroup(id));
    }
}
```

### 9.2 Response shape — `S4-order-logistics/.../dto/OrderTrackingGroupDto.java`

```java
public record OrderTrackingGroupDto(List<ShopTrackingDto> shops) {

    public record ShopTrackingDto(
            Long orderId,
            String orderNumber,
            String shopName,
            OrderTrackingDto tracking,
            DeliveryInfoDto delivery,
            String etaText) {
    }

    /** What a customer may see about the person delivering their order. */
    public record DeliveryInfoDto(String fleetOwnerBusinessName, String driverName, String vehicleNumber,
            String phoneNumber) {
    }
}
```

### 9.3 Grouping the orders of one checkout — `.../service/OrderTrackingGroupService.java`

```java
public OrderTrackingGroupDto getGroup(Long orderId) {
    Order anchor = orderRepository.findById(orderId)
            .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
    List<Order> orders = "RETAIL".equalsIgnoreCase(anchor.getOrderType()) ? siblingsOf(anchor) : List.of(anchor);
    return new OrderTrackingGroupDto(orders.stream().map(this::toShopTracking).toList());
}

private List<Order> siblingsOf(Order anchor) {
    LocalDateTime from = anchor.getOrderDate().minus(SAME_CHECKOUT_WINDOW);
    LocalDateTime to = anchor.getOrderDate().plus(SAME_CHECKOUT_WINDOW);
    List<Order> siblings = orderRepository
            .findByCustomerProfileIdAndOrderTypeAndOrderDateBetweenOrderByIdAsc(
                    anchor.getCustomerProfileId(), anchor.getOrderType(), from, to)
            .stream()
            .filter(order -> Objects.equals(order.getDeliveryAddress(), anchor.getDeliveryAddress())
                    && Objects.equals(order.getPaymentMethod(), anchor.getPaymentMethod()))
            .toList();
    return siblings.stream().anyMatch(order -> order.getId().equals(anchor.getId())) ? siblings : List.of(anchor);
}
```

### 9.4 Store-specific tracking, shop name, driver card — same file

```java
private ShopTrackingDto toShopTracking(Order order) {
    OrderTrackingDto tracking = orderService.getTracking(order.getId());
    boolean halted = tracking.haltedState() != null;
    Trip trip = halted ? null : tripRepository.findByOrder_Id(order.getId()).orElse(null);
    return new ShopTrackingDto(order.getId(), order.getOrderNumber(), shopNameOf(order), tracking,
            trip == null ? null : deliveryInfoOf(trip), etaTextOf(order));
}
```

```java
/** Only built once a fleet owner has assigned a driver (a trip exists) - never before. */
private DeliveryInfoDto deliveryInfoOf(Trip trip) {
    String key = "delivery|" + trip.getId() + "|" + trip.getDriverId() + "|" + trip.getVehicleId();
    return cached(key, () -> {
        String fleetOwner = quietly(() -> fleetOwnerClient.getFleetOwner(trip.getFleetOwnerId()).businessName());
        String vehicle = quietly(() -> vehicleClient.getVehicle(trip.getVehicleId()).registrationNumber());
        var contact = quietly(() -> userAccountClient
                .getUserContact(driverClient.getDriver(trip.getDriverId()).userAccountId()));
        String driverName = contact == null ? ""
                : (nullToEmpty(contact.firstName()) + " " + nullToEmpty(contact.lastName())).trim();
        return new DeliveryInfoDto(fleetOwner, driverName.isEmpty() ? null : driverName, vehicle,
                contact == null ? null : contact.phoneNumber());
    });
}
```

### 9.5 Estimated delivery — same file

```java
private String etaTextOf(Order order) {
    if (ETA_NOT_APPLICABLE.contains(order.getOrderStatus()) || !"RETAIL".equalsIgnoreCase(order.getOrderType())) {
        return null;
    }
    long minutesLeft = InternalOrderLogisticsController.RETAIL_DELIVERY_ESTIMATE_MAX_MINUTES
            - Duration.between(order.getOrderDate(), LocalDateTime.now()).toMinutes();
    if (minutesLeft <= 0) {
        return "Arriving shortly";
    }
    return "Within " + minutesLeft + (minutesLeft == 1 ? " minute" : " minutes");
}
```

### 9.6 Milestone definition (existing, reused) — `S4-order-logistics/.../service/OrderService.java`

```java
private static final String[] STEP_KEYS = {
        "ORDER_PLACED", "WAITING_FOR_RETAILER", "RETAILER_ACCEPTED", "FINDING_DELIVERY_PARTNER",
        "DELIVERY_PARTNER_ACCEPTED", "GOING_TO_SHOP", "ORDER_PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"
};
private static final String[] STEP_LABELS = {
        "Order Placed", "Waiting for Retailer", "Retailer Accepted", "Finding Delivery Partner",
        "Delivery Partner Accepted", "Going to Shop", "Order Picked Up", "Out for Delivery", "Delivered"
};
```

### 9.7 One poll for the whole checkout — `frontend/src/app/features/orders/order-detail/order-detail.component.ts`

```ts
this.pollSubscription = interval(POLL_INTERVAL_MS)
  .pipe(
    startWith(0),
    switchMap(() => this.orderService.getTrackingGroup(id).pipe(catchError(() => EMPTY))),
  )
  .subscribe((group) => this.applyGroup(group));
```

```ts
private applyGroup(group: OrderTrackingGroup): void {
  this.shops.set(group.shops);
  if (!group.shops.some((shop) => shop.orderId === this.selectedOrderId())) {
    const fallback = group.shops.find((shop) => shop.orderId === this.routeOrderId) ?? group.shops[0];
    if (fallback) this.selectShop(fallback.orderId);
  }
  const allFinal = group.shops.every((shop) => TERMINAL_ORDER_STATUSES.has(shop.tracking.orderStatus?.toUpperCase() ?? ''));
  if (group.shops.length > 0 && allFinal) this.pollSubscription?.unsubscribe();
}
```

### 9.8 Store selection in memory — same file

```ts
readonly hasMultipleShops = computed(() => this.shops().length > 1);
readonly overallStatus = computed(() => {
  const statuses = this.shops().map((shop) => shop.tracking.orderStatus?.toUpperCase() ?? '');
  if (statuses.length === 0) return '';
  const delivered = statuses.filter((s) => s === 'DELIVERED').length;
  const halted = statuses.filter((s) => TERMINAL_ORDER_STATUSES.has(s) && s !== 'DELIVERED').length;
  if (delivered === statuses.length) return 'Delivered';
  if (halted === statuses.length) return 'Cancelled';
  if (delivered > 0) return 'Partially Delivered';
  return 'In Progress';
});
```

```ts
/** Switches the displayed shop. No navigation and no reload: tracking is already in memory and
 *  a shop's order/items are fetched only the first time it is selected. */
selectShop(orderId: number | string): void {
  const id = Number(orderId);
  if (id === this.selectedOrderId() && this.loadedOrders()[id]) return;
  this.selectedOrderId.set(id);
  ...
  this.loadOrderDetails(id, false);
}
```

### 9.9 Dropdown, ETA and driver card — `order-detail.component.html`

```html
@if (hasMultipleShops()) {
  <select class="select !w-auto min-w-[10rem]" aria-label="Shop" [value]="selectedOrderId()" (change)="selectShop($any($event.target).value)">
    @for (shop of shops(); track shop.orderId; let i = $index) {
      <option [value]="shop.orderId" [selected]="shop.orderId === selectedOrderId()">{{ shopLabel(shop, i) }}</option>
    }
  </select>
}
```

```html
<app-order-status-stepper [steps]="t.steps" [haltedState]="t.haltedState"></app-order-status-stepper>
@if (selectedShop()?.etaText; as eta) {
  <p class="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
    <i class="fa-regular fa-clock text-violet-500"></i> Estimated delivery: <span class="text-zepto-700">{{ eta }}</span>
  </p>
}
@if (selectedShop()?.delivery; as d) {
  ...
  @if (d.fleetOwnerBusinessName) { <p><span class="text-slate-400">Fleet owner</span><br><strong>{{ d.fleetOwnerBusinessName }}</strong></p> }
  @if (d.driverName) { <p><span class="text-slate-400">Driver</span><br><strong>{{ d.driverName }}</strong></p> }
  @if (d.vehicleNumber) { <p><span class="text-slate-400">Vehicle number</span><br><strong>{{ d.vehicleNumber }}</strong></p> }
  @if (d.phoneNumber) { <p><span class="text-slate-400">Phone number</span><br><strong>{{ d.phoneNumber }}</strong></p> }
}
```

### 9.10 Horizontal stepper — `frontend/src/app/shared/order-status-stepper/order-status-stepper.component.css`

```css
.stepper-scroll {
  overflow-x: auto;
  padding: 0.25rem 0 0.5rem;
}

.stepper {
  display: flex;
  width: 100%;
  min-width: calc(var(--steps, 1) * 96px);
}

.step {
  position: relative;
  flex: 1 1 0;
  min-width: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.step::before {
  content: '';
  position: absolute;
  top: 14px; /* vertical centre of the 28px marker */
  left: -50%;
  width: 100%;
  height: 3px;
  transform: translateY(-50%);
  background: #e2e8f0;
  z-index: 0;
}

.step.line-done::before {
  background: #059669;
}
```

`order-status-stepper.component.ts` (bring the current step into view only when the step changes):

```ts
ngOnChanges(): void {
  const currentKey = this.steps?.find((step) => step.state === 'CURRENT')?.key ?? null;
  if (!currentKey || currentKey === this.lastCurrentKey) return;
  this.lastCurrentKey = currentKey;
  setTimeout(() => {
    const container = this.host.nativeElement.querySelector<HTMLElement>('.stepper-scroll');
    const current = container?.querySelector<HTMLElement>('.state-current');
    if (!container || !current || container.scrollWidth <= container.clientWidth) return;
    container.scrollLeft = current.offsetLeft - (container.clientWidth - current.offsetWidth) / 2;
  });
}
```

### 9.11 API call — `frontend/src/app/core/services/order.service.ts`

```ts
/** Tracking for every shop-specific order from the same checkout as `id`, in one request. */
getTrackingGroup(id: number): Observable<OrderTrackingGroup> {
  return this.http.get<OrderTrackingGroup>(`/api/orders/${id}/tracking-group`);
}
```

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| Layout | Vertical tracker | Horizontal stepper with a continuous progress line |
| Multi-store orders | One order per page | One page, store dropdown (top-right) shown only when more than one store |
| Status per store | Separate pages | Each store's own status and milestones |
| Driver information | Not on the customer tracker | Fleet owner, driver, vehicle number and phone, once a driver is assigned |
| ETA | Not shown | Countdown from the existing 30–60 minute retail estimate |
| Polling | One request per order | One request for the whole checkout |
| Performance | — | Display-only lookups cached for 5 minutes; each shop's order and items fetched once |
| Data model | — | Unchanged — no schema change, no merged orders |

## 11. Testing

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Order from one shop | Horizontal stepper, no dropdown, no "Overall" line |
| 2 | Checkout with products from two shops | Dropdown top-right lists both **shop names**; "Overall: In Progress" |
| 3 | Switch shops | Stepper, ETA and driver card change without page reload or navigation |
| 4 | Shop A accepted, shop B still waiting | Each shop shows its own current step |
| 5 | Fleet owner assigns a driver to shop A only | Delivery details card appears for A only |
| 6 | Deliver shop A | A shows all steps done; Overall = "Partially Delivered"; polling continues |
| 7 | Shop B rejects | B shows the halted banner with "Find Another Shop"; A unaffected |
| 8 | Two checkouts to different addresses | Not grouped |
| 9 | All shops final | Polling stops (no further tracking-group requests) |
| 10 | Narrow screen | Stepper scrolls sideways; current step scrolled into view |
| 11 | Network check while polling | One `tracking-group` request per 5 s, not one per shop |

Automated: `OrderTrackingGroupServiceTest` — same-checkout grouping with shop names, different address not grouped, driver details only once a trip exists and no ids exposed, ETA countdown and its removal when delivered/halted.

## 12. Final Result

The customer sees one horizontal tracker for the whole checkout, chooses a store from a dropdown, and sees that store's own status, milestones, driver details and estimated delivery without leaving the page — with a single poll and no change to how orders are stored.

---

## Addendum - switching shops no longer flashes "Order not found"

**Problem found later:** on the tracking page of a checkout with several shops, picking another shop in the dropdown showed "Order not found" for a moment. The tracking of every shop is already in memory, but the shop's own order and items are fetched the first time it is picked; until they arrived the page had no order to show and fell into the "not found" branch.

**Change (frontend only, `order-detail.component.ts` / `.html`):** the dropdown value (`selectedOrderId`) and the shop the page body shows (`viewOrderId`) are separate. The body moves to the newly picked shop only when that shop's order and items have loaded; meanwhile the previous shop stays visible with a thin loading bar, and "Order not found" appears only when loading really failed.

**Checked live:** switching between the two shops of a two-shop order - no "Order not found" at any moment, loading bar shown, header switched to the other order.

No backend code changed for this addendum. The existing test `OrderTrackingGroupServiceTest.etaCountsDownFromTheRetailEstimateAndDisappearsWhenDeliveredOrHalted` was made deterministic (its orders were dated only a few milliseconds after "25 minutes ago", so a fast run could round to 24 minutes); a 30-second margin was added to the test data.

---

## Test Files Created for This CR

These are the backend test files that belong to this change request (paths from the project root):

| Test file | What it checks |
| --- | --- |
| `S4-order-logistics/src/test/java/com/cbg/lbos/service/OrderTrackingGroupServiceTest.java` | Grouping of shop orders, driver info and ETA of the tracker. |

---

## Main Code Location

| Item | Location |
| --- | --- |
| File | `S4-order-logistics/src/main/java/com/cbg/lbos/service/OrderTrackingGroupService.java` |
| Place | method `getGroup(Long)` |
| Why this is the main place | Builds the one tracking payload for every shop order of a checkout. |

A banner comment `CR_CHG0030044_Customer_Order_Tracker_3240071` marks this place in the source code.
