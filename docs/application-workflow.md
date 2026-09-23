> **FINAL FIX NOTE:** This document contains historical integration observations from earlier audit passes. For the current repository state, use `docs/FINAL_FIXES.md` and `docs/ECLIPSE_MANUAL_TESTING.md` first. Where this document says an endpoint is missing or a Feign client is hardcoded, verify against the current source before relying on that statement.

# Application Workflow & Business Logic

This document describes what the LBOS ("Location-Based Operations Service") platform actually does, as implemented in code, distinguishing **IMPLEMENTED** from **NOT IMPLEMENTED**. Nothing below is invented; every flow is derived from the real controllers/services audited and (for S1/S2/S3) built and tested in this integration.

## 1. Project overview

LBOS combines two business models behind one platform:
- **Porter-like logistics**: book a vehicle (bike, mini-truck, truck, heavy truck) to move goods from an origin to a destination.
- **Zepto-like local commerce**: order products (groceries, household goods, and — because the platform owns its own trucks — larger items like furniture or cement) from local retailers for delivery.

## 2. Business problem

Local retailers need delivery capacity beyond small-parcel bikes; customers who need to move large/heavy items have no single service that combines retail catalogue browsing, checkout, and appropriately-sized vehicle dispatch.

## 3. USP

One platform, one fleet: the same vehicle/driver pool that fulfills a Porter-style "move my sofa" booking also fulfills Zepto-style retail deliveries, letting the retail side promise heavier/larger items than pure last-mile-bike competitors can.

## 4. Actors / 5. Roles (final six-role model)

`CUSTOMER`, `RETAILER`, `LOCATION_MANAGER`, `OPERATIONS_MANAGER`, `FLEET_MANAGER`, `SUPER_ADMIN` — enforced in S1's `UserAccount.role` field (plain string, no schema change needed to add a 6th value), carried in JWT claims, and checked at the Gateway (`RouteAuthorizationRules`, see `architecture.md`) and in S1's own `SecurityConfig`.

**Role consolidation, done in this pass:** the UI/wireframe project ships a separate "Fleet Verification Officer" workspace alongside a "Location Manager" workspace. These have been **merged into one role, `LOCATION_MANAGER`**, which now covers:
- Retailer verification (approve/reject/resubmit via S2's verification queue)
- Fleet owner verification (same S2 verification queue, `subjectType=FLEET_OWNER`)
- Driver verification (via S5's existing `S2PartnerClient` eligibility check at driver-creation time — see the Driver-ownership note in `entity-catalog.md`)
- Vehicle/document verification where applicable (S2's `VerificationDocument`/`VerificationQueue`)
- Location/city/zone management (S1's City/Zone endpoints — `LOCATION_MANAGER` was added to the allowed roles for these)

**`FLEET_MANAGER` is a separate, purely operational role** (not present in the original 5-role model), covering S5 end-to-end: vehicles, drivers, driver/vehicle availability, assignments, fleet expenses, and — per the UI's "maintenance" screens — expense/maintenance history logging using the *existing* `FleetExpense` entity (see §"Fleet maintenance" below; no separate maintenance entity exists or was added). `FLEET_MANAGER` also has visibility into S4's logistics bookings and trips (oversight, not the customer-booking flow itself).

There is deliberately **no separate `FLEET_VERIFICATION_OFFICER` role** and **no separate role for "maintenance staff"** — maintenance is operational history the `FLEET_MANAGER` role maintains, not a distinct actor.

## 6–7. Feature list & business logic, by microservice

### S1 — Platform & Territory

| Feature | IMPLEMENTED? | Detail |
|---|---|---|
| Geographic hierarchy (State → City → Zone) | ✅ IMPLEMENTED | Full CRUD + activate/deactivate, with parent-active-state validation (can't activate a city under an inactive state, etc.) |
| User account management | ✅ IMPLEMENTED | CRUD, password hashing (delegating/bcrypt encoder), duplicate email/phone rejection, password-strength validation (8-72 chars, letter+digit+special) |
| Login / JWT issuance | ✅ IMPLEMENTED (added in this integration) | `POST /api/v1/auth/login` — see `architecture.md` §5 |
| Operations Manager assignment to a city | ✅ IMPLEMENTED | One active OM profile per user account per city; reassignment, status changes, summary counts |
| Location Manager assignment to a zone | ✅ IMPLEMENTED | A zone may have several LMs (one LM belongs to one zone; a transfer to the LM's current zone is refused), must be supervised by an OM in the same city, role/status eligibility checks on the underlying user account |
| Internal (service-to-service) lookups | ✅ IMPLEMENTED | `/internal/v1/operations-managers/*`, `/internal/v1/user-accounts/{id}` — Basic-auth protected, used by S4/S6 |

### S2 — Partner Onboarding & Verification

| Feature | IMPLEMENTED? | Detail |
|---|---|---|
| Retailer registration | ✅ IMPLEMENTED | `POST /api/retailers/register` forces status `PENDING_VERIFICATION` |
| Fleet owner registration | ✅ IMPLEMENTED | `POST /api/fleet-owners/register` forces `profileStatus=PENDING_VERIFICATION`, `ownerStatus=INACTIVE` |
| Document submission | ✅ IMPLEMENTED | Upserts a `VerificationQueue` row per subject, attaches `VerificationDocument` rows at status `PENDING` |
| Submit for verification | ✅ IMPLEMENTED (with a caveat) | Sets queue+subject status to `SENT_TO_LOCATION_MANAGER` and calls S1's `LocationManagerClient`; **the Feign call's failure is silently swallowed** (caught and ignored, no logging) — a caller currently gets a "success" response even if the downstream notification failed |
| Verification approval/rejection workflow | ✅ IMPLEMENTED | `POST /api/verification-queues/{id}/process-result` cascades status to the queue, its documents, and the subject (retailer/fleet owner); on fleet-owner approval also flips `ownerStatus=ACTIVE` |
| Document versioning | ❌ **NOT IMPLEMENTED** | The `VerificationDocument.versionNumber`/`isCurrentVersion` fields exist but nothing in the service layer ever flips a prior version's `isCurrentVersion` to false when a new one is submitted — version management is left entirely to a caller that doesn't exist yet |
| Driver onboarding | ❌ **NOT IMPLEMENTED in S2** | No `Driver` entity/controller/service exists in S2 at all — see the Driver-ownership anomaly. Driver records exist only in S5 |

### S3 — Commerce & Customer

| Feature | IMPLEMENTED? | Detail |
|---|---|---|
| Customer profile management | ✅ IMPLEMENTED | Create/get/update/delete, one profile per S1 user account |
| Address management | ✅ IMPLEMENTED | CRUD + single-default-address invariant (auto-reassignment on delete, blocks deleting the only default), validated against S1 territory data via Feign |
| Product catalogue (retailer-facing) | ✅ IMPLEMENTED | CRUD, SKU normalization/uniqueness per retailer, duplicate-as-draft, delete blocked while referenced by cart/wishlist/review |
| Inventory management | ✅ IMPLEMENTED | Atomic stock add/remove (conditional UPDATE queries), derived inventory status (OUT_OF_STOCK/LOW_STOCK/HEALTHY) |
| Product discovery (customer-facing) | ✅ IMPLEMENTED | Search/filter, only `ACTIVE` products visible |
| Wishlist | ✅ IMPLEMENTED | Add/list/replace/delete, duplicate-prevention, batch membership check |
| Cart | ✅ IMPLEMENTED | Add/merge, quantity vs. stock validation, move-to-wishlist, checkout-time validation |
| Cart delivery-address serviceability check | ✅ IMPLEMENTED (added in the order-placement-and-fulfilment pass) | `POST /api/v1/cart/serviceability-check` (`CartServiceImpl.checkServiceability()`) — every time the customer picks a different delivery address in Cart, this re-checks each cart line against S4's per-line serviceability for the *candidate* address (not the customer's stored default) before that address is ever persisted as the order's delivery address. Never silently drops a line: an unserviceable product stays in the cart with its own `LineServiceabilityResult`, and the frontend is the one that offers "Try Another Shop" / remove / pick a different address. The same S4 call is re-run again by `CheckoutServiceImpl` immediately before payment, so a conflict can't slip through between address selection and checkout. |
| Checkout preparation | ✅ IMPLEMENTED (preparation only) | Resolves address, validates cart, calls S4 for delivery serviceability and S6 for tax, returns a computed total plus a per-line `serviceabilityLines[]` breakdown. **Does not throw on a partially-unserviceable multi-retailer cart** — it returns `serviceable=false` and lets the caller decide what to do line-by-line, since one retailer's products being unservicable at an address shouldn't block checkout for a different retailer's products in the same cart. **Does not create an order, does not initiate payment, does not clear the cart** — order creation/submission and payment are orchestrated by the frontend calling S4 (`POST /api/orders` → `POST /api/orders/{id}/submit`) and S6 in sequence; see `frontend-integration-guide.md`. |
| Product reviews | ✅ IMPLEMENTED | Create/update/delete/search + rating summary; verified-purchase eligibility checked against S4 on every read and write |
| Retailer info on every product response | ✅ IMPLEMENTED (added in the shop-badge pass) | `ProductResponse` now carries `retailerName`/`retailerStatus`/`retailerLatitude`/`retailerLongitude` alongside the existing `retailerId`, resolved via a batched call to S2's `PartnerVerificationClient` (`RetailerEnrichmentSupport` — one Feign round-trip per page of results, not one per product) so no product card anywhere in the frontend can render without identifying its shop. Deliberately excludes the retailer's rating (a separate, lazier `GET /api/v1/retailers/{id}/rating-summary` call — see below) to avoid computing an aggregate rating on every single product-list page load. |
| Retailer rating summary | ✅ IMPLEMENTED (added in the shop-badge pass) | `GET /api/v1/retailers/{retailerId}/rating-summary` (new `PublicRetailerController`) — mirrors the existing per-product `ReviewService.rating()` pattern but aggregates across every product belonging to the retailer (`CustomerReviewRepository.averageByRetailerId`/`countByRetailerId`, a JOIN through `Product.retailerId`). Called lazily by the frontend's shop-detail-expander only once a shopper actually expands a shop card, not on every product-list render. |

### S4 — Order & Logistics

| Feature | IMPLEMENTED? | Detail |
|---|---|---|
| Order creation/lifecycle | ✅ IMPLEMENTED — full retail fulfilment state machine (added in the order-placement-and-fulfilment pass) | `orderStatus` now drives a real state machine, not just CRUD: `NEW → WAITING_FOR_RETAILER → RETAILER_ACCEPTED → FINDING_DELIVERY_PARTNER → VEHICLE_ASSIGNED → IN_TRANSIT → DELIVERED`, with `RETAILER_REJECTED`/`SHOP_UNAVAILABLE`/`CANCELLED` as terminal off-ramps. `OrderService.validateStatusTransition()` enforces the graph; illegal transitions are rejected. The fleet-service (Porter-style) path is untouched — `LogisticsBookingDetailService`/`TripService` still mutate `orderStatus` directly for that order type, bypassing this validation entirely (confirmed via a full grep for `orderRepository.save`/`setOrderStatus` call sites — the two flows never collide). |
| Order items with SKU/price snapshot | ✅ IMPLEMENTED | `OrderItem` snapshots `skuSnapshot`/`productNameSnapshot`/`unitPrice` at creation time; after this integration, sourced via a live Feign call to S3 rather than a local join |
| Fleet-service (logistics) booking | ✅ IMPLEMENTED | `LogisticsBookingDetail` — validates order type/status, parses pickup/drop locations from JSON, runs a cost-estimation engine (base + distance + vehicle-type surcharge + stop charges + optional priority surcharge), updates the parent order's `deliveryCharge`/`totalAmount`/status |
| Trip orchestration | ✅ IMPLEMENTED | Full state machine: `PLANNED → ASSIGNED/CANCELLED → IN_PROGRESS → COMPLETED`; validates vehicle/driver active status, license expiry, fleet-owner matching, prevents double-booking a vehicle/driver already on an active trip, requires proof-of-pickup/delivery to advance status, syncs the parent order's status as the trip progresses |
| Retailer accept/reject a retail order | ✅ IMPLEMENTED (added in the order-placement-and-fulfilment pass) | `POST /api/orders/{id}/retailer-accept` / `POST /api/orders/{id}/retailer-reject` (new `RetailerOrderActionController`) — the acting user's own account is resolved to a retailer via S2's `GET /internal/v1/retailers/by-user/{userAccountId}`, and ownership is checked against the order's first line item's `retailerId` before the transition is allowed (a RETAILER token cannot accept/reject someone else's order). Accept moves `WAITING_FOR_RETAILER → RETAILER_ACCEPTED` and immediately triggers the nearest-fleet-partner search (see below); reject moves to `RETAILER_REJECTED` with an optional reason, best-effort-notifying the customer either way. |
| Automatic "shop unavailable" on retailer no-response | ✅ IMPLEMENTED (added in the order-placement-and-fulfilment pass) | `RetailerResponseTimeoutJob` — the platform's first `@Scheduled` job (`fixedDelay = 60_000`, i.e. polls every 60s). Any order still `WAITING_FOR_RETAILER` more than 10 minutes after its last update is flipped to `SHOP_UNAVAILABLE` and the customer is best-effort-notified. `fixedDelay` (not `fixedRate`) is deliberate — a slow downstream notification call can't cause overlapping runs to stack up. |
| Nearest-available-fleet-partner search on retailer acceptance | ✅ IMPLEMENTED (added in the order-placement-and-fulfilment pass) | `OrderService.retailerAccept()` calls S5's new `GET /internal/v1/vehicles/nearest-available` and `GET /internal/v1/drivers/nearest-available` (haversine great-circle distance against the order's `deliveryLatitude`/`deliveryLongitude`, see `entity-catalog.md` §19 and `HaversineDistance` in S5), then best-effort-notifies the matched fleet owner. This is a *search + notify*, not an auto-assignment — the fleet owner still has to explicitly accept via the existing `pending-fleet-assignment` flow before a `Trip` is created. |
| Customer-facing order tracking | ✅ IMPLEMENTED (rewritten in the order-placement-and-fulfilment pass) | `GET /api/orders/{id}/tracking` now returns `displayStage`, a `haltedState` (set only when the order has stopped moving for a reason the customer must act on, e.g. `RETAILER_REJECTED`/`SHOP_UNAVAILABLE`), and a `steps[]` array covering all 9 customer-visible stages (`Order Placed → Waiting for Retailer → Retailer Accepted → Finding Delivery Partner → Delivery Partner Accepted → Going to Shop → Order Picked Up → Out for Delivery → Delivered`) each with a `state` (`DONE`/`CURRENT`/`PENDING`) and a `reachedAt` timestamp where applicable. The frontend polls this endpoint (see `frontend-integration-guide.md`) rather than inferring stage completion locally. |
| Delivery serviceability check (consumed by S3) | ✅ IMPLEMENTED (fixed in the order-placement-and-fulfilment pass — previously a confirmed gap) | `POST /api/v1/internal/delivery/serviceability-checks` (`InternalOrderLogisticsController.serviceability()`) now exists and returns a **per-line** breakdown (`lines[]`, one `LineServiceabilityResult` per product/retailer pair: `serviceable`, `reasonCode`, `deliveryCharge`, `estimate`) plus an aggregate `serviceable` flag (AND of every line) and an aggregate `reasonCode` (surfaced from the first failing line, so an existing caller checking only the aggregate still gets a meaningful reason). Delivery charge is a flat ₹49 per serviceable retail line — no distance-based formula exists for retail (unlike the fleet-service cost engine). S3's checkout (`CheckoutServiceImpl`) and cart (`CartServiceImpl.checkServiceability()`) both consume this; neither throws on a partial failure — see the S3 row below and the Cart section of `frontend-integration-guide.md`. |
| Review eligibility check (consumed by S3) | ✅ IMPLEMENTED (added this pass) | `GET /api/v1/internal/orders/{orderId}/review-eligibility` — new `InternalOrderLogisticsController`, derives the answer from existing `Order`/`OrderItem` data (ownership, `DELIVERED` status, product present on the order). This is the sibling endpoint on the same Feign client that WAS missing; it is no longer a gap. |

### S5 — Fleet Operations

| Feature | IMPLEMENTED? | Detail |
|---|---|---|
| Vehicle registration | ✅ IMPLEMENTED | Validated against S2 fleet-owner status (APPROVED/VERIFIED), unique registration number |
| Driver registration (operational) | ✅ IMPLEMENTED | Validated against S2 driver verification status and license-expiry, unique license number |
| Driver/vehicle assignment | ✅ IMPLEMENTED | Cross-checks both ACTIVE, same fleet owner, no pre-existing active assignment for either party |
| Fleet expense tracking | ✅ IMPLEMENTED | Create/approve/reject workflow, self-approval blocked, amount/date validation |
| Availability queries | ✅ IMPLEMENTED | `/api/vehicles/available`, `/api/drivers/available` — filters to ACTIVE with no current active assignment |
| Geo location on vehicles/drivers + nearest-available search | ✅ IMPLEMENTED (added in the order-placement-and-fulfilment pass) | `Vehicle`/`Driver` gained `latitude`/`longitude` columns; `GET /internal/v1/vehicles/nearest-available` and `GET /internal/v1/drivers/nearest-available` (new `InternalFleetController` routes) take a `lat`/`lon`/`maxKm` and return matches within radius sorted by real haversine great-circle distance (`HaversineDistance` util — new, no external geo library added), filtered to ACTIVE with no current active assignment same as the existing availability queries. Consumed by S4's `OrderService.retailerAccept()` to find a nearby fleet partner for a just-accepted retail order — a real distance calculation, not a city/zone proxy. |
| Note: a newly created driver/vehicle always starts INACTIVE | ⚠️ **Worth knowing, not a bug** | Both `DriverServiceImpl.create()` and `VehicleServiceImpl.create()` explicitly set the new record's status to `INACTIVE` regardless of how verified the *fleet owner* is — the entity class's own field initializer defaults to `ACTIVE`/`PENDING`, which only matters if something ever constructs one without going through the service. A driver/vehicle only becomes fit for assignment once it is itself submitted for verification and approved (`changeStatus()`); this tripped up two pre-existing unit tests that asserted the old (incorrect) "starts ACTIVE" expectation — fixed to assert `INACTIVE`. |

### S6 — Finance, Support & Engagement

| Feature | IMPLEMENTED? | Detail |
|---|---|---|
| Payment transaction creation | ✅ IMPLEMENTED | Validates order not already paid, payment method match, customer/account active |
| Payment capture confirms the order (S4 wiring) | ✅ IMPLEMENTED (added in the order-placement-and-fulfilment pass) | `PaymentTransactionServiceImpl.capture()` now best-effort-calls S4's new `POST /api/v1/internal/orders/{orderId}/payment-confirmed` (via a new `OrderServiceClient`) once a payment is captured — a failure here logs but does not fail the capture itself, matching the existing best-effort pattern used for other cross-service notifications in this codebase. This is deliberately still **simulated** payment (no real payment gateway integration), per the plan's explicit scope decision — S6's existing PaymentTransaction records remain the system of record for "was this order paid." |
| Escrow / payment status transitions | ❌ **NOT IMPLEMENTED** | `paymentStatus`/`escrowStatus` fields exist but no endpoint or service method ever transitions them after creation (the generic `update` endpoint doesn't touch these fields either — see discrepancy report) |
| Invoice generation | ✅ IMPLEMENTED | Computed from live order-item data fetched via Feign, subtotal + tax |
| Settlement | ✅ IMPLEMENTED (creation only) | Gated on payment SUCCESS + escrow RELEASED (a state that, per above, nothing can currently reach); computes net = gross − fee. `completedAt` is never set — settlements can't be marked complete via any API |
| Refunds | ✅ IMPLEMENTED (creation only) | Requires order DELIVERED + trip COMPLETED (verified via S4 Feign calls); no approval/processing workflow beyond creation |
| Tax configuration | ✅ IMPLEMENTED | Per-state CGST/SGST config, validated against S1's state data |
| Support tickets | ✅ IMPLEMENTED (creation/CRUD only) | Validates raising account and (if present) order ownership; **no agent-assignment or resolution workflow** — `assignedSupportAccountId`/`resolvedAt` are never set by any code path |
| Notifications | ✅ IMPLEMENTED (creation/CRUD only) | Validates recipient account active; **no "mark as read" endpoint** despite the entity having a `read` flag |
| Audit logging | ✅ IMPLEMENTED (creation/CRUD only) | Generic create/list/get/update/delete; nothing in any *other* service actually calls S6 to write an audit entry automatically — audit logging is available as an API but not wired into any other service's write paths |

## 8. End-to-end business flows (only flows that actually exist in code)

1. **Customer registration/login** — ✅ create `UserAccount` (S1) → create `CustomerProfile` (S3, separate call, not automatic) → `POST /api/v1/auth/login` (S1) for a token.
2. **Retailer onboarding** — ✅ register (S2) → submit documents (S2) → submit for verification (S2, notifies S1) → Location Manager approves/rejects via `process-result` (S2).
3. **Driver onboarding** — ⚠️ **PARTIAL** — no S2 driver-identity flow exists; S5's `DriverServiceImpl.create` directly validates against S2's *fleet-owner*-oriented `S2PartnerClient.validateDriverByUserAccount`, implying some driver-verification concept exists on the S2 side even though no S2 Driver entity/controller was found. **NOT FULLY VERIFIED** — this Feign method's actual S2-side implementation was not located during the audit; flagged as a gap.
4. **Document verification** — ✅ see feature #7 for S2.
5. **Product creation/browsing** — ✅ retailer creates product (S3) → customer discovers/searches (S3, ACTIVE only).
6. **Cart / wishlist** — ✅ fully implemented (S3).
7. **Retail order → checkout → placement → fulfilment** — ✅ **fully wired end-to-end** (added in the order-placement-and-fulfilment pass; previously a confirmed broken gap — S4's serviceability route didn't exist and nothing called `POST /api/orders` from checkout). The full sequence, orchestrated by the **frontend** rather than any single backend service (no service was told to own the whole saga):
   customer selects delivery location → browses only serviceable retailers → adds to cart (per-line serviceability re-checked on every address change, see the S3 row above) → `POST /api/v1/checkout/prepare` (S3, final serviceability + tax) → `POST /api/orders` then `POST /api/orders/{id}/submit` (S4, `NEW → WAITING_FOR_RETAILER`) → `POST /api/payment-transactions` + `.../capture` (S6, simulated payment, best-effort confirms the order back to S4) → retailer sees it and calls `retailer-accept`/`retailer-reject` (S4) within 10 minutes or `RetailerResponseTimeoutJob` auto-flips it to `SHOP_UNAVAILABLE` → on acceptance S4 searches S5 for the nearest available vehicle+driver and notifies that fleet owner → fleet owner accepts via the existing `pending-fleet-assignment`/`Trip` flow → `TripService`'s existing state machine (pickup → in-transit → delivered) drives the rest, syncing `Order.orderStatus` as it goes. The customer's tracking screen polls `GET /api/orders/{id}/tracking` throughout (see the S4 row above and `frontend-integration-guide.md`) rather than assuming any stage completed client-side.
8. **Logistics booking → vehicle allocation → trip** — ✅ fully implemented (S4 creates the booking and computes cost; S4's `TripService` handles the actual vehicle/driver assignment and status lifecycle, validating against S5's live data since this integration's Feign fix).
9. **Payment** — ✅ transaction creation + capture, and capture now best-effort-confirms the order back to S4 (see the S6 row above); no refund/settlement-triggering automation beyond that.
10. **Refund / Settlement** — ✅ creation only, no processing workflow.
11. **Support ticket** — ✅ creation only, no resolution workflow.
12. **Notifications** — ✅ creation only, no read-tracking.
13. **Reviews** — ✅ fully implemented, gated on S4-verified purchase eligibility.
14. **Audit logging** — ✅ available as a standalone API; not automatically invoked by other services' write operations.

## 9–11. Microservice responsibilities, dependencies, validations

See `architecture.md` and `entity-catalog.md and api-catalog.md` for the full dependency graph and per-endpoint detail; not duplicated here.

## 12–13. Exception scenarios & state transitions

Documented per-service in `sql-jpa-discrepancy-report.md` and the service-by-service tables above. The most significant state machine in the system is S4's `Trip` status flow (`PLANNED → ASSIGNED → IN_PROGRESS → COMPLETED`, with `CANCELLED` reachable from `PLANNED`/`ASSIGNED`), which also drives the parent `Order.orderStatus`.

## 14–21. Order / logistics / assignment / onboarding / verification / payment / notification / support lifecycles

Each is covered under its owning service's feature table above (§7); no separate restatement to avoid duplication.

## 22. Audit flow

`AuditLog` (S6) exists as a fully CRUD-able resource but is **not automatically populated by any other service** — there is no cross-cutting audit interceptor/filter anywhere in the six services that writes to S6 on a state change. Using it today requires an explicit, deliberate `POST /api/audit-logs` call from whatever caller wants an entry recorded. This is documented as a real gap: the entity and API exist ("IMPLEMENTED" in the narrow sense), but the *feature* of automatic platform-wide audit trail is **NOT IMPLEMENTED**.
