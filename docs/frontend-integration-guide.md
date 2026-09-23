# Frontend Integration Guide

Everything a frontend developer needs to start building against this backend without asking a backend developer what exists. For the exhaustive endpoint-by-endpoint reference, see `api-catalog.md`. For the screen-by-screen mapping, see `ui-api-mapping.md`.

## 1. The universal flow

```text
LOGIN
  ↓ POST /api/v1/auth/login  (through the Gateway, http://localhost:8080)
JWT (accessToken)
  ↓ every subsequent call: Authorization: Bearer <accessToken>
Gateway (localhost:8080)
  ↓ validates the JWT, checks the token's role against the requested route,
    then forwards with trusted X-User-Account-Id / X-User-Role headers
Role-based workspace
  ↓ GET /api/v1/users/me  to resolve "who am I" and which workspace to render
API calls (per role, see §3 below and ui-api-mapping.md)
  ↓
Logout: client-side only — discard the token. There is no server-side session
  to invalidate (stateless JWT); see "Known gaps" §5.
```

**Everything goes through the Gateway at `http://localhost:8080`.** Never call a service's own port (8081-8086) directly from the frontend — those are for backend developers only. All backend paths below are relative to the Gateway's base URL.

## 2. Login and identity resolution

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "someone@example.com", "password": "..." }
```

Response:
```json
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresInSeconds": 3600,
  "userAccountId": "b3f1...-uuid",
  "email": "someone@example.com",
  "role": "CUSTOMER"
}
```

Store `accessToken` and send it as `Authorization: Bearer <accessToken>` on every call. The response already tells you the `role` and `userAccountId` — you do not need a separate call just to know which workspace to render right after login, though `GET /api/v1/users/me` is available any time you need to re-fetch the current user's canonical profile (e.g. after a page refresh where you only have the token, not the login response, in memory).

**Never send a `userAccountId`/`X-User-Account-Id` you got from anywhere other than the JWT/login response for "my own" operations.** The backend (Gateway + several services) derives identity from the validated token, not from a client-supplied ID — see "Security model" below.

## 3. Per-role first calls after login

| Role | Dashboard/first calls |
|---|---|
| CUSTOMER | `GET /api/v1/users/me` → `GET /api/v1/customers/me` → `GET /api/v1/products` (home/browse) → `GET /api/v1/cart` → `GET /api/notifications` |
| RETAILER | `GET /api/v1/users/me` → `GET /api/retailers?userAccountId=...` (resolve own retailer profile — see gap note in `api-catalog.md`) → `GET /api/v1/retailers/me/products/summary` → `GET /api/orders/mine?retailerId=...` (incoming orders to accept/reject — see §7) |
| LOCATION_MANAGER | `GET /api/v1/users/me` → `GET /api/verification-queues?status=PENDING` → `GET /api/v1/cities` / `GET /api/v1/zones` |
| OPERATIONS_MANAGER | `GET /api/v1/users/me` → `GET /api/v1/operations-managers/summary` → `GET /api/verification-queues` → `GET /api/settlements` → `GET /api/audit-logs` |
| FLEET_MANAGER | `GET /api/v1/users/me` → `GET /api/vehicles?fleetOwnerId=...` → `GET /api/drivers?fleetOwnerId=...` → `GET /api/assignments/active` → `GET /api/orders/pending-fleet-assignment` (new delivery assignment inbox, see §7) → `GET /api/trips` |
| SUPER_ADMIN | `GET /api/v1/users/me` → `GET /api/user-accounts` → `GET /api/retailers` → `GET /api/orders` → `GET /api/payment-transactions` |

Every role's list/detail/create-update/action/notification pattern is detailed screen-by-screen in `ui-api-mapping.md`; this table is only the "first paint" sequence.

## 4. Security model — what the frontend must know

- **JWT is issued only by S1** (`POST /api/v1/auth/login`), signed with a secret shared between S1 and the Gateway. The frontend never talks to S1 directly for this — always through the Gateway.
- **The Gateway enforces role-based route access** (see `RouteAuthorizationRules` in `architecture.md`). A request with a valid token but the wrong role gets `403 Forbidden`, not `401`. A missing/invalid/expired token gets `401 Unauthorized`.
- **`/me`-style endpoints resolve identity from the token, not from anything the client sends.** `GET /api/v1/users/me` cannot be used to fetch someone else's profile no matter what you pass — there's nothing to pass; it only reads the authenticated identity.
- **Fine-grained ownership checks (e.g. "this is YOUR order," "this is YOUR cart") are enforced per-service, not uniformly.** S3 (commerce/cart/wishlist/addresses) enforces this via the trusted `X-User-Account-Id` header the Gateway sets. S1 enforces role-level access. **S2, S4, S5, S6 do not yet enforce per-resource ownership** — e.g. nothing stops an authenticated RETAILER token from reading a different retailer's order via `GET /api/orders/{id}` if they guess the ID. This is a real, documented gap — see "Known gaps" below and `architecture.md` §11. Do not build frontend features that assume ownership is server-enforced everywhere; where it matters, only show/link to resources your own list-endpoint calls actually returned.
- **CORS** is configured at the Gateway (`spring.cloud.gateway.server.webflux.globalcors`) allowing `http://localhost:3000` and `http://localhost:5173` by default (override via the `CORS_ALLOWED_ORIGINS` environment variable on the Gateway for other dev ports or a deployed frontend origin).

## 5. Known gaps the frontend team should plan around

These are backend limitations, not missing frontend work — do not build UI that assumes they're solved:

1. **No refresh token / token renewal endpoint.** A token expires after `expiresInSeconds` (default 3600s = 1 hour) and the user must log in again. Build your session-expiry handling around a hard re-login, not a silent refresh.
2. **No server-side logout/token invalidation.** "Logout" in the frontend is simply discarding the stored token client-side.
3. **No password-reset/forgot-password flow.** There is no OTP or reset-token persistence in the backend. Do not build a forgot-password screen that expects a working backend today — flag it as blocked on backend work.
4. **Customer self-registration is implemented.** Use `POST /api/v1/auth/register/customer`. The endpoint always creates a `CUSTOMER` account and never accepts a role from the client. After login, S3 automatically provisions the customer's profile on the first authenticated customer-context request.
5. **Ownership enforcement gap** — see §4 above.
6. **No dedicated location-management, fleet-maintenance, fleet-compliance, driver-earnings/incentive, or operations-messaging entities exist.** Where the UI shows these screens, see `application-workflow.md` §14 and `ui-api-mapping.md` for what's genuinely backed by data today vs. what's a documented gap. In short: location management should be built against State/City/Zone; fleet expenses (not a separate "maintenance" record) back the maintenance-history screen; driver earnings must be derived client-side or via a future backend aggregation from `PaymentTransaction`/`Settlement` (no dedicated endpoint exists yet); operations messaging should use `Notification`, not a chat/conversation model.
7. **A finance/admin overview aggregation endpoint is now available:** `GET /api/analytics/overview`, restricted at the Gateway to platform staff. It reports transaction, invoice, refund, settlement, support, notification and audit counts plus recorded payment amount. More specialized analytics can be added later without adding persistent analytics entities.

## 6. Cart delivery-address serviceability

Every time the customer changes the delivery address in Cart, call `POST /api/v1/cart/serviceability-check` with the **candidate** address id *before* saving it as the order's delivery address:

```json
{ "addressId": "b3f1...-uuid" }
```

Response is per-line, never an all-or-nothing verdict:

```json
{
  "addressId": "b3f1...-uuid",
  "allServiceable": false,
  "lines": [
    { "productId": 101, "retailerId": "r1...", "serviceable": true,  "reasonCode": null, "deliveryCharge": 49.00, "estimate": "..." },
    { "productId": 205, "retailerId": "r2...", "serviceable": false, "reasonCode": "OUT_OF_ZONE", "deliveryCharge": null, "estimate": null }
  ]
}
```

- **Serviceable lines stay in the cart untouched.** Only surface a conflict UI for the lines that come back `serviceable: false`.
- **Never silently remove a product.** For each unserviceable line, offer the customer: "Try Another Shop" (navigate to `/products?retailerId=...` or similar), remove just that line, or pick a different address instead.
- A multi-retailer cart can have some lines serviceable and others not at the same address — handle that per-retailer, not as one cart-wide pass/fail.
- **Re-check again immediately before payment** — `POST /api/v1/checkout/prepare` runs the same S4 call server-side and returns its own `serviceabilityLines[]`; do not trust a serviceability result from earlier in the session as still valid by the time the customer reaches checkout.

## 7. Order placement & fulfilment flow

The full flow from cart to delivery is **orchestrated by the frontend** — no single backend endpoint does all of this for you, and no stage should ever be assumed complete without a backend response confirming it.

```text
1. POST /api/v1/checkout/prepare        (S3 — final price/tax/serviceability check)
2. POST /api/orders                     (S4 — creates the order, status NEW)
   + POST /api/order-items (one per line)
3. POST /api/orders/{id}/submit         (S4 — NEW → WAITING_FOR_RETAILER, starts the 10-min clock)
4. POST /api/payment-transactions       (S6 — simulated payment, no real gateway)
   POST /api/payment-transactions/{id}/capture
                                         (S6 best-effort confirms the order back to S4)
5. Retailer sees the order and calls either:
     POST /api/orders/{id}/retailer-accept   → RETAILER_ACCEPTED, fleet search starts
     POST /api/orders/{id}/retailer-reject   → RETAILER_REJECTED
   ...or does nothing for 10 minutes, and the order auto-flips to SHOP_UNAVAILABLE.
6. On acceptance, S4 searches S5 for the nearest available vehicle+driver and notifies
   that fleet owner, who accepts via the existing pending-fleet-assignment flow.
7. The existing Trip state machine (pickup → in-transit → delivered) takes over from there.
```

**Customer tracking screen** — poll `GET /api/orders/{id}/tracking`, don't infer stage completion client-side:

```json
{
  "displayStage": "Finding a delivery partner...",
  "haltedState": null,
  "steps": [
    { "key": "ORDER_PLACED",              "label": "Order Placed",              "state": "DONE",    "reachedAt": "..." },
    { "key": "WAITING_FOR_RETAILER",      "label": "Waiting for Retailer",      "state": "DONE",    "reachedAt": "..." },
    { "key": "RETAILER_ACCEPTED",         "label": "Retailer Accepted",         "state": "DONE",    "reachedAt": "..." },
    { "key": "FINDING_DELIVERY_PARTNER",  "label": "Finding Delivery Partner",  "state": "CURRENT", "reachedAt": null },
    { "key": "DELIVERY_PARTNER_ACCEPTED", "label": "Delivery Partner Accepted", "state": "PENDING", "reachedAt": null },
    { "key": "GOING_TO_SHOP",             "label": "Going to Shop",             "state": "PENDING", "reachedAt": null },
    { "key": "ORDER_PICKED_UP",           "label": "Order Picked Up",           "state": "PENDING", "reachedAt": null },
    { "key": "OUT_FOR_DELIVERY",          "label": "Out for Delivery",          "state": "PENDING", "reachedAt": null },
    { "key": "DELIVERED",                 "label": "Delivered",                 "state": "PENDING", "reachedAt": null }
  ]
}
```

`haltedState` is non-null only when the order has stopped moving for a reason the customer must act on (e.g. `RETAILER_REJECTED`, `SHOP_UNAVAILABLE`) — that's your cue to show "Your order was rejected by the shop" / "The shop did not respond to your order. Please find another shop for this product." with a "Find Another Shop" action, rather than rendering it as just another step in the stepper.

**Retailer-side**: list incoming orders via `GET /api/orders/mine?retailerId=...`, act on them with `retailer-accept`/`retailer-reject` above. **Fleet-owner-side**: `GET /api/orders/pending-fleet-assignment` for the assignment inbox, then the existing trip-acceptance flow.

## 8. Product cards must always show the shop

Every `ProductResponse` (search, category, recommendations, wishlist — every product-bearing endpoint) now includes `retailerName`/`retailerStatus`/`retailerLatitude`/`retailerLongitude` alongside `retailerId`. Never render a product card without its shop name/badge. Tapping the badge should expand shop details (name, verification status, location) — fetch `GET /api/v1/retailers/{retailerId}` and, lazily (only once expanded, not on every card render), `GET /api/v1/retailers/{retailerId}/rating-summary` for the shop's aggregate rating.

## 9. Frontend-friendly response shapes

Most endpoints return exactly the DTO shape documented in `api-catalog.md` — check there before assuming a field exists. Two additions were made in this pass specifically to reduce chained calls a screen would otherwise need:

- **S3 product details**: see `api-catalog.md`'s S3 section for the combined product+rating-summary endpoint added to avoid the product page needing 2 separate calls.
- **S3 product responses**: every `ProductResponse` is now pre-joined with retailer identity (§8 above) — you no longer need a separate S2 call just to show a shop name/badge on a product card.
- Where a screen genuinely needs data from 2+ services that is **not** one of the two additions above (e.g. an order's own retailer name on an order-detail screen, which lives in S2, not S4), the backend still does **not** pre-join it for you — the frontend must make the 2 calls (or ask backend to add a dedicated aggregation endpoint).

## 10. Environments

| Environment | Gateway base URL |
|---|---|
| Local dev (default) | `http://localhost:8080` |
| Configure via | frontend `.env`, not hardcoded — the Gateway port is fixed at 8080 in this project's dev setup but a deployed environment will differ |

See `running-the-project.md` for how to start the whole backend stack locally.
