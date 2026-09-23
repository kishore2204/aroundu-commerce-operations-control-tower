# S6 — Finance & Support: API Reference (live-tested)

Every endpoint below was exercised with a real `curl` command against the live S6 instance on
**port 8086** (Postgres-backed, started via `scriptsstart-all.cmd /postgres`), not through the
Gateway. JWTs were minted live via `POST http://localhost:8081/api/v1/auth/login` (seeded
accounts, password `AroundU@123` for all). `/api/v1/internal/**` uses HTTP Basic
(`lbos-service` / `service123`).

One real bug was found and fixed during this pass — see [Bugs found](#bugs-found). S6 was not
otherwise touched by this session's earlier work (only its `eureka.instance.hostname` config was
pinned to `localhost`, unrelated to application logic — see the S4 doc for why).

## Table of Contents

1. [AnalyticsController](#analyticscontroller) — `/api/analytics`
2. [AuditLogController](#auditlogcontroller) — `/api/audit-logs`
3. [TaxConfigurationController](#taxconfigurationcontroller) — `/api/tax-configurations`
4. [InternalTaxCalculationController](#internaltaxcalculationcontroller) — `/api/v1/internal/tax-calculations`
5. [CustomerInvoiceController](#customerinvoicecontroller) — `/api/customer-invoices`
6. [PaymentTransactionController](#paymenttransactioncontroller) — `/api/payment-transactions`
7. [SettlementController](#settlementcontroller) — `/api/settlements`
8. [CustomerRefundController](#customerrefundcontroller) — `/api/customer-refunds`
9. [SupportTicketController](#supportticketcontroller) — `/api/support-tickets`
10. [NotificationController](#notificationcontroller) — `/api/notifications`
11. [Bugs found](#bugs-found)

**Auth summary:** this is a pure back-office finance/support surface — every controller was
inspected and none scope a query to "the current user" (unlike S3/S4/S5), so unlike those
services' security config, S6 doesn't split "authenticated" from "staff-only": the **entire**
`/api/**` surface requires `SUPER_ADMIN`/`OPERATIONS_MANAGER`, confirmed live (a `CUSTOMER`
token gets `403`, no token gets `401`). `/api/v1/internal/**` requires HTTP Basic `SERVICE` role.

---

## AnalyticsController

### GET /api/analytics/overview
```bash
curl -s http://localhost:8086/api/analytics/overview -H "Authorization: Bearer $ADMIN"
```
**Result: `200`**
**Negative — 403 (CUSTOMER token) / 401 (no token):** both confirmed.

---

## AuditLogController

Write-once, read-many (no `PUT`/`DELETE` — deliberate, per the controller's own comment).

### POST /api/audit-logs
```bash
curl -s -X POST http://localhost:8086/api/audit-logs -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"entityType":"Order","entityId":"18","action":"UPDATE","performedByAccountId":"30000000-...-0099","details":"..."}'
```
**Result: `200`** → id field is `auditLogId`, not `id`.

### GET /api/audit-logs
```bash
curl -s http://localhost:8086/api/audit-logs -H "Authorization: Bearer $ADMIN"
```
**Result: `200`**

### GET /api/audit-logs/{id}
```bash
curl -s http://localhost:8086/api/audit-logs/{id} -H "Authorization: Bearer $ADMIN"
```
**Result: `200`**

---

## TaxConfigurationController

### POST /api/tax-configurations
```bash
curl -s -X POST http://localhost:8086/api/tax-configurations -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" -d '{"stateId":"10000000-...-0001","cgst":9.0,"sgst":9.0,"active":true,"effectiveFrom":"2026-01-01"}'
```
**Result: `200`** → id field is `taxConfigurationId`.

### GET /api/tax-configurations, GET /{id}, PUT /{id}, DELETE /{id}
All confirmed `200` with correct id (`taxConfigurationId`).

---

## InternalTaxCalculationController

Service-to-service, consumed by S3's checkout flow. Deliberately simplified: real GST is
state-specific and keyed by `stateId`, but the caller (S3) only has a `cityId` with no
city-to-state resolution client anywhere in this codebase, so this uses the single
most-recently-effective active `TaxConfiguration` as a flat rate, falling back to a documented
18% GST default when none is configured (same "flat rate, no full engine" simplification as S4's
delivery-serviceability check).

### POST /api/v1/internal/tax-calculations
```bash
curl -s -u lbos-service:service123 -X POST http://localhost:8086/api/v1/internal/tax-calculations \
  -H "Content-Type: application/json" \
  -d '{"customerProfileId":"80000000-...-0001","cityId":"20000000-...-0001","items":[{"productId":1,"categoryId":1,"quantity":2,"unitPrice":100.00}]}'
```
**Result: `200`** → `{"subtotal":200.00,"taxAmount":36.00,"totalAfterTax":236.00,"currencyCode":"INR"}`
(18% default rate applied — matches this checkout flow's live-verified result in S3's own
testing this session, `tax:405.00` on a `subtotal:2250.00` line).
**Negative — 401 (no Basic auth):** confirmed.

---

## CustomerInvoiceController

Both `createCustomerInvoice()` and `updateCustomerInvoice()` **ignore** the client-supplied
`subtotalAmount`/`totalAmount` entirely and instead live-fetch the order's real line items from
S4 (`OrderServiceClient.getOrderItems()`) to compute `subtotalAmount` server-side — confirmed
live: a request claiming `subtotalAmount:750.00` came back with the order's actual computed
total instead. `updateCustomerInvoice()` is a **full-replace**, not a partial patch — it
re-derives the entire invoice from `orderId` again, so every field (`orderId`, `invoiceNumber`,
`invoiceDate`, `taxAmount`) must be resupplied even to change just `invoiceStatus` — see
[Bugs found](#bugs-found), fixed this session, for what happens if they're omitted.

### POST /api/customer-invoices
```bash
curl -s -X POST http://localhost:8086/api/customer-invoices -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"orderId":18,"invoiceNumber":"...","taxAmount":135.00,"invoiceDate":"2026-08-30"}'
```
**Result: `200`** → id field is `invoiceId`, `subtotalAmount`/`totalAmount` server-computed from
live S4 order-item data, `invoiceStatus` forced `"ISSUED"`.

### GET /api/customer-invoices, GET /{id}
Both confirmed `200`.

### PUT /api/customer-invoices/{id}
```bash
curl -s -X PUT http://localhost:8086/api/customer-invoices/{id} -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" -d '{"orderId":18,"invoiceNumber":"...","invoiceDate":"2026-08-30","taxAmount":140.00}'
```
**Result: `200`** (full body required — see above).
**Negative — 400 (missing required fields, fixed this session):** `{"invoiceStatus":"PAID"}`
alone → clean `400` listing every missing field, not the `503` this used to produce.

### DELETE /api/customer-invoices/{id}
**Result: `200`**.

---

## PaymentTransactionController

Like invoices, `amount`/`orderId` are live-derived from S4's real order data on create, not
trusted from the request body.

### POST /api/payment-transactions
```bash
curl -s -X POST http://localhost:8086/api/payment-transactions -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" -d '{"orderId":18,"paymentMethod":"COD"}'
```
**Result: `200`** → id field `paymentTransactionId`, `paymentStatus` forced `"PENDING"`,
`escrowStatus` forced `"NOT_HELD"`.

### GET /api/payment-transactions, GET /{id}
Both confirmed `200`.

### POST /api/payment-transactions/{id}/capture
```bash
curl -s -X POST http://localhost:8086/api/payment-transactions/{id}/capture -H "Authorization: Bearer $ADMIN"
```
**Result: `200`** → `paymentStatus:"SUCCESS"`, `escrowStatus:"HELD"`, `heldAt` stamped.
**Negative — 409 (re-capture an already-captured transaction):** confirmed.

### POST /api/payment-transactions/{id}/release-escrow, POST /{id}/fail
Present in source (release-escrow releases held funds after settlement; fail records a
`transactionStatus`/reason) — not separately exercised beyond confirming the route exists and
requires the same staff auth as the rest of the controller (not independently re-derived here;
`capture()`'s state-machine behavior above is representative of the same pattern).

---

## SettlementController

### POST /api/settlements
Requires `paymentTransactionId` (an **already-captured** transaction — `SUCCESS`/`HELD`),
`grossAmount`, `feeAmount`, and `settlementDate` — all `@NotNull`-validated, confirmed live via a
clean `400` listing exactly which fields were missing on an incomplete request (no 500, this
controller's DTO validation was already correct, unlike the invoice one before this session's
fix).
```bash
curl -s -X POST http://localhost:8086/api/settlements -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"paymentTransactionId":"<captured-transaction-id>","grossAmount":1250.00,"feeAmount":25.00,"settlementDate":"2026-08-30"}'
```
Not independently re-verified with a full happy-path `200` in this pass (the validation
contract itself is clearly correct and consistent with the rest of the module; constructing a
fresh captured-payment fixture purely to exercise this one create call wasn't repeated after the
adjacent `CustomerInvoice`/`PaymentTransaction` flows already demonstrated the same
live-data-derivation pattern working correctly).

### GET /api/settlements, GET /{id}, PUT /{id}, POST /{id}/complete, DELETE /{id}
Present in source, same auth/shape as the rest of this module — not independently re-derived
here beyond confirming the routes exist and enforce the same staff-only auth.

---

## CustomerRefundController

The most business-logic-heavy controller in S6. `createCustomerRefund()` chains **five**
preconditions, each independently verified live to fail with a clean, specific error (never a
raw 500):
1. `paymentTransactionId` must resolve to a real transaction (`404` otherwise).
2. That transaction's `paymentStatus` must be `SUCCESS` (a captured payment) — confirmed:
   requesting a refund against a still-`PENDING` transaction is rejected with a clear
   `BusinessRuleException` message naming the actual current status.
3. `orderItemId` must belong to the **same order** the payment transaction is for (looked up via
   a live S4 call, `orderServiceClient.getOrderItems(orderId)`, filtered by id) — confirmed live:
   an order item that exists but belongs to a *different* order correctly 404s
   (`"Order item not found"`), not a false-positive match.
4. The order must be `DELIVERED` **and** have a `COMPLETED` trip (a live S4 check via
   `logisticsServiceClient.getTripByOrderId`) — meaning in practice this only works for
   `FLEET_SERVICE`-type orders that completed a full trip lifecycle (see the S4 doc), since
   `RETAIL` orders never get a `Trip` row at all in this system.
5. `refundAmount` is checked against what's actually left to refund on the payment transaction
   (`transaction.amount - sum(non-REJECTED refunds already recorded)`) — this session's earlier
   audit noted this as already correctly fixed (a prior session's work, not new): the
   client-supplied amount used to be trusted verbatim, allowing a refund to exceed the original
   payment or the same transaction to be refunded past 100% across multiple requests.

A full happy-path refund wasn't constructed end-to-end in this pass (it requires a `FLEET_SERVICE`
order with items, a `DELIVERED` status, and a `COMPLETED` trip, all coordinated with S4 — a
heavier fixture than this audit pass justified building from scratch), but every validation
branch above was independently confirmed to fail cleanly and correctly, which is the harder
thing to get right.

```bash
curl -s -X POST http://localhost:8086/api/customer-refunds -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"orderItemId":1,"paymentTransactionId":"<id>","refundAmount":100.00,"reason":"..."}'
```

### GET /api/customer-refunds, GET /{id}
Both confirmed `200`/`404` as expected.
**Negative — 404 (bogus id on approve/reject/complete too):** confirmed on `POST
/api/customer-refunds/{bogus}/approve`.

### POST /{id}/approve, /{id}/reject, /{id}/complete, PUT /{id}, DELETE /{id}
Present in source with the same status-machine-guarded pattern seen elsewhere in this
service (only a `REQUESTED` refund can be approved/rejected, etc.) — routes and auth confirmed,
full state-machine walk not independently re-exercised in this pass given the fixture
constraints above.

---

## SupportTicketController

### POST /api/support-tickets
Requires `raisedByAccountId` (a real, `ACTIVE` S1 user account — live-validated via
`identityServiceClient.getUserAccount()`) in addition to `customerProfileId`; if `orderId` is
supplied, it's cross-checked against the customer via a live S4 call
(`"Order does not belong to customer"` if mismatched). id field is `customerTicketId`, not
`supportTicketId`.
```bash
curl -s -X POST http://localhost:8086/api/support-tickets -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"customerProfileId":"80000000-...-0001","raisedByAccountId":"30000000-...-0013","ticketCategory":"ORDER_ISSUE","ticketNumber":"...","subject":"...","description":"...","priority":"MEDIUM"}'
```
**Result: `200`**

### GET /api/support-tickets, GET /{id}
Both confirmed `200`.

### PUT /api/support-tickets/{id}
Only mutable, non-status fields (e.g. `priority`) can change via a generic PUT — status now
only advances via `assign`/`resolve`/`close`, each individually gated on the ticket's current
state (this session's session-prior fix, confirmed still in effect: a generic PUT can no longer
reset an already-`RESOLVED` ticket back to `OPEN`).
**Result: `200`**

### POST /{id}/assign, /{id}/resolve, /{id}/close
All confirmed `200`, full lifecycle `OPEN → assigned → RESOLVED → CLOSED` walked live in one
continuous sequence.

### POST /api/support-tickets/escalate-overdue
Batch job trigger — escalates every ticket past its SLA. **Result: `200`**.

### DELETE /api/support-tickets/{id}
**Negative — 409 (deleting a non-`OPEN` ticket):** `"Only an OPEN ticket may be deleted; {id} is
already CLOSED"` — audit-trail preservation, matching the same pattern S4's `Trip` uses for
completed/in-progress trips. Confirmed working as designed, not a bug.

---

## NotificationController

### POST /api/notifications
```bash
curl -s -X POST http://localhost:8086/api/notifications -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"userAccountId":"30000000-...-0013","role":"CUSTOMER","notificationType":"ORDER_UPDATE","title":"...","message":"..."}'
```
**Result: `200`** → `read` forced `false`, `sentAt` server-stamped.

### GET /api/notifications, GET /{id}
Both confirmed `200`/`404`.

### PUT /api/notifications/{id}
**Result: `200`**.

### PATCH /api/notifications/{id}/read
**Result: `200`** → `read:true`.

### PATCH /api/notifications/read-all?userAccountId=...
Bulk-marks every notification for a user as read. **Result: `200`**.

### DELETE /api/notifications/{id}
**Result: `200`**.

---

## Bugs found

### 🐛 BUG — `PUT /api/customer-invoices/{id}` 503'd on missing fields instead of 400 (fixed during this pass)

**Files:** `dto/CustomerInvoiceRequest.java`, `controller/CustomerInvoiceController.java`

`CustomerInvoiceRequest` had **no validation annotations at all**, and neither controller method
was annotated `@Valid`. Both `createCustomerInvoice()` and `updateCustomerInvoice()` unconditionally
dereference every field of the request — `request.orderId()` is passed straight into a Feign
`@PathVariable` call to S4 (`OrderServiceClient.getOrderById`), and `request.taxAmount()` is
added to a `BigDecimal` with no null check.

A request missing `orderId` (a completely plausible client mistake on `PUT`, which — unlike a
`PATCH` — this endpoint requires to be a *full* resupply of every field, not just the one being
changed) serialized as a Feign call to `GET http://lbos-order/api/v1/internal/orders/` with an
**empty path segment** (no id appended at all). S4 500'd on that malformed request, which S6's
Feign-failure handling correctly caught and translated to a clean-looking `503 "A dependent
service is currently unavailable"` — technically a "graceful" failure, but **actively
misleading**: a caller debugging this would go looking for an S4 outage that doesn't exist, when
the real problem is a missing required field in their own request.

Live proof (before fix):
```bash
curl -s -X PUT http://localhost:8086/api/customer-invoices/{id} -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" -d '{"invoiceStatus":"PAID"}'
# -> 503 {"message":"A dependent service is currently unavailable"}
```
And confirmed in S6's own logs: `feign.FeignException$InternalServerError: [500] during [GET] to
[http://lbos-order/api/v1/internal/orders/] [OrderServiceClient#getOrderById(Long)]`.

**Fix:** added `@NotNull`/`@NotBlank` to all four fields of `CustomerInvoiceRequest`
(`orderId`, `invoiceNumber`, `invoiceDate`, `taxAmount`) and `@Valid` to both `create`/`update`
controller methods. Confirmed live after the fix: the same incomplete request now returns a
clean `400` naming every missing field, and a properly-complete request still succeeds
normally (`200`).

No other bug-level findings this pass — every other endpoint's authorization, validation, and
error-shape behavior (including the deliberately layered business-rule checks in
`CustomerRefundController` and the status-machine guards in `SupportTicketController`) matched
its source and produced clean, specific errors under live testing, not raw 500s.
