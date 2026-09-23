> **FINAL FIX NOTE:** This document contains historical integration observations from earlier audit passes. For the current repository state, use `docs/FINAL_FIXES.md` and `docs/ECLIPSE_MANUAL_TESTING.md` first. Where this document says an endpoint is missing or a Feign client is hardcoded, verify against the current source before relying on that statement.

# UI → API Mapping

Screen-by-screen mapping from the AroundU UI wireframes (`aroundu_New.zip`, summarized in `AroundU_Full_Application_Workflow.md`) to the actual backend API. A frontend developer should be able to build each screen from this document alone, cross-referencing `api-catalog.md` for full request/response field detail. All paths are Gateway-relative (`http://localhost:8080`). Screens/features the current 34-entity backend cannot support are marked **GAP** rather than mapped to an invented endpoint.

---

## CUSTOMER

### Login / Signup

| | |
|---|---|
| Purpose | Authenticate, land in the customer workspace |
| API calls | `POST /api/v1/auth/login` |
| Order | Single call |
| Data returned | `accessToken`, `role`, `userAccountId` |
| Errors | `401` wrong credentials |
| **GAP** | Self-service signup has no public endpoint — `POST /api/user-accounts` is SUPER_ADMIN-gated. See `frontend-integration-guide.md` §5. |

### Home

| | |
|---|---|
| Purpose | Search bar, categories, recommended/trending products, quick links to Orders/Wishlist/Cart |
| API calls | `GET /api/v1/product-categories/active` → category chips; `GET /api/v1/products?page=0&size=20` → recommended/trending grid (no dedicated "trending" flag exists — sort/page the same listing endpoint; a true trending algorithm is a **GAP**, treat the default listing as the source) |
| User actions | Tap category → Search screen with `categoryId` pre-filled; tap product → Product Details |

### Search

| | |
|---|---|
| API calls | `GET /api/v1/products?q={term}&categoryId={id}&retailerId={id}&inStock={bool}&page={n}&size={n}` |
| Sort | Client-side sort on the returned page is acceptable for small result sets; the endpoint itself does not accept a `sort` parameter — confirm exact supported query params in `api-catalog.md` before assuming server-side sorting exists beyond what's listed there. |
| Filters shown by UI vs backing | Category ✅, Retailer ✅, Availability ✅ (`inStock`); "fast delivery" filter — **GAP**, no such field on `Product`/`ProductResponse` |

### Product Details

| | |
|---|---|
| API calls | `GET /api/v1/products/{id}/details` (new combined endpoint — returns product + rating summary in one call, avoiding a second round-trip) |
| Data returned | Name, category, price, stock/availability, rating average + distribution, retailer id |
| User actions | Add to Cart → `POST /api/v1/cart/items`; Add to Wishlist → `POST /api/v1/customers/me/wishlist-items`; Buy Now → same as Add to Cart then jump straight to Checkout |
| Note | "Verified retailer" badge and "delivery estimate" shown in the wireframe are not both backed by dedicated fields — `retailerId` is returned; a live delivery-estimate figure is only computed at checkout time (`POST /api/v1/checkout/prepare`), not on the product page itself. Show a generic estimate or defer the real number to checkout. |

### Wishlist

| | |
|---|---|
| API calls | `GET /api/v1/customers/me/wishlist-items?page=0&size=20`; `GET /api/v1/customers/me/wishlist-items/summary` |
| Actions | Remove → `DELETE /api/v1/customers/me/wishlist-items/{id}`; Move to cart → no direct endpoint, do `POST /api/v1/cart/items` then `DELETE .../wishlist-items/{id}` client-side (the reverse direction, cart→wishlist, DOES have a dedicated endpoint: `POST /api/v1/cart/items/{id}/move-to-wishlist` — this asymmetry is a real, minor gap worth flagging to backend if it matters for UX polish) |

### Cart

| | |
|---|---|
| API calls | `GET /api/v1/cart`; `PATCH /api/v1/cart/items/{id}` (quantity); `DELETE /api/v1/cart/items/{id}`; `POST /api/v1/cart/validate` before proceeding |
| Coupon field shown in wireframe | **GAP** — no coupon/discount-code entity or endpoint exists |

### Checkout / Payment

| | |
|---|---|
| API calls | `POST /api/v1/checkout/prepare` (S3, computes totals) → `POST /api/orders` (S4, creates the order) → `POST /api/order-items` per line item (S4) → `POST /api/payment-transactions` (S6) |
| Payment method field | UI shows Card/UPI/Wallet/Net Banking/COD — the backend's `PaymentTransactionRequest` accepts a `paymentMethod` string with no fixed enum (see `api-catalog.md`); real payment-gateway integration is out of scope for this backend (it records the transaction, it does not process a card/UPI charge) |
| **Confirmed live gap** | `POST /api/v1/checkout/prepare` internally calls S4 for delivery serviceability (`OrderLogisticsClient.serviceability`) — **S4 does not implement the matching endpoint** (confirmed by reading S4's live source). Calling checkout-prepare today will fail at that step. Do not build the checkout screen assuming this call succeeds until backend adds it; see `feign-dependencies.md`'s S3→S4 entry. |
| Note | Checkout preparation and order/payment creation are **not automatically chained by the backend** — the frontend must call all three in sequence. See `application-workflow.md` §8 flow #7 for why. |

### Order History / Tracking

| | |
|---|---|
| API calls | `GET /api/orders?customerProfileId={id}`; `GET /api/orders/{id}`; `GET /api/orders/{id}/tracking` |
| Reorder / Return / Replacement | **GAP** — no dedicated endpoints exist for these three actions; only generic order CRUD |
| Invoice | `GET /api/customer-invoices?orderId={id}` (S6) |

### Support

| | |
|---|---|
| API calls | `POST /api/support-tickets`; `GET /api/support-tickets?customerProfileId={id}` |
| Live chat | **GAP** — `SupportTicket` is a ticket record, not a real-time chat transport; build the chat UI against ticket creation + polling, not a websocket the backend doesn't have |

### Profile / Notifications

| | |
|---|---|
| API calls | `GET /api/v1/users/me`; `PUT /api/user-accounts/{id}` (profile fields — note this endpoint is SUPER_ADMIN-only today, a genuine gap for self-service profile editing, see `api-catalog.md`); `GET /api/v1/customers/me`; `GET /api/notifications?userAccountId={id}`; `PATCH /api/notifications/{id}/read`; `PATCH /api/notifications/read-all?userAccountId={id}` |

---

## RETAILER

### Onboarding

| | |
|---|---|
| API calls | `POST /api/retailers/register` → `POST /api/retailers/{id}/documents` → `POST /api/retailers/{id}/submit-verification` → poll `GET /api/retailers/{id}/verification-status` |

### Dashboard

| | |
|---|---|
| API calls | `GET /api/v1/retailers/me/products/summary` (S3); `GET /api/orders?retailerId={id}` (S4); `GET /api/v1/retailers/me/inventory/summary` (S3, low/out-of-stock counts) |
| "Recent reviews" widget | **GAP** — no "reviews for my products" aggregation endpoint; would require the frontend to fetch reviews per product |

### Catalogue

| | |
|---|---|
| API calls | `GET /api/v1/retailers/me/products?q=&categoryId=&status=&page=&size=`; `POST /api/v1/retailers/me/products`; `PATCH /api/v1/retailers/me/products/{id}`; `DELETE /api/v1/retailers/me/products/{id}`; `POST /api/v1/retailers/me/products/{id}/duplicate` |
| Product image upload | **GAP** — no file-upload endpoint or image field exists on `Product`; the wireframe's image upload has no backend today |

### Inventory

| | |
|---|---|
| API calls | `GET /api/v1/retailers/me/inventory?q=&categoryId=&inventoryStatus=`; `POST /api/v1/retailers/me/inventory/adjustments` |
| Export | **GAP** — no export endpoint; generate CSV client-side from the list response for small datasets |

### Orders

| | |
|---|---|
| API calls | `GET /api/orders?retailerId={id}`; `PATCH /api/orders/{id}/status` |
| Returns/replacements | **GAP**, same as customer-side |

### Store Management

| | |
|---|---|
| API calls | `PUT /api/retailers/{id}` (business info/location) |
| Operating hours, "take a break" status | **GAP** — no such fields on `Retailer`; `retailerStatus` only supports the verification-lifecycle values, not an operational open/closed toggle |

### Finance

| | |
|---|---|
| API calls | `GET /api/settlements?...` (S6, filter by the retailer's own transactions — no dedicated `retailerId` filter param confirmed; check `api-catalog.md`) |

---

## LOCATION_MANAGER

*(merged role — see `application-workflow.md` §4/5 for the Fleet Verification Officer + Location Manager merge rationale)*

### Verification Queue

| | |
|---|---|
| API calls | `GET /api/verification-queues?status=PENDING`; `GET /api/verification-queues/{id}`; `GET /api/verification-documents?verificationQueueId={id}`; `PATCH /api/verification-queues/{id}/assign` (new); `POST /api/verification-queues/{id}/process-result` (approve/reject, carries the reason) |
| Covers | Retailer verification, fleet owner verification (`subjectType=FLEET_OWNER`), driver verification (indirectly — see the Driver-ownership note in `entity-catalog.md`; S5's `DriverServiceImpl.create` calls S2 for eligibility at creation time rather than going through this same queue UI) |
| Suspend/Delete actions shown in wireframe | Only APPROVED/REJECTED are confirmed real `process-result` outcomes in the current code (the field accepts any string with only those two branching specially — see `sql-jpa-discrepancy-report.md`); "suspend" as a distinct workflow state is a **GAP** to confirm against the live `VerificationQueueServiceImpl` before building a dedicated Suspend button that expects different backend behavior than Reject |

### Location Command Center

| | |
|---|---|
| API calls | `GET /api/v1/cities`; `GET /api/v1/zones?cityId={id}`; `POST /api/v1/cities`; `POST /api/v1/zones` |
| Location status, expansion report, coverage recommendation | **GAP** — no `Location`/`LocationStatus`/`ExpansionReport`/`LocationRecommendation` entities exist in the 34-entity model. Build the City/Zone CRUD screens against real data; treat the analytics-flavored parts of this workspace as not-yet-backed. |

---

## OPERATIONS_MANAGER

### Dashboard / Officers

| | |
|---|---|
| API calls | `GET /api/v1/operations-managers/summary`; `GET /api/v1/operations-managers`; `POST /api/v1/operations-managers` (create); `POST /api/v1/location-managers` (create, assign to an OM) |

### Verification Queue (oversight)

| | |
|---|---|
| API calls | Same S2 endpoints as LOCATION_MANAGER above — OPERATIONS_MANAGER is also in the allowed-role set for `/api/verification-queues/**` |

### Finance / Settlements / Tax

| | |
|---|---|
| API calls | `GET /api/settlements`; `POST /api/settlements`; `GET /api/tax-configurations`; `POST /api/tax-configurations` |

### Insights / Audit / Messages

| | |
|---|---|
| API calls | `GET /api/audit-logs` |
| Operations insights (incidents, zone analysis, trend/recommendation generation) | **GAP** — no dedicated analytics endpoints; would need aggregation over `AuditLog`/`SupportTicket` data, not pre-built in this pass |
| Messages/conversations | **Use `Notification`, not a new entity** — `GET /api/notifications`, and sending a message to a specific user is `POST /api/notifications` with that `userAccountId`. There is no threaded-conversation model; each message is a standalone notification record. |

---

## FLEET_MANAGER

### Dashboard

| | |
|---|---|
| API calls | `GET /api/vehicles?fleetOwnerId={id}`; `GET /api/drivers?fleetOwnerId={id}`; `GET /api/assignments/active`; `GET /api/trips` |

### Vehicles / Drivers

| | |
|---|---|
| API calls | `POST /api/vehicles`, `GET /api/vehicles`, `PATCH /api/vehicles/{id}/status`, `GET /api/vehicles/available`; `POST /api/drivers`, `GET /api/drivers`, `PATCH /api/drivers/{id}/status`, `GET /api/drivers/available` |
| Export | **GAP**, client-side CSV from list response |

### Assignments / Trips

| | |
|---|---|
| API calls | `POST /api/assignments`; `GET /api/assignments`; `PATCH /api/assignments/{id}/end`; `GET /api/trips` (filter client-side by status for ongoing/completed/cancelled tabs, unless `api-catalog.md` confirms a server-side status filter param exists) |

### Fleet Expenses (covers "Finance" AND "Maintenance" screens)

| | |
|---|---|
| API calls | `POST /api/expenses`, `GET /api/expenses?fleetOwnerId={id}`, `PATCH /api/expenses/{id}/approve`, `PATCH /api/expenses/{id}/reject` |
| **Maintenance mapping (important)**: the wireframe's "Add maintenance task" screen (vehicle, service centre, date, estimated cost) maps onto `FleetExpense` with `expenseType=MAINTENANCE` — there is no separate maintenance entity. `serviceCentre`/task-specific fields beyond `FleetExpense`'s existing `amount`/`expenseDate`/`expenseType`/no free-text notes-beyond-what's-modeled should be treated as **GAP** if the UI needs more structured fields than `FleetExpense` currently has — check `entity-catalog.md` for `FleetExpense`'s exact field list before assuming a field exists. |
| Compliance tasks | **GAP** — no dedicated compliance entity; not backed |

### Driver Earnings

| | |
|---|---|
| **GAP** — no dedicated earnings/incentive entity or endpoint. | Per the integration brief, earnings should be *derived* from `PaymentTransaction`/`Settlement` data where possible — but no backend aggregation endpoint for "this driver's earnings summary" was built in this pass (would require a new cross-service aggregation in S6 or S5, not requested as a specific gap-fill in this hardening pass). Flag to backend before building this screen; do not fabricate numbers client-side from unrelated data. |

---

## SUPER_ADMIN

### Master Dashboard

| | |
|---|---|
| API calls | Aggregate client-side from: `GET /api/user-accounts`, `GET /api/retailers`, `GET /api/orders`, `GET /api/payment-transactions`, `GET /api/support-tickets` |
| **GAP** | No single dashboard-summary endpoint exists; the frontend must call each list endpoint and aggregate/count client-side, or backend should add a dedicated summary endpoint as a follow-up. |

### User / Manager Management

| | |
|---|---|
| API calls | `GET /api/user-accounts`, `POST /api/user-accounts`, `PATCH /api/user-accounts/{id}/status` (new), `GET /api/v1/operations-managers` |

### Vendor Management

| | |
|---|---|
| API calls | `GET /api/retailers`, `GET /api/fleet-owners` |

### Order / Payment / Support Oversight

| | |
|---|---|
| API calls | `GET /api/orders` (filter client-side by `orderType` — confirm in `api-catalog.md` whether the backend supports this as a query param or only client-side); `GET /api/payment-transactions`; `GET /api/support-tickets` |

### Analytics

| | |
|---|---|
| **GAP** — entirely. | No analytics/reporting endpoints exist. Per the integration brief's own guidance, this should eventually be built as aggregation over existing transactional/audit data, not a new source-of-truth entity — but no such aggregation endpoint was built in this pass. This is the single largest "SUPER_ADMIN screen with no backend" gap in the platform today. |

---

## Summary of GAPs (cross-referenced from `application-workflow.md` §14)

| Feature | Status |
|---|---|
| Location management (status/expansion/recommendation) | GAP — use City/Zone for what IS backed |
| Fleet maintenance | Backed via `FleetExpense(expenseType=MAINTENANCE)` — not a GAP, but field-limited |
| Fleet compliance | GAP |
| Driver earnings/incentives | GAP — derive from Payment/Settlement once an aggregation endpoint exists |
| Operations messaging | Backed via `Notification` — not a GAP |
| Advanced analytics/reporting | GAP everywhere it appears (Operations Insights, Super Admin Analytics) |
| Password reset / token refresh / self-service signup | GAP (see `frontend-integration-guide.md` §5) |
| Coupons/discount codes | GAP |
| Product image upload | GAP |
| Store operating hours / open-closed toggle | GAP |
| Order reorder / return / replacement | GAP |
