# Message, Validation, Conflict, Toast, Dialog and Button-State UX Audit

Application-wide audit of AroundU's user-facing messages, validation feedback, confirmation dialogs,
toasts, loading states, and duplicate-submit prevention. Investigated by reading the actual frontend
(`frontend/src/app/**`) and backend (`S1-platform-territory` … `S6-finance-support`) source across
every customer, retailer, fleet, driver, admin, operations, and location-manager screen, plus every
`GlobalExceptionHandler` and validated request DTO. Every finding below is evidence-based (file:line);
nothing is invented, and no fix claims a measured improvement it wasn't actually verified to make.

Each finding is labelled exactly one of: **Confirmed issue**, **Confirmed correct behaviour**,
**Potential concern requiring runtime verification**, **Not applicable**.

---

## 1. Complete message inventory (summary)

The investigation covered: Auth (login/register/reset-password), Profile, Addresses (incl. the header
dropdown), Home/Products, Cart/Checkout/Payment, Orders (list/detail/tracking), Logistics booking,
Wishlist, Support (customer + staff), Notifications, Retailer onboarding/catalogue/bulk-upload/
inventory/store/orders, Fleet-owner onboarding/drivers/vehicles/assignments/expenses/dashboard/
profile/trips, Driver portal, Admin accounts/operations-managers, Operations officers (Location
Manager management + Work Transfer), Verification queue + document re-upload, Territory/zone
management, Location Manager dashboard, Finance (payments/settlements/tax/logistics-rates), Support
tickets (staff), and Audit logs. Full per-screen tables were produced during the audit; the sections
below consolidate them into the patterns that actually matter, since the same handful of patterns
repeat across dozens of files rather than each screen having a unique problem.

**Shared infrastructure found and reused (not replaced):**
- `shared/toast/toast.service.ts` + `shared/toast/toast.component.ts` — the one toast surface for the app.
- `core/api/http-error.util.ts` (`extractErrorMessage`) — the one backend-error-to-user-text mapper.
- `shared/empty-state/empty-state.component.ts` — the one "nothing to show" presentational block.
- `shared/field-hint/field-hint.component.ts` + `core/validation/field-hints.ts` — the (i) tooltip pattern.
- `shared/work-transfer/work-transfer-dialog.component.ts` — the existing full-featured dialog pattern
  (backdrop, `role="dialog"`, Escape-to-cancel, focus icon badge) that this audit's new dialog follows.

## 2. Current message-type findings

**Confirmed correct behaviour** — Auth, retailer/fleet onboarding, driver-portal actions (pickup/
delivery confirmation, add expense), and checkout/logistics-booking payment flows all consistently use
`extractErrorMessage(err, fallback)` for errors and distinguish loading/error/success states properly.
These are the strongest-built areas of the app and were left unchanged.

**Confirmed issue** — Two structurally different problems recur across most other areas:
1. A fetch failure is indistinguishable from "genuinely no data" (see §10).
2. `ToastService.open(text, action, config)` — a MatSnackBar-shaped convenience method — always calls
   `show(text, 'info', ...)` (`shared/toast/toast.service.ts`, pre-fix), so every caller that routed an
   *error* message through `.open(...)` rendered it in the neutral dark style, not the red 'error'
   style the component already supports. Confirmed in `cart.component.ts`, `address-list.component.ts`,
   `wishlist.component.ts`, `product-detail.component.ts`, and `finance.component.ts` (fixed - see §12);
   the same `.open(...)` pattern also exists in `expenses.component.ts` (fixed) and is likely present in
   further files not touched this round (see §15).

## 3. Inline validation findings

**Confirmed correct behaviour.** Every audited form's field-level validation (GSTIN, vehicle number,
driving licence, mobile number, postal code, product SKU/price/stock/description, password policy,
address fields) already renders next to its field, already uses the shared `input-rules.ts` patterns
and `identifierError()`/equivalent helpers, and already carries a clear, specific message (not "Invalid
input"). This was extensively built and verified in earlier rounds of work on this project and remains
correct. Cross-field/business validations already present and correctly worded: password confirmation
mismatch, cart-blocks-address-change, weight-exceeds-vehicle-capacity, GST/vehicle/licence structural
checks, bulk-upload row-level rejection reasons.

**Confirmed issue** — `ProductRequest.java` (S3) had no `message=` on its `@Pattern`/`@Size`/
`@DecimalMin`/`@Digits`/`@Min` constraints, so a direct `POST`/`PATCH` to the product-create/update
endpoint that fails validation returned Bean Validation's raw default text (e.g. literally
`must match "[A-Za-z0-9_-]{3,20}"` for an invalid SKU) instead of the same wording the Angular form
already shows. Fixed — see §12. The equivalent gap in `AddressRequest.java` (S3) and several fields of
`CustomerRegistrationRequestDto.java` (S1) was confirmed but **not** fixed this round (see §15); those
requests are only reachable this way via a direct API call bypassing the UI's own (correct) validation.

## 4. Toast findings

**Confirmed issue (fixed):** `ToastService` had no 'warning' variant at all, despite the app's design
system already using amber/orange consistently elsewhere for caution states (`bg-amber-*` appears in 9+
other components). A caution message (e.g. "Please resolve the issues below before checking out")
previously had no way to render as anything other than 'info' or 'error'.

**Confirmed issue (fixed):** the toast had no close button and no `role`/`aria-live` — a screen reader
user was never told a toast appeared, and there was no way to dismiss it early or keep it visible longer
than its fixed 3-second timer.

**Confirmed issue (fixed):** all toasts, including errors, auto-dismissed after the same 3000ms
regardless of variant.

**Confirmed correct behaviour:** the toast is a single global signal (one toast at a time, never
stacking/duplicating), fed by a `providedIn: 'root'` singleton service, so the "do not show duplicate
toasts for one action" and "do not show success while still running" requirements were already
satisfied by construction wherever call sites only call `.show()`/`.open()` once per outcome (verified
in every audited call site — none call it twice for one action).

**Confirmed issue (not fixed this round):** eight components (`retailer/catalogue`, `retailer/
inventory`, `retailer/orders`, `fleet/assignments`, `admin/accounts`, `admin/operations-managers`,
`admin/states`, `shared/support/ticket-detail.component.ts`) reimplement their own local
`toastMessage` signal + inline `<div>` + `setTimeout` instead of using the shared `ToastService`. Each
one's message *text* is correct (uses `extractErrorMessage`), but the visual container is a plain
neutral card with no colour-by-outcome, no icon, and no accessibility attributes — a second, duplicate,
less-capable implementation of the same thing the shared service already does. See §15.

## 5. Modal/dialog findings

**Confirmed issue (fixed):** `features/fleet/expenses/expenses.component.ts` used the browser's native
`window.confirm(...)` twice (approve-for-reimbursement, reverse-an-approval-to-rejected) — the only
native-dialog usage found anywhere in the codebase (a full-repository grep for `alert(`/`confirm(`
confirmed this). Replaced with the new shared `ConfirmDialogComponent` (see §12).

**Confirmed issue:** no generic reusable confirmation dialog existed anywhere in the codebase before
this audit — every existing dialog (`work-transfer-dialog`, `retailer-info-dialog`, `serviceability-
conflict-dialog`, `terms-dialog`, the bulk-upload conflict/result dialogs) is purpose-built for its own
multi-field flow; none is a plain "are you sure?" component. This is *why* `expenses.component.ts` had
reached for `window.confirm()` in the first place. Fixed by adding one small, reusable
`ConfirmDialogComponent` (see §12) rather than a third-party dialog library.

**Confirmed issue:** the following destructive/business-critical actions fire immediately on click with
**no** confirmation step of any kind (not even a native `confirm()`):
- Delete product (`retailer/catalogue/catalogue.component.ts`) — **fixed**.
- Reject order, retailer side (`retailer/orders/orders.component.ts`) — **fixed**.
- Cancel order, customer side (`orders/order-detail/order-detail.component.ts`) — **fixed**.
- Delete address (`addresses/address-list.component.ts`) — **fixed**.
- Delete tax configuration, complete settlement (`operations/finance/finance.component.ts`) — **fixed**.
- Suspend/deactivate/activate a user account (`admin/accounts/accounts.component.ts`), all status
  changes for an Operations Manager (`admin/operations-managers/operations-managers.component.ts`),
  approve/reject a verification document or application / revoke approval (`location/queue-detail/
  queue-detail.component.ts`), approve/reject/complete a refund (`shared/support/
  ticket-detail.component.ts`) — **confirmed, not fixed this round** (see §15).
- Clear cart, remove a cart line item (`cart/cart.component.ts`) — **confirmed, not fixed this round**
  (see §15); judged lower severity than the items above since a removed cart line is trivially re-added.

**Confirmed correct behaviour:** the existing `WorkTransferDialogComponent` (Location Manager
deactivation/transfer/manual reassignment) already does everything section 3C of the brief asks for —
states the affected person, the consequence, has a real Cancel, focuses correctly, and closes safely on
Escape only when not mid-transfer. The bulk-upload conflict dialog (`bulk-conflict-dialog.component.ts`)
already shows every per-row choice explicitly with no default pre-selected, and the result/rejection-log
dialogs already mirror the exact downloaded-file content. None of these needed changes.

**Confirmed issue (documented, architectural, not "fixed" by this audit):** `officers.component.ts`'s
`guarded()` method deactivates/moves a Location Manager with **zero** confirmation step whenever they
have no pending verification work — by the code's own comment, "no pending work → straight through, no
popup." The same "no confirmation at all outside the pending-work-transfer gate" pattern was confirmed
in `admin/accounts.component.ts` (non-LM roles) and `admin/operations-managers.component.ts` (every
status change). This is a genuine, platform-wide gap in how account status changes are confirmed,
larger than this single audit round's scope to close everywhere — see §15.

**Confirmed issue:** `operations/support/support.component.ts`'s "Contact Developers" action shows a
success dialog ("A mail has been sent to the developer team") but, per the component's own code, makes
**no backend call at all** — it only flips a local signal. This tells a Super Admin something happened
that did not. Not fixed this round (see §15) — flagged because it's a fabricated confirmation, not
merely a missing one.

## 6. Conflict-message findings

**Confirmed correct behaviour:** the bulk-upload SKU-conflict dialog already explains the conflict
clearly, shows existing vs. submitted values, offers Update/Keep/Skip per row with no default, and
preserves the retailer's per-row choices across the busy round-trip. The document re-upload flow already
requires and displays a specific reason before it can be actioned, and that reason is genuinely shown
back to the affected retailer/fleet-owner/driver. Both were built correctly in earlier work and needed
no changes.

**Confirmed issue:** `shared/support/ticket-detail.component.ts`'s `disapproveRefund()` hardcodes the
customer-facing reason to the literal string `'Claim disapproved by support'` — there is no way for the
support agent to give the actual reason a specific refund was declined. Not fixed this round (see §15).

## 7. Backend error-message findings

**Confirmed correct behaviour (4 of 6 services):** S3, S4, S5, and S6 each already have a proper
`@ExceptionHandler(Exception.class)` catch-all that logs the real exception server-side and returns a
fixed, generic message to the client — S4's and S5's Javadoc/comments explicitly document this as a
deliberate earlier fix. S5's and S6's Feign-exception handlers already translate every up/downstream
failure into a safe, generic sentence and only log the raw detail. HTTP status mapping (400/401/403/
404/409/422/500, and 423 for password-expiry) is sensible and consistent across all six services.

**Confirmed issue (fixed):** S1 and S2 had **no** catch-all `Exception` handler at all — an
unanticipated `NullPointerException` or similar would have fallen through to Spring Boot's own default
error body. Fixed in both (see §12), with S2's fix explicitly preserving its own documented reason for
not using a naive blanket handler (Spring's self-describing `ErrorResponse` exceptions, e.g. a 404 for
an unmapped route, now pass through with their real status instead of being collapsed into a 500).

**Confirmed issue (fixed):** S3's `conflict()` handler put `exception.getMessage()` — for a
`DataIntegrityViolationException`, Hibernate/JDBC's own raw message — into the response body's
`technicalMessage` field. The official Angular client never reads that field (confirmed by reading
`http-error.util.ts`), but a direct API caller would see it. Fixed to use a fixed, safe placeholder for
that specific exception type only; `DuplicateResourceException`'s own already-safe message is unchanged.

**Confirmed issue (fixed):** S4's `OrderItemService.deductStock()` appended the raw
`FeignException.getMessage()` (S3's own HTTP response, potentially containing internal detail) directly
into the `InsufficientStockException` message that **does** reach the client via the 422 handler. Fixed
to drop the appended raw text.

**Confirmed issue (fixed at the frontend safety-net level):** several request DTOs across S1
(`CustomerRegistrationRequestDto`'s `@NotBlank`/`@Size` fields), S2 (`RetailerDTO`/`FleetOwnerDTO`'s
`@NotNull` messages, several of which are literally the internal field name, e.g. `"cityId cannot be
null"`), and S3 (`ProductRequest` — fixed directly this round, see §3/§12; `AddressRequest` — not
fixed) lack custom Bean Validation messages, so their raw defaults or internal field names would reach
the end user for a validation failure not already caught by frontend validation. `http-error.util.ts`'s
new `status >= 500` rule (§9) does not help here since these are 400s, not 500s — the DTO-level fixes in
§12 close the ones sampled; the remainder are confirmed but not fixed (see §15).

## 8. Color/design consistency findings

**Confirmed correct behaviour:** success (green), error (rose/red), and warning (amber) are already
used consistently across the whole design system outside the toast component itself (dialogs, badges,
buttons, field errors all already follow this). The icon family (Font Awesome solid, `fa-solid fa-*`) is
consistent everywhere; no Material or mixed icon set was found in any audited file.

**Confirmed issue (fixed):** the toast component itself was the one place these conventions were
incomplete (no warning colour, info rendered as near-black `slate-900` rather than participating in the
same red/green/amber trio, no icon at all). Fixed — see §12. `info` intentionally stays `slate-900`
(dark neutral) rather than being changed to blue, since blue is not otherwise used as an "info" colour
anywhere in this design system and introducing it would itself be an inconsistency; the existing neutral
tone was left as-is.

**Confirmed correct behaviour:** danger/destructive buttons already have an established convention
(`btn-outline !border-rose-500 !text-rose-600 hover:!bg-rose-50` for a secondary destructive action,
`btn-primary !bg-gradient-to-br !from-rose-600 !to-rose-500` for a primary destructive action) used
consistently in `order-detail`, `retailer/orders`, and elsewhere. The new `ConfirmDialogComponent`
reuses this exact convention for its `danger` state rather than inventing a new one.

**Not applicable:** no instance of "red success message," "green destructive button," "warning shown as
success," clipped dialog text, or a toast hidden behind a modal/header was found in any audited screen.

## 9. Button loading/disabled-state findings

**Confirmed correct behaviour (majority of the app):** login/register/reset-password, checkout/payment
(including the multi-stage "Calculating order total…" / "Creating shop orders…" / "Processing
payment…" sequence), retailer/fleet onboarding, drivers/vehicles "add" forms, driver-portal pickup/
delivery/expense actions, cart quantity/remove/clear/checkout, fleet assignment accept-and-dispatch, and
the Work Transfer dialog all correctly disable the acting button, show a spinner and a changed label
(e.g. "Saving…", "Uploading…", "Transferring…"), prevent the exact double-click/duplicate-request
scenario section 7 describes, and correctly restore the button after a failed request.

**Confirmed issue (not fixed this round, cosmetic only — see §15):** several save/submit buttons
correctly `[disabled]` themselves during the request but do **not** change their label or show a
spinner while doing so, so there is no *visible* feedback beyond the button becoming unclickable:
retailer catalogue's product Save, retailer/fleet/driver profile and store Save, fleet-owner
onboarding's "Submit for verification," and inventory's stock +/- buttons. None of these allow a
duplicate submission (the `[disabled]` binding already prevents that); the gap is purely the missing
visual "something is happening" cue.

**Confirmed correct behaviour:** no instance of "Success" being shown while a request was still in
flight, and no instance of a button staying permanently disabled after a completed (successful or
failed) request, was found anywhere audited.

## 10. Loading/empty/error-state findings

**Confirmed issue — the single most common finding in this audit.** The large majority of list/detail
pages set `loading.set(false)` inside their subscription's `error` callback **without recording that the
request failed**, so the template's "no data" branch renders unconditionally whenever loading finishes,
whether that's because the fetch succeeded with zero rows or because it failed outright. Confirmed in:
customer Profile (notifications tab), Address list (+ the header dropdown), Home, Product list, Product
detail, Cart, Checkout (initial cart/address fetch), Order list, Order detail, Cart-address-selector's
serviceability check, Wishlist, customer Support tickets; retailer Catalogue, Inventory, Orders; fleet
Drivers, Vehicles, Assignments, Expenses, Dashboard, Trips; Admin dashboard; Location `queue-detail`;
Territory/States toggles; Audit logs. Two screens already do this correctly and were used as the
reference pattern for the fixes below: `driver-dashboard.component.ts`'s trip list and `location/
dashboard/dashboard.component.ts` (Location Manager dashboard), both of which already carry a distinct
`...Error` signal shown instead of an empty-state.

**Fixed this round** (adds a `loadError` signal, an `app-empty-state icon="error_outline"` branch with a
Retry button, keeping the existing "genuinely empty" branch unchanged) in: customer Order list, Cart,
Wishlist, and customer Address list. This directly demonstrates the fix pattern; see §15 for the full
list of confirmed-but-not-yet-migrated screens using the identical pattern.

**Confirmed correct behaviour:** the shared `EmptyStateComponent` already distinguished icon/title/
subtitle appropriately per screen (e.g. `error_outline` → `fa-circle-exclamation` was already mapped and
already used correctly by `product-detail` for a genuine 404) — the gap was call sites not using it for
the *failure* case, not a missing capability in the component. Extended with an optional `<ng-content>`
slot (fully backward compatible — unused by existing call sites) so a Retry button (or, for a
filtered-empty state elsewhere, a "Clear filters" action) can be projected in without new component
inputs.

## 11. Accessibility findings

**Confirmed issue (fixed):** the toast had no `role`/`aria-live`, so a screen reader user was never
informed a toast appeared. Fixed with `role="status"` and `aria-live="assertive"` for error/warning,
`"polite"` for info/success.

**Confirmed correct behaviour:** every audited dialog (`WorkTransferDialogComponent`, the bulk-upload
dialogs, and the new `ConfirmDialogComponent`) uses `role="dialog"`/`"alertdialog"` with `aria-modal`
and `aria-labelledby`/`aria-describedby`, and the field-hint tooltip is already keyboard-focusable with
a proper accessible label (`aria-label="Show {field} requirements"`) and closes on Escape. The new
`ConfirmDialogComponent` follows the same pattern: focuses its Cancel button on open (so a stray Enter
keypress never confirms a destructive action by accident) and closes safely on Escape unless busy.

**Confirmed correct behaviour:** disabled/loading buttons throughout the app already communicate their
state via the native `disabled` attribute (assistive-technology-visible by default) plus a text label
change where implemented (§9) — color/spinner alone is never the only signal in the correctly-built
areas.

**Potential concern requiring runtime verification:** the eight locally-reimplemented toasts (§4) render
as a plain `<div>` with no `role`/`aria-live` at all — unlike the shared component, they are not
announced to assistive technology. Not fixed this round (see §15).

## 12. Confirmed fixes implemented

**Shared infrastructure**
- `frontend/src/app/shared/toast/toast.service.ts` — added a `'warning'` variant; `.show()` now uses a
  longer (5s) default duration for `'error'`/`'warning'` than for `'info'`/`'success'` (3s); added
  `dismiss()` for the new manual close button.
- `frontend/src/app/shared/toast/toast.component.ts` — added the `warning` (amber) colour, a
  variant-matched icon, a close button, and `role="status"` / `aria-live` (assertive for error/warning,
  polite otherwise).
- `frontend/src/app/shared/confirm-dialog/confirm-dialog.component.ts` (**new**) — the one generic
  "are you sure?" dialog, reusing the existing dialog visual pattern (backdrop, card, icon badge,
  `btn-outline`/`btn-primary` buttons, danger-red override) and the existing spinner convention. Focuses
  Cancel on open; Escape cancels unless busy; presentational only (never performs the action itself).
- `frontend/src/app/shared/empty-state/empty-state.component.html` — added an optional `<ng-content>`
  slot for a Retry/Clear-filters action, fully backward compatible.
- `frontend/src/app/core/api/http-error.util.ts` — any `status >= 500` now always returns the fixed
  generic message, regardless of what the response body contains, closing the gap where a service
  without its own catch-all handler (S1, S2 — also fixed, see below) could otherwise leak a raw
  exception message to every consumer of this utility.

**Native-dialog replacement**
- `frontend/src/app/features/fleet/expenses/expenses.component.ts` (+ `.html`) — both `window.confirm()`
  calls (approve for reimbursement; reverse an approval to rejected) replaced with
  `ConfirmDialogComponent`; also switched this file's error/success toasts from `.open()` (forced
  'info') to `.show(msg, 'success' | 'error')`.

**New confirmation dialogs for previously-unconfirmed destructive actions**
- Delete product — `retailer/catalogue/catalogue.component.ts` (+ `.html`).
- Reject order (retailer) — `retailer/orders/orders.component.ts` (+ `.html`).
- Cancel order (customer) — `orders/order-detail/order-detail.component.ts` (+ `.html`).
- Delete address (customer) — `addresses/address-list.component.ts` (+ `.html`).
- Delete tax configuration, complete settlement — `operations/finance/finance.component.ts` (+ `.html`).

**Toast-variant and false-empty-state fixes**
- `.open()` → `.show(msg, 'success' | 'error' | 'warning')` fixed in: `cart/cart.component.ts`,
  `addresses/address-list.component.ts`, `wishlist/wishlist.component.ts`, `products/product-detail/
  product-detail.component.ts`, `operations/finance/finance.component.ts`.
- `loadError` signal + error-state `app-empty-state` with Retry added to: `orders/order-list/
  order-list.component.ts` (+ `.html`), `cart/cart.component.ts` (+ `.html`), `wishlist/
  wishlist.component.ts` (+ `.html`), `addresses/address-list.component.ts` (+ `.html`).

**Backend message safety**
- `S1-platform-territory/.../exception/GlobalExceptionHandler.java` — added the missing catch-all
  `Exception` handler (logs server-side, returns a fixed generic message).
- `S2-partner-verification/.../exception/GlobalExceptionHandler.java` — added the missing catch-all,
  explicitly preserving Spring's own correctly-statused `ErrorResponse` exceptions instead of collapsing
  them to 500 (matching the reasoning already documented on that file's `DataAccessException` handler).
- `S3-commerce-customer/.../exception/GlobalExceptionHandler.java` — `conflict()` no longer puts a
  `DataIntegrityViolationException`'s raw message into `technicalMessage`.
- `S4-order-logistics/.../service/OrderItemService.java` — `deductStock()` no longer appends the raw
  `FeignException` message to the client-facing `InsufficientStockException`.
- `S3-commerce-customer/.../dto/request/ProductRequest.java` — added user-appropriate `message=` text to
  every constraint (previously relying on Bean Validation defaults, including a literal regex leak for
  an invalid SKU).

## 13. Files/modules changed

| Layer | File | Change |
| --- | --- | --- |
| Frontend (shared) | `shared/toast/toast.service.ts`, `shared/toast/toast.component.ts` | Warning variant, icons, close button, `aria-live`, variant-based duration |
| Frontend (shared, new) | `shared/confirm-dialog/confirm-dialog.component.ts` | Generic confirm/cancel dialog, replaces `window.confirm()` |
| Frontend (shared) | `shared/empty-state/empty-state.component.html` | Optional action slot (Retry / Clear filters) |
| Frontend (shared) | `core/api/http-error.util.ts` | 5xx always generic, regardless of body content |
| Frontend | `features/fleet/expenses/expenses.component.ts` (+ `.html`) | Removed `window.confirm()` ×2; shared-toast variant fix |
| Frontend | `features/retailer/catalogue/catalogue.component.ts` (+ `.html`) | Delete-product confirmation |
| Frontend | `features/retailer/orders/orders.component.ts` (+ `.html`) | Reject-order confirmation |
| Frontend | `features/orders/order-detail/order-detail.component.ts` (+ `.html`) | Cancel-order confirmation |
| Frontend | `features/addresses/address-list.component.ts` (+ `.html`) | Delete-address confirmation; error-state; toast-variant fix |
| Frontend | `features/operations/finance/finance.component.ts` (+ `.html`) | Delete-tax-config + complete-settlement confirmation; toast-variant fixes |
| Frontend | `features/orders/order-list/order-list.component.ts` (+ `.html`) | Error-state (was false-empty) |
| Frontend | `features/cart/cart.component.ts` (+ `.html`) | Error-state; toast-variant fix |
| Frontend | `features/wishlist/wishlist.component.ts` (+ `.html`) | Error-state; toast-variant fix |
| Frontend | `features/products/product-detail/product-detail.component.ts` | Toast-variant fix |
| Backend S1 | `exception/GlobalExceptionHandler.java` | Added catch-all `Exception` handler |
| Backend S2 | `exception/GlobalExceptionHandler.java` | Added catch-all, `ErrorResponse`-aware |
| Backend S3 | `exception/GlobalExceptionHandler.java` | `technicalMessage` no longer leaks raw DB exception text |
| Backend S3 | `dto/request/ProductRequest.java` | Added safe validation messages to every constraint |
| Backend S4 | `service/OrderItemService.java` | Removed raw Feign message from a client-facing exception |

## 14. Test scenarios

**Actually executed this round:**

| # | Scenario | Result |
| --- | --- | --- |
| 1 | Full backend test suite (S1, S2, S3, S4) after every exception-handler/DTO change | All green: no failures, no errors |
| 2 | Frontend production build after every component/service/dialog change | Succeeded, no compile errors |
| 3 | Node-transpiled unit check of `extractErrorMessage` (10 cases: 500/503 with a leaked message, no body, safe 400/409 messages, network failure, login-401 vs. session-401, 403, joined validation errors) | All 10 pass — 5xx never surfaces backend body content under any tested shape |
| 4 | Repository-wide grep for `alert(`/`confirm(`/`window.alert`/`window.confirm` | Confirms exactly the two now-removed call sites existed, and none remain |
| 5 | Live browser: logged in as a real customer, opened address list, clicked Delete, clicked Cancel | `ConfirmDialogComponent` rendered with the correct title/message/danger-red button; Cancel closed it with both addresses still present - no request was sent |
| 6 | Live browser: invoked `ToastService.show(msg, 'warning')` directly against the running app | Rendered with `bg-amber-500`, `aria-live="assertive"`, the warning icon, and a working close button |

**Recommended manual/runtime tests (not executed live this round — see §15):**

| # | Scenario | Expected |
| --- | --- | --- |
| 7 | Delete a product / reject a retailer order / cancel a customer order / delete a tax rule / complete a settlement (the other four new dialogs beyond address-delete, already verified above) | Confirmation dialog appears first in every case; Cancel performs no action; Confirm performs it exactly once, with the dialog's own button showing a busy/spinner state throughout |
| 8 | Approve then reject a fleet expense | `ConfirmDialogComponent` appears (approve: always; reject: only when reversing an existing approval, matching the original `window.confirm()` behaviour exactly); resulting toast is green/red as appropriate |
| 9 | Trigger a 5xx from any of the six services (e.g. stop a downstream dependency mid-request) | User sees "Something went wrong. Please try again later." — never a raw exception message, "Internal Server Error," or a stack trace |
| 10 | Submit an invalid SKU directly to `POST /api/v1/products` (bypassing the UI) | Response text reads "SKU must be 3-20 characters: letters, digits, '-' or '_'." — not the raw regex |
| 11 | Disconnect network and open Order list / Cart / Wishlist / Address list | Each now shows "Could not load…" with a Retry button — not a false "you have none of these" message |
| 12 | Trigger a warning toast in a real user flow (e.g. add unresolved items to cart and try to check out) | Renders amber, with a warning icon, stays visible ~5s, and is announced via `aria-live` |
| 13 | Hover/keyboard-focus a toast's close button | Dismisses immediately regardless of variant |

## 15. Remaining limitations (confirmed, not fixed this round)

This audit found significantly more instances of two mechanical patterns than could be safely fixed
file-by-file within one session without an unreasonable amount of repetitive, easy-to-get-subtly-wrong
change. Each remaining instance follows the *exact same fix* already applied and verified above, so
closing them is now a matter of repeating a proven pattern, not further investigation:

- **False-empty-state on load failure** (§10) — the same `loadError` + error-state fix applied to Order
  list/Cart/Wishlist/Address list should also be applied to: Profile (notifications tab), Home, Product
  list, Product detail, Checkout's initial fetch, Order detail's initial fetch, Cart-address-selector,
  customer Support tickets; retailer Catalogue/Inventory/Orders; fleet Drivers/Vehicles/Assignments/
  Expenses/Dashboard/Trips; Admin dashboard; `location/queue-detail`; Territory/States toggle screens;
  Audit logs.
- **Local `toastMessage` reimplementations instead of the shared `ToastService`** (§4) — 8 files:
  `retailer/catalogue`, `retailer/inventory`, `retailer/orders`, `fleet/assignments`, `admin/accounts`,
  `admin/operations-managers`, `admin/states`, `shared/support/ticket-detail.component.ts`.
- **No confirmation dialog for other business-critical actions** (§5) — user account status changes
  (`admin/accounts.component.ts`), Operations Manager status changes (`admin/operations-managers.
  component.ts`), verification/document approve-reject and revoke-approval (`location/queue-detail.
  component.ts`), refund approve/reject/complete (`shared/support/ticket-detail.component.ts`), cart
  clear/remove-item. The `officers.component.ts` "no pending work → no popup" pattern for Location
  Manager deactivation is a known, previously-documented product decision, not an oversight, but it is
  inconsistent with the newly-added confirmations elsewhere and worth a deliberate product decision on
  whether to align it.
- **Missing loading-label/spinner text on several correctly-disabled Save buttons** (§9) — cosmetic only
  (no duplicate-submit risk): retailer catalogue's product Save, retailer/fleet/driver profile and store
  Save, fleet-owner onboarding's "Submit for verification," inventory's stock adjustment buttons.
- **Unmessaged Bean Validation constraints beyond `ProductRequest`** (§3/§7) — `AddressRequest.java`
  (S3), several `CustomerRegistrationRequestDto.java` fields (S1), and `RetailerDTO`/`FleetOwnerDTO`'s
  field-name-style `@NotNull` messages (S2, e.g. `"cityId cannot be null"`). All are only reachable by a
  direct API call bypassing the UI's own already-correct validation.
- **`operations/support/support.component.ts`'s "Contact Developers" fabricated success dialog** (§5) —
  claims an email was sent when no backend call is made at all. Needs a product decision (wire up a real
  endpoint, or change the wording to not claim an action that didn't happen), not a mechanical fix.
- **`ticket-detail.component.ts`'s hardcoded refund-disapproval reason** (§6) — needs a reason input
  field added to that flow, a small UI addition rather than a message-wording fix.
- **Runtime/live verification actually performed this round:** with the full stack running, logged in
  as a real customer, opened `/addresses`, clicked Delete on a real saved address, and confirmed the new
  `ConfirmDialogComponent` renders with the exact expected title/message/danger-red Delete button;
  clicking Cancel closed it with both addresses still present (no action taken). Separately invoked
  `ToastService.show(msg, 'warning')` directly against the live running app and confirmed the rendered
  toast carries `bg-amber-500`, `aria-live="assertive"`, the warning icon, and a working close button.
- **Runtime/live verification not performed this round for:** the accessibility behaviour of the 8
  local toast reimplementations (§11); keyboard-only (non-mouse) operation of `ConfirmDialogComponent`;
  the exact wording a live 5xx from each of the six services now produces end-to-end through the Gateway
  (verified via a Node-level unit test of the mapping logic and via direct code reading of each
  service's handler, not via deliberately triggering a live 500 in the running stack); the other four
  newly-added confirmation dialogs (delete product, reject order, cancel order, delete tax
  configuration/complete settlement) beyond the address-delete case actually exercised above.
