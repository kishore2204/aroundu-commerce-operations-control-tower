# Business-logic edge cases — findings and fixes

This document walks through the edge cases raised during sprint testing (multi-retailer order
splits, cancellation windows, mid-order supplier suspension, ticket SLAs and escalation loops,
and zone-wide incident detection), what the code actually did before this pass, and what changed.
Every "Fixed" row was implemented, build-verified, and test-verified in this codebase — not just
recommended. A few rows are "By design" or "Documented, not fixed" where the existing behaviour
turned out to already be correct, or where fixing it properly is a larger, separate piece of work.

All commits referenced are on `main` at the HEAD of this session's work.

## Summary table

| # | Problem | How it's handled |
|---|---|---|
| 1 | Customer orders from 2 different retailers in one checkout — what happens if one retailer accepts and the other rejects? | **Fixed.** Checkout now creates one Order per distinct retailer in the cart (previously it created a single Order whose items carried different `retailerId`s, but every downstream check — notification, accept/reject ownership — only looked at the *first* item's retailer, so the second retailer could never see or act on its own items). Each shop now gets its own order to independently accept, reject, and fulfil; the customer sees N separate order cards, each tracked on its own status. See "1. Multi-retailer checkout" below. |
| 2 | At what point can a customer cancel an order, and under what constraints? | **By design — already correct**, with one bug fixed alongside it. Cancellation is allowed from any pre-delivery status (including after pickup / mid-transit) with a tiered fee (0% before assignment, 25% default, 50% once a trip is in progress, 0% if the trip's planned start is 24h+ away), and is blocked once `DELIVERED`. There is no arbitrary "N minutes after placing" cutoff — the fee schedule *is* the constraint. Alongside this, closed a real security gap: `PUT /api/orders/{id}` had no ownership check at all and could be used by any authenticated user to force-cancel or rewrite any order, bypassing the fee logic entirely. See "2. Cancellation window" below. |
| 3 | An Operations Manager suspends a retailer or fleet owner that has an active, accepted order — what happens to that order? | **Fixed.** Previously: nothing. An order at `VEHICLE_ASSIGNED` or `IN_TRANSIT` for a suspended partner continued through the entire fulfilment flow untouched. Now, suspending a retailer or fleet owner in S2 triggers a best-effort call into S4 that cancels every non-terminal order for that partner, waives the cancellation fee (not the customer's fault), and notifies the customer. See "3. Suspension mid-order" below. |
| 4 | Once a ticket is raised, how long does staff have to resolve it? | **By design — already implemented, one gap fixed.** SLA is priority-tiered: LOW 72h, MEDIUM 24h, HIGH 4h, enforced by a 15-minute sweep that bumps priority when a ticket breaches its tier and auto-escalates HIGH breaches to Operations Manager. The gap: the sweep only ever scanned `OPEN` tickets, so a ticket someone picked up (`IN_PROGRESS`) stopped accruing SLA pressure the moment it was claimed, no matter how overdue it became. Fixed — the sweep now covers `OPEN` and `IN_PROGRESS`. See "4. Ticket SLA" below. |
| 5 | Support escalates to Admin, Admin says it's out of scope and re-escalates — can this loop forever? | **Fixed — this was a real, confirmed gap.** Escalating a ticket never changed its status and had no cap or cycle check, so a ticket could bounce between roles indefinitely, and every escalation call overwrote the previous one with no history. Now: escalating back to the role that already holds the ticket, or immediately back to whoever just escalated it, is rejected; a hard cap of 5 escalations forces a human decision instead of looping forever; and `SUPPORT_STAFF` is now a valid escalation target so a ticket can be handed back to first-line support instead of only sideways/upward. See "5. Escalation loops" below. |
| 6 | A low-priority ticket is isolated, but many people in the same zone report the *same* issue — how does priority get escalated, and what monitors this? | **Built — new feature.** A scheduled job now groups open tickets by (category, sub-category, customer zone) over a 48-hour window; 3+ distinct customers reporting the same issue in the same zone is treated as an incident, bumps every linked ticket's priority once, and is exposed via new insight endpoints to Support Staff, Operations Manager, and Super Admin. Full algorithm, thresholds, and per-role usage documented separately in [`support-ticket-clustering-algorithm.md`](support-ticket-clustering-algorithm.md). See "6. Zone-wide incident clustering" below. |
| 7 | Order cancellation across retailers — if one retailer's items are cancelled, does the sibling order get cancelled too? | **Resolved as a side effect of #1.** Once each retailer's items are separate Orders, this is no longer a "sibling order" problem — cancelling one is cancelling one order, and it never touches the other retailer's order, which is the correct behaviour for independently-fulfilled shipments. |
| 8 | Rejection of an order that's already active — should a retailer/fleet-owner be able to reject something already accepted? | **By design — already enforced.** `validateStatusTransition()` only allows `retailer-reject` from `WAITING_FOR_RETAILER`; once `RETAILER_ACCEPTED` or later, the transition table has no path back to `RETAILER_REJECTED`, so the state machine already refuses this. Verified during investigation, not changed. |
| 9 | Pending task/queue item reassignment when an account (e.g. Location Manager) is deactivated mid-review | **Documented, not fixed** — out of scope for this pass. Verification-queue entries are not currently reassigned off a deactivated reviewer automatically; a queue item stays "assigned" to whoever claimed it even if that account is later deactivated. Flagged for a follow-up; not attempted here because it touches S1 (account deactivation) and S2 (queue ownership) with no existing cross-service hook to build on, unlike the retailer/fleet-owner suspension case in #3 which already had a symmetrical S2→S5 pattern to extend. |
| 10 | Duplicate order booking — same order submitted twice | **Documented, not fixed.** No idempotency key exists on order creation; a double-click or retried request can create two independent orders for the same cart contents. Lower risk after #1 (each is now a normal, independently cancellable order rather than a corrupted mixed one), but a real fix needs an idempotency key from the frontend, which is a frontend+backend contract change beyond this pass's scope. |
| 11 | Vehicle capacity vs. order weight validation | **Not investigated in this pass** — raised in the original sprint backlog but not one of the six scenarios walked through here; flagged as remaining backlog, not newly discovered. |
| 12 | Contract management/renewal for drivers and fleet owners | **Not investigated in this pass** — same as above, pre-existing backlog item, out of scope here. |

---

## 1. Multi-retailer checkout

**Before:** [checkout.component.ts](../frontend/src/app/features/checkout/checkout.component.ts) built exactly one `CreateOrderRequest` per checkout and attached every cart item to it via `addItem`, regardless of how many distinct `retailerId`s were in the cart. On the backend, `OrderService.firstLineItemRetailerId()` and `verifyRetailerOwnsOrder()` only ever considered the *first* order item's retailer. So a two-retailer cart produced one order that:
- Retailer A could accept or reject (their items *and* Retailer B's items along with it).
- Retailer B never saw at all — no notification, and a 403 if they tried to act on "their" order.

**Fix (commit `1735563`):** `continuePlacingOrders()` groups the cart by `retailerId` before creating anything, and creates one order per group. The cart-wide tax/delivery/platform-fee/points-redeemed figures (S3's checkout summary is computed once for the whole cart) are split proportionally across the resulting orders by each retailer's subtotal share, with the last group absorbing any rounding remainder so the totals always add back up exactly. Each order is submitted, paid, and tracked independently. The "order placed" screen now shows either one order (unchanged UX for the common single-retailer case) or a list of orders when the cart spanned multiple shops.

This directly answers the user's three-fronts question:
- **Customer:** sees two independent order cards/trackers, one per shop, each showing its own real status — not one order with an ambiguous combined state.
- **Accepting retailer:** their order proceeds through the normal accept → fulfilment flow untouched by the other shop's decision.
- **Rejecting retailer:** their order alone goes to `RETAILER_REJECTED`; the customer is notified for that specific order via the existing reject-notification path, and can act on it (e.g. re-order from elsewhere) without it touching the accepted order at all.

No backend schema change was made to link the sibling orders with a shared "checkout group" id — that would need a new column and cross-order query surface. As a lightweight, no-migration substitute, all orders from one checkout share an order-number timestamp prefix (`ORD-<batch>-0`, `ORD-<batch>-1`, …) for human/support correlation.

## 2. Cancellation window

**Before/confirmed correct:** [OrderService.java](../S4-order-logistics/src/main/java/com/cbg/lbos/service/OrderService.java) already implements a real, tiered cancellation-fee model in `calculateCancellationFee()`:
- Cancel before any trip exists → 0% fee.
- Cancel while a trip is `IN_PROGRESS` (picked up, en route) → 50% fee.
- Cancel while a trip is `PLANNED` and its start is 24h+ in the future → 0% fee.
- Otherwise → 25% fee.
- Cancel after `DELIVERED` → rejected outright.

There is no separate "must cancel within N minutes of placing" rule, and that's fine — the fee schedule already encodes the real constraint (the closer to/further into fulfilment, the costlier to cancel), which is a more useful mechanism than a flat time cutoff.

**Bug found and fixed (commit `cd41cc9`):** the customer-facing `POST /{id}/cancel` endpoint is properly ownership-checked (`customerProfileId` must match), but the generic `PUT /api/orders/{id}` endpoint runs the exact same cancellation logic with **no ownership check and no role restriction** — it fell through Spring Security's `.anyRequest().authenticated()` catch-all, so any logged-in user of any role could cancel (or otherwise rewrite) any other customer's order. The frontend never called this endpoint at all. Fixed by restricting `PUT`/`DELETE /api/orders/**` to `SUPER_ADMIN`/`OPERATIONS_MANAGER`, matching how every other bulk/staff-only action in this service is already gated.

**Not fixed, noted:** cancelling an order does not currently reverse `paymentStatus` or trigger any refund flow — the payment record stays `SUCCESS` even after the order is `CANCELLED`. This is a real gap but is a payments/settlement concern (S6) separate from the order-lifecycle validation this pass focused on.

## 3. Suspension mid-order

**Before:** confirmed via full-repo search — when S2 suspends a retailer or fleet owner (`VerificationQueueServiceImpl.revokeApproval()`, both the manual revoke path and the automatic after-3-rejections path), nothing downstream reacts. S2 already had this cascade for DRIVER/VEHICLE suspensions (a call into S5), but never for RETAILER/FLEET_OWNER. An order already `VEHICLE_ASSIGNED` or `IN_TRANSIT` for a partner suspended mid-flight would carry on through the entire fulfilment state machine as if nothing happened — no halt, no reassignment, no customer notice.

**Fix (commit `19c533b`):** S4 now exposes two internal, service-to-service endpoints (Basic-auth-protected, matching the existing internal namespace convention) that cancel every non-terminal order for a given retailer (resolved through `OrderItem`, since `Order` itself carries no `retailerId`) or fleet owner (resolved through `Trip`). Each cancellation:
- **Waives the cancellation fee entirely** (forced to zero rather than run through the normal 0/25/50% schedule) — the customer didn't cause this, so they shouldn't pay for it.
- Restores stock, same as any other cancellation.
- Sets a clear `cancellationReason` ("Retailer/Fleet owner suspended by Operations Manager").
- Notifies the customer.

S2 calls these endpoints right after persisting a RETAILER or FLEET_OWNER suspension (both the manual and auto-suspension-after-3-rejections paths), best-effort — a failure to reach S4 is logged but never blocks the suspension itself from completing, matching the "downstream call must not gate the primary action" pattern already used elsewhere in this codebase (e.g. S4's own best-effort fleet notification on retailer-accept).

## 4. Ticket SLA

**Before/confirmed correct:** `SupportTicketServiceImpl.slaThresholdHours()` — LOW 72h, MEDIUM 24h, HIGH 4h — set at ticket creation and recomputed on any priority change, genuinely enforced by an automated `@Scheduled` sweep every 15 minutes (not just a display badge).

**Gap found and fixed (commit `dae3286`):** the sweep queried `findByTicketStatus("OPEN")` only. The instant a ticket moved to `IN_PROGRESS` (someone claimed it), it became invisible to the sweep forever — priority stopped bumping, HIGH-tier auto-escalation stopped firing, no matter how overdue the ticket became after being claimed. Fixed to scan both `OPEN` and `IN_PROGRESS`.

## 5. Escalation loops

**Before:** confirmed as a real, unguarded gap. `escalateTicket()`:
- Overwrote `escalatedToRole`/`escalatedByAccountId`/`escalationReason`/`escalatedAt` on every call — no history table anywhere, so the only trace of *who held it before* was a free-text internal note.
- Never changed `ticketStatus`, so a ticket stayed perpetually eligible for another escalation.
- Had no cap and no check against the previous target — `A → B → A → B → …` was fully possible.
- Could not be escalated back to `SUPPORT_STAFF` at all, so an Operations Manager who decided a ticket was genuinely out of scope for them had no way to hand it back down to first-line support — only sideways or upward.

**Fix (commit `dae3286`):**
- Escalating to the role/entity that already holds the ticket, or immediately back to whoever most recently escalated it, is now rejected with a clear validation error.
- A hard cap of 5 total escalations per ticket forces the loop to stop and requires a human decision (route directly to Super Admin, or resolve outside the escalation flow) instead of allowing it to continue indefinitely.
- `SUPPORT_STAFF` was added as a valid escalation target, so "out of scope, hand it back" is now a real, first-class action rather than a dead end.

## 6. Zone-wide incident clustering

Entirely new — did not exist in any form before this pass (confirmed by exhaustive grep across the whole codebase, and by the codebase's own `docs/ui-api-mapping.md` recording it as an explicit GAP). Built as a proper scheduled analysis job with persisted incident records and read endpoints, not a mock. Full write-up — including the zone-resolution mechanism and its honest limitations, the exact threshold/window numbers and why those specific values were chosen, and how each of Support Staff, Operations Manager, and Super Admin is expected to use it — is in [`support-ticket-clustering-algorithm.md`](support-ticket-clustering-algorithm.md), per the user's specific request that this one be documented separately.

---

## What was NOT changed

For completeness: order cancellation not reversing payment status (#2), verification-queue reassignment on reviewer deactivation (#9), and duplicate-order idempotency (#10) are real, confirmed gaps that were deliberately left alone in this pass rather than rushed — each is a separate, non-trivial piece of cross-cutting work (payments/settlement, account-deactivation cascades, and a frontend+backend idempotency-key contract, respectively) rather than a contained fix like the six items above.
