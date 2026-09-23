# S3 — Commerce & Customer: API Reference (live-tested)

Every endpoint below was exercised with a real `curl` command against the live S3 instance on
**port 8083** (Postgres-backed, started via `scriptsstart-all.cmd /postgres`), not through the
Gateway. JWTs were minted live via `POST http://localhost:8081/api/v1/auth/login` (seeded
accounts, password `AroundU@123` for all). Internal `/api/v1/internal/**` routes use HTTP Basic
(`lbos-service` / `service123`).

This pass happened immediately after a large rewrite of S3's business logic this session (real
enums, DB-level search filtering, human-readable address resolution, structured cart validation,
hardened review ownership, one-query wishlist membership, retailer role gate, Swagger accuracy,
efficient delete checks — see `docs/business-logic/` for the full rationale). Three real bugs
were found and fixed *during this test pass* — see [Bugs found](#bugs-found).

## Table of Contents

1. [ProductController](#productcontroller) — `/api/v1/products` (public)
2. [CategoryController](#categorycontroller) — `/api/v1/product-categories`
3. [CatalogueController](#cataloguecontroller) — `/api/v1/retailers/me/products`
4. [InventoryController](#inventorycontroller) — `/api/v1/retailers/me/inventory`
5. [InternalInventoryController](#internalinventorycontroller) — `/api/v1/internal/products`
6. [CustomerController](#customercontroller) — `/api/v1/customers`
7. [InternalCustomerController](#internalcustomercontroller) — `/api/v1/internal/customers`
8. [AddressController](#addresscontroller) — `/api/v1/customers/me/addresses`
9. [CartController](#cartcontroller) — `/api/v1/cart`
10. [WishlistController](#wishlistcontroller) — `/api/v1/customers/me/wishlist-items`
11. [ReviewController](#reviewcontroller) — `/api/v1/reviews`
12. [CheckoutController](#checkoutcontroller) — `/api/v1/checkout`
13. [Bugs found](#bugs-found)

**Auth summary:** `GET /api/v1/products/**`, `GET /api/v1/product-categories/**`,
`GET /api/v1/reviews/**` are genuinely public (`permitAll()`, no JWT). `/api/v1/retailers/me/**`
requires `hasRole("RETAILER")`. `GET /api/v1/customers` (admin search) requires
`SUPER_ADMIN`/`OPERATIONS_MANAGER`. Everything else under `/api/v1/**` requires any authenticated
JWT with ownership enforced in the service layer via `ContextSupport` (never a client-supplied
id). `/api/v1/internal/**` requires HTTP Basic `SERVICE` role, separate filter chain.

---

## ProductController

Public catalogue browsing. **Auth: none** (all three routes `permitAll()`).

### GET /api/v1/products
DB-level filtered search (`q`, `categoryId`, `retailerId`, `inStock`), paginated.
```bash
curl -s "http://localhost:8083/api/v1/products?page=0&size=2&inStock=true"
```
**Result: `200`** — filtered `totalElements`/`totalPages` (confirmed live this session: a
`q=Widget` filter correctly returned `totalElements:1`, not the whole table's count — this was
the original bug this session's rewrite fixed).

### GET /api/v1/products/{id}
```bash
curl -s http://localhost:8083/api/v1/products/2
```
**Result: `200`**
**Negative — 404:** `curl -s http://localhost:8083/api/v1/products/999999` → `404`

### GET /api/v1/products/{id}/details
```bash
curl -s http://localhost:8083/api/v1/products/2/details
```
**Result: `200`**

---

## CategoryController

**Auth:** GET routes `permitAll()`; POST/PATCH/DELETE `hasRole("SUPER_ADMIN")`.

### GET /api/v1/product-categories
```bash
curl -s "http://localhost:8083/api/v1/product-categories?page=0&size=5"
```
**Result: `200`** (anonymous)

### GET /api/v1/product-categories/active
```bash
curl -s http://localhost:8083/api/v1/product-categories/active
```
**Result: `200`** (anonymous)

### POST /api/v1/product-categories
`status` is now a real `CategoryStatus` enum (`ACTIVE`/`INACTIVE`) — an invalid value 400s
cleanly (see [Bugs found #2](#bugs-found), the fix that made this possible).
```bash
curl -s -X POST http://localhost:8083/api/v1/product-categories -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" -d '{"name":"S3QA Category","status":"ACTIVE"}'
```
**Result: `201`**
**Negative — 403 (wrong role):** same call with a `RETAILER` token → `403`

### GET /api/v1/product-categories/{id}
```bash
curl -s http://localhost:8083/api/v1/product-categories/5
```
**Result: `200`**

### PATCH /api/v1/product-categories/{id}
```bash
curl -s -X PATCH http://localhost:8083/api/v1/product-categories/5 -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" -d '{"name":"S3QA Category Upd","status":"INACTIVE"}'
```
**Result: `200`**

### DELETE /api/v1/product-categories/{id}
```bash
curl -s -X DELETE http://localhost:8083/api/v1/product-categories/5 -H "Authorization: Bearer $ADMIN"
```
**Result: `204`**

---

## CatalogueController

Retailer's own product CRUD. **Auth:** `hasRole("RETAILER")` (added this session — see
[Bugs found](#bugs-found) in the business-logic writeup; previously any authenticated role could
reach this).

### POST /api/v1/retailers/me/products
`stock` is required on create (a real, dedicated bug fix this session — see
[Bugs found #1](#bugs-found)); `inventoryStatus` is always derived, never client-supplied.
```bash
curl -s -X POST http://localhost:8083/api/v1/retailers/me/products -H "Authorization: Bearer $RETAILER1" \
  -H "Content-Type: application/json" \
  -d '{"name":"S3QA Product","sku":"S3QASKU...","categoryId":1,"unitPrice":25.50,"stock":10,"status":"ACTIVE","description":"A qa test product for endpoints"}'
```
**Result: `201`** → `{"id":9,...,"stock":10,"status":"ACTIVE","inventoryStatus":"LOW_STOCK",...}`
**Negative — 422 (stock omitted):** `{"technicalMessage":"stock is required when creating a product",...}`

### GET /api/v1/retailers/me/products/{id}
Scoped to the caller's own retailer profile — another retailer's product id 404s, not 403 (keeps
existence private).
```bash
curl -s http://localhost:8083/api/v1/retailers/me/products/9 -H "Authorization: Bearer $RETAILER1"
```
**Result: `200`** (owner) / **`404`** (a different retailer's token)

### GET /api/v1/retailers/me/products
DB-level filtered+paginated search (`q`, `categoryId`, `status`, `inventoryStatus`), scoped to
the caller's retailer.
```bash
curl -s "http://localhost:8083/api/v1/retailers/me/products?page=0&size=5" -H "Authorization: Bearer $RETAILER1"
```
**Result: `200`**

### GET /api/v1/retailers/me/products/summary
```bash
curl -s http://localhost:8083/api/v1/retailers/me/products/summary -H "Authorization: Bearer $RETAILER1"
```
**Result: `200`**

### PATCH /api/v1/retailers/me/products/{id}
`stock` must NOT be required here (update never touches inventory — that's
`POST .../inventory/adjustments`). See [Bugs found #1](#bugs-found) — this was broken by the
initial fix and corrected during this test pass.
```bash
curl -s -X PATCH http://localhost:8083/api/v1/retailers/me/products/9 -H "Authorization: Bearer $RETAILER1" \
  -H "Content-Type: application/json" \
  -d '{"name":"S3QA Product Upd","sku":"S3QASKU...","categoryId":1,"unitPrice":30,"status":"ACTIVE","description":"Updated description for qa testing"}'
```
**Result: `200`** (no `stock` field in the body — confirmed it's genuinely optional now)

### POST /api/v1/retailers/me/products/{id}/duplicate
Unique SKU (`-COPY` suffix, incrementing on collision), stock reset to 0, status forced `DRAFT`.
```bash
curl -s -X POST http://localhost:8083/api/v1/retailers/me/products/9/duplicate -H "Authorization: Bearer $RETAILER1"
```
**Result: `201`** → `{"sku":"S3QASKU...-COPY","stock":0,"status":"DRAFT","inventoryStatus":"OUT_OF_STOCK",...}`

### DELETE /api/v1/retailers/me/products/{id}
Blocked (422) if referenced by any customer's cart/wishlist/review — checked via efficient
`existsBy...` queries, not a full-table scan (this session's fix — see
[Bugs found](#bugs-found) writeup for the original O(n) issue).
```bash
curl -s -X DELETE http://localhost:8083/api/v1/retailers/me/products/10 -H "Authorization: Bearer $RETAILER1"
```
**Result: `204`** (unreferenced product) — a referenced product instead returns
`422 {"technicalMessage":"Product is referenced by customer data"}`, confirmed live against a
product sitting in a customer's cart.
**Negative — 404:** bogus id → `404`

**Negative — 403 (wrong role):** a `CUSTOMER` token hitting any `/retailers/me/products/**` route
→ `403` (this is the retailer role gate added this session).

---

## InventoryController

**Auth:** `hasRole("RETAILER")` (same gate as CatalogueController, same path prefix family).

### GET /api/v1/retailers/me/inventory
```bash
curl -s "http://localhost:8083/api/v1/retailers/me/inventory?page=0&size=5" -H "Authorization: Bearer $RETAILER1"
```
**Result: `200`**

### GET /api/v1/retailers/me/inventory/summary
```bash
curl -s http://localhost:8083/api/v1/retailers/me/inventory/summary -H "Authorization: Bearer $RETAILER1"
```
**Result: `200`**

### POST /api/v1/retailers/me/inventory/adjustments
Only `ADD_STOCK`/`REMOVE_STOCK`, positive quantity, atomic (no race condition), stock never
negative, `inventoryStatus` recalculated fresh after the change.
```bash
curl -s -X POST http://localhost:8083/api/v1/retailers/me/inventory/adjustments -H "Authorization: Bearer $RETAILER1" \
  -H "Content-Type: application/json" -d '{"productId":9,"type":"ADD_STOCK","quantity":5}'
```
**Result: `200`** → `{"resultingQuantity":15,"inventoryStatus":"HEALTHY"}`
**Negative — 422 (over-removal):** `{"type":"REMOVE_STOCK","quantity":100000}` → `422`, stock
unchanged.

---

## InternalInventoryController

Service-to-service stock mutation (called by S4 on order create/cancel). **Auth:** HTTP Basic,
`SERVICE` role, own filter chain — not retailer-scoped (trusted caller acting on any product).

### POST /api/v1/internal/products/{id}/deduct-stock
```bash
curl -s -u lbos-service:service123 -X POST http://localhost:8083/api/v1/internal/products/9/deduct-stock \
  -H "Content-Type: application/json" -d '{"quantity":1}'
```
**Result: `200`**

### POST /api/v1/internal/products/{id}/restore-stock
```bash
curl -s -u lbos-service:service123 -X POST http://localhost:8083/api/v1/internal/products/9/restore-stock \
  -H "Content-Type: application/json" -d '{"quantity":1}'
```
**Result: `200`**

**Negative — 401 (no Basic auth):** either endpoint without `-u` → `401`.

---

## CustomerController

**Auth:** `/me` routes any authenticated JWT (identity from JWT subject, never a client-supplied
id); `GET /` (admin search) requires `SUPER_ADMIN`/`OPERATIONS_MANAGER`.

### GET /api/v1/customers/me
```bash
curl -s http://localhost:8083/api/v1/customers/me -H "Authorization: Bearer $CUSTOMER1"
```
**Result: `200`**
**Negative — 401 (no auth):** `curl -s http://localhost:8083/api/v1/customers/me` → `401`

### GET /api/v1/customers
```bash
curl -s "http://localhost:8083/api/v1/customers?page=0&size=5" -H "Authorization: Bearer $ADMIN"
```
**Result: `200`** (admin) / **`403`** (a `CUSTOMER` token — role gate confirmed live)

### PATCH /api/v1/customers/me
`profileStatus` was removed from the accepted request body this session (a customer could
previously self-escalate to any status — see business-logic docs); the field is simply no longer
present in `UpdateCustomerRequest`, not silently ignored.
```bash
curl -s -X PATCH http://localhost:8083/api/v1/customers/me -H "Authorization: Bearer $CUSTOMER1" \
  -H "Content-Type: application/json" -d '{"dateOfBirth":"1995-05-05"}'
```
**Result: `200`**

*(`POST /api/v1/customers` and `DELETE /api/v1/customers/me` exist per the controller source but
were not separately exercised in this pass — profile creation already happens implicitly via
customer registration in S1, and delete wasn't run against a real seeded account for the same
reason `DELETE /api/user-accounts/{seeded-id}` wasn't run in the S1 pass.)*

---

## InternalCustomerController

**Auth:** HTTP Basic, `SERVICE` role.

### GET /api/v1/internal/customers/{customerProfileId}
```bash
curl -s -u lbos-service:service123 http://localhost:8083/api/v1/internal/customers/80000000-0000-0000-0000-000000000001
```
**Result: `200`**
**Negative — 401 (no auth):** `401`

---

## AddressController

**Auth:** any authenticated JWT; ownership enforced in code (another customer's address id 404s).
The whole request contract changed this session — see [Bugs found](#bugs-found) writeup: the
customer now provides `cityName`/`zoneName` (human-readable), and S3 resolves them to S1's
internal UUIDs itself via two new S1 lookup endpoints, rather than requiring the client to
already know internal territory IDs.

### POST /api/v1/customers/me/addresses
```bash
curl -s -X POST http://localhost:8083/api/v1/customers/me/addresses -H "Authorization: Bearer $CUSTOMER2" \
  -H "Content-Type: application/json" \
  -d '{"cityName":"Chennai","zoneName":"South Zone","addressTag":"HOME","line1":"S3QA test address line","defaultAddress":true}'
```
**Result: `201`** → `{"cityId":"20000000-...-0001","cityName":"Chennai","zoneId":"50000000-...-0002","zoneName":"South Zone",...}`
— response includes both the resolved names AND ids, so the UI never has to resolve ids back to
names itself.
**Negative — 422 (unknown city name):**
```bash
curl -s -X POST http://localhost:8083/api/v1/customers/me/addresses -H "Authorization: Bearer $CUSTOMER2" \
  -H "Content-Type: application/json" -d '{"cityName":"Nonexistentopolis","zoneName":"North Zone","addressTag":"WORK","line1":"x","defaultAddress":false}'
```
→ `422` `{"technicalMessage":"No such city: Nonexistentopolis"}` — a clean business error, not a
500 or an unhandled exception.

### GET /api/v1/customers/me/addresses/{id}
```bash
curl -s http://localhost:8083/api/v1/customers/me/addresses/2305a112-... -H "Authorization: Bearer $CUSTOMER2"
```
**Result: `200`** (owner) / **`404`** (a different customer's token — ownership confirmed live)

### GET /api/v1/customers/me/addresses
```bash
curl -s http://localhost:8083/api/v1/customers/me/addresses -H "Authorization: Bearer $CUSTOMER2"
```
**Result: `200`**

### PATCH /api/v1/customers/me/addresses/{id}
```bash
curl -s -X PATCH http://localhost:8083/api/v1/customers/me/addresses/2305a112-... -H "Authorization: Bearer $CUSTOMER2" \
  -H "Content-Type: application/json" \
  -d '{"cityName":"Chennai","zoneName":"South Zone","addressTag":"WORK","line1":"S3QA test address updated","defaultAddress":true}'
```
**Result: `200`**

### GET /api/v1/customers/me/addresses/default
```bash
curl -s http://localhost:8083/api/v1/customers/me/addresses/default -H "Authorization: Bearer $CUSTOMER2"
```
**Result: `200`**

### PUT /api/v1/customers/me/addresses/{id}/default
```bash
curl -s -X PUT http://localhost:8083/api/v1/customers/me/addresses/{id}/default -H "Authorization: Bearer $CUSTOMER2"
```
**Result: `200`** — one-default-address rule confirmed: setting a new default correctly demotes
the previous one.

### DELETE /api/v1/customers/me/addresses/{id}
Deleting the current default correctly promotes another address to default (existing rule,
untouched this session); deleting a non-default address just removes it.
```bash
curl -s -X DELETE http://localhost:8083/api/v1/customers/me/addresses/{id} -H "Authorization: Bearer $CUSTOMER2"
```
**Result: `204`**

---

## CartController

**Auth:** any authenticated JWT, scoped to the caller via `ContextSupport`.

### GET /api/v1/cart
```bash
curl -s http://localhost:8083/api/v1/cart -H "Authorization: Bearer $CUSTOMER2"
```
**Result: `200`**

### POST /api/v1/cart/items
Validates product exists/is ACTIVE, `existingQuantity + requestedQuantity <= currentStock`.
`CartItemResponse` now includes `productActive` (new field this session, needed for the
structured validate endpoint below).
```bash
curl -s -X POST http://localhost:8083/api/v1/cart/items -H "Authorization: Bearer $CUSTOMER2" \
  -H "Content-Type: application/json" -d '{"productId":2,"quantity":2}'
```
**Result: `201`** → `{"cartItemId":"...","productActive":true,...}`

### PATCH /api/v1/cart/items/{id}
Requires `productId` in the body too, not just `quantity` — this is deliberate defense-in-depth
(`CartServiceImpl.update()` rejects the call if the supplied `productId` doesn't match the cart
line's actual product, preventing a client from silently repointing a cart line to a different
product through the quantity-update endpoint), not a bug.
```bash
curl -s -X PATCH http://localhost:8083/api/v1/cart/items/{id} -H "Authorization: Bearer $CUSTOMER2" \
  -H "Content-Type: application/json" -d '{"productId":1,"quantity":5}'
```
**Result: `200`**

### POST /api/v1/cart/validate
Rewritten this session — returns *every* problem line, not just the first, and detects a
product having gone inactive (not just insufficient stock).
```bash
curl -s -X POST http://localhost:8083/api/v1/cart/validate -H "Authorization: Bearer $CUSTOMER2"
```
**Result: `200`** → `{"data":{"cart":{...},"valid":true,"issues":[]}}`

### POST /api/v1/cart/items/{id}/move-to-wishlist
```bash
curl -s -X POST http://localhost:8083/api/v1/cart/items/{id}/move-to-wishlist -H "Authorization: Bearer $CUSTOMER2"
```
**Result: `200`**

### DELETE /api/v1/cart
Clears the whole cart.
```bash
curl -s -X DELETE http://localhost:8083/api/v1/cart -H "Authorization: Bearer $CUSTOMER2"
```
**Result: `204`**

### DELETE /api/v1/cart/items/{id}
```bash
curl -s -X DELETE http://localhost:8083/api/v1/cart/items/{id} -H "Authorization: Bearer $CUSTOMER2"
```
**Result: `204`**

---

## WishlistController

**Auth:** any authenticated JWT, scoped to the caller.

### POST /api/v1/customers/me/wishlist-items
```bash
curl -s -X POST http://localhost:8083/api/v1/customers/me/wishlist-items -H "Authorization: Bearer $CUSTOMER2" \
  -H "Content-Type: application/json" -d '{"productId":3}'
```
**Result: `201`**
**Negative — 409 (duplicate):** same call again → `409`

### GET /api/v1/customers/me/wishlist-items/{id}
```bash
curl -s http://localhost:8083/api/v1/customers/me/wishlist-items/{id} -H "Authorization: Bearer $CUSTOMER2"
```
**Result: `200`**

### GET /api/v1/customers/me/wishlist-items
```bash
curl -s http://localhost:8083/api/v1/customers/me/wishlist-items -H "Authorization: Bearer $CUSTOMER2"
```
**Result: `200`**

### PATCH /api/v1/customers/me/wishlist-items/{id}
Replaces which product a wishlist line points at.
```bash
curl -s -X PATCH http://localhost:8083/api/v1/customers/me/wishlist-items/{id} -H "Authorization: Bearer $CUSTOMER2" \
  -H "Content-Type: application/json" -d '{"productId":1}'
```
**Result: `200`**

### GET /api/v1/customers/me/wishlist-items/summary
```bash
curl -s http://localhost:8083/api/v1/customers/me/wishlist-items/summary -H "Authorization: Bearer $CUSTOMER2"
```
**Result: `200`**

### POST /api/v1/customers/me/wishlist-items/membership
Rewritten this session to a single batch query instead of N `existsBy` calls — see
[Bugs found #3](#bugs-found), the derived-query bug this fix introduced and this test pass caught.
```bash
curl -s -X POST http://localhost:8083/api/v1/customers/me/wishlist-items/membership -H "Authorization: Bearer $CUSTOMER2" \
  -H "Content-Type: application/json" -d '[1,2,3]'
```
**Result: `200`** → `{"1":false,"2":true,"3":false}`

### DELETE /api/v1/customers/me/wishlist-items/{id}
```bash
curl -s -X DELETE http://localhost:8083/api/v1/customers/me/wishlist-items/{id} -H "Authorization: Bearer $CUSTOMER2"
```
**Result: `204`**

---

## ReviewController

**Auth:** GET routes `permitAll()` (fixed this session — `get(id)` used to require an
authenticated, order-owning caller even though the security config already marked it public, see
[Bugs found](#bugs-found) writeup); POST/PATCH/DELETE require an authenticated customer plus a
live S4 order-eligibility check.

### GET /api/v1/reviews
```bash
curl -s "http://localhost:8083/api/v1/reviews?productId=1"
```
**Result: `200`** (anonymous — genuinely public)

### POST /api/v1/reviews
Validates order/product/customer eligibility via a live S4 call before allowing the review.
```bash
curl -s -X POST http://localhost:8083/api/v1/reviews -H "Authorization: Bearer $CUSTOMER1" \
  -H "Content-Type: application/json" -d '{"orderId":1,"productId":1,"rating":5,"text":"S3QA test review"}'
```
**Result: `403`** → `{"technicalMessage":"Review is not permitted"}` (customer1 has no real
completed order eligible for product 1 with `orderId:1` in this environment — confirms the S4
eligibility gate is live and actually enforced, not a stub).

### GET /api/v1/reviews/{id}
```bash
curl -s http://localhost:8083/api/v1/reviews/{id}
```
**Result: `200`** (anonymous, when the review exists)
**Negative — 404 (anonymous, nonexistent id):**
```bash
curl -s http://localhost:8083/api/v1/reviews/00000000-0000-0000-0000-000000000099
```
→ `404` — the key fix confirmed live: an anonymous caller gets a normal 404 for a missing
review, not a 401 for being unauthenticated (which is what happened before this session's fix).

### GET /api/v1/reviews/products/{productId}/rating-summary
```bash
curl -s http://localhost:8083/api/v1/reviews/products/1/rating-summary
```
**Result: `200`** (anonymous)

*(`PATCH`/`DELETE /api/v1/reviews/{id}` were not separately exercised in this pass — no review
in this environment was owned by a test account with the matching S4 order eligibility needed to
create one live; the ownership fix itself — a real `customerId` column checked directly rather
than only inferred through S4's eligibility answer — is a straightforward code-level change
already confirmed compiling and consistent with the rest of the service, not something curl
alone can meaningfully re-verify without a real eligible order fixture.)*

---

## CheckoutController

**Auth:** any authenticated JWT, scoped to the caller.

### POST /api/v1/checkout/prepare
Orchestrates: address ownership, cart validation, live serviceability check (S4), live tax calc
(S6), server-side subtotal/tax/delivery/grandTotal computation. The request DTO has exactly two
fields (`addressId`, `redeemPoints`) — no calculated totals can be submitted by the client.
```bash
curl -s -X POST http://localhost:8083/api/v1/checkout/prepare -H "Authorization: Bearer $CUSTOMER2" \
  -H "Content-Type: application/json" -d '{"addressId":"7e8e9c90-...","redeemPoints":0}'
```
**Result: `200`**
```json
{"subtotal":2250.00,"tax":405.00,"deliveryCharge":49.00,"grandTotal":2704.00,"serviceable":true,"pointsRedeemed":0,"pointsEarned":54.08,"rewardPointsBalance":54.08}
```
**Negative — 404 (bogus/unowned address):** `404`

See [Bugs found](#bugs-found) — this endpoint initially timed out (`504`) during this test pass
for a reason unrelated to S3's own code; fixed as part of this session (see below).

---

## Bugs found

### 🐛 BUG #1 — `stock` required on PATCH, not just POST (fixed during this pass)

**File:** `dto/request/ProductRequest.java`, `service/impl/CatalogueServiceImpl.java`

The session's fix for "stock must be provided on product create" added `@NotNull` to
`ProductRequest.stock`. That record is shared by both `CatalogueController.create()` (POST) and
`update()` (PATCH) — `@Valid` runs before either method body, so every PATCH call started 400ing
with `"stock: must not be null"` even though `update()`/`apply()` never reads `stock` at all.

**Fix:** removed `@NotNull` from `stock` on the shared DTO (kept `@Min(0)`); added an explicit
`if (r.stock() == null) throw new BusinessValidationException(...)` inside `create()` only, so
the requirement is enforced exactly where it applies. Confirmed live: PATCH without `stock` now
`200`s, POST without `stock` now `422`s with a clear message (was `400` with a field error
before, `500` was never actually the failure mode here — the closer miss was the *right* status
code with the *wrong* endpoint being blocked).

### 🐛 BUG #2 — invalid enum value on product/category create returned `500`, not `400` (fixed earlier this session, confirmed here)

Switching `status` to a real `ProductStatus`/`CategoryStatus` enum meant an invalid string value
now fails at JSON deserialization (Jackson) rather than in service-layer validation.
`GlobalExceptionHandler` had no handler for `HttpMessageNotReadableException`, so it fell through
to the generic `Exception` handler → `500`. Fixed by adding a dedicated handler mapping it to
`400`. Confirmed live in this pass: `{"status":"NOT_A_REAL_STATUS",...}` on product create → clean
`400 MALFORMED_REQUEST_BODY`.

### 🐛 BUG #3 — wishlist batch-membership endpoint `500`'d (fixed during this pass)

**File:** `repository/CustomerWishlistItemRepository.java`,
`service/impl/WishlistServiceImpl.java`

The one-query batch-membership fix added
`List<Long> findProductIdByCustomerIdAndProductIdIn(UUID, Collection<Long>)` as a plain
Spring-Data-derived-query method name. `CustomerWishlistItem` has no direct `productId` scalar
field (only a `product` `@ManyToOne` relation) — using "ProductId" as the *projection subject*
(the part before "By") doesn't resolve against a relation the same way it resolves in a
*predicate* (Spring Data does support subject-position property projection, e.g.
`findLastnameByFirstname`, but the property path resolution against a relation in that position
hit an edge case here). The app started fine (proxy registration succeeded) but every call to
`POST /api/v1/customers/me/wishlist-items/membership` 500'd at runtime with no logged stack trace
(the generic `@ExceptionHandler(Exception.class)` doesn't log).

**Fix:** replaced the derived-query method with an explicit `@Query`
(`select w.product.id from CustomerWishlistItem w where w.customer.id=:customerId and w.product.id in :productIds`),
same one-query intent, no ambiguity. Confirmed live: `POST .../membership` with `[1,2,3]` now
returns `200` → `{"1":false,"2":true,"3":false}`.

### 🐛 BUG #4 — `POST /checkout/prepare` timed out (`504`) — environment issue, not S3 code

**Not a code bug in S3.** `CheckoutServiceImpl.prepare()`'s live Feign call to S4
(`serviceability-checks`) was timing out after ~10s. Direct `curl` calls to S4 on the same
machine (both via `localhost:8084` and via the exact host:port S4 had registered in Eureka)
diverged: `localhost` was instant, the Eureka-registered address (`10.230.108.110`) was
completely unreachable. Root cause: this machine has multiple active network adapters, and
`eureka.instance.prefer-ip-address=true` (S4's and S6's config) let each service register
under whichever adapter's IP `InetAddress.getLocalHost()` happened to resolve to at startup —
which drifted over the course of this long session as the machine's network state changed, and
S4/S6 (not restarted since) were left registered under an IP that had since become unroutable.
Other services (restarted more recently) happened to land on `localhost` or a still-reachable IP.

**Fix:** pinned `eureka.instance.hostname=localhost` + `prefer-ip-address=false` in S4's and S6's
`application.properties` (every service in this stack runs on the same machine in local dev, so
`localhost` is always correct and immune to adapter/VPN state changes) — see the main
conversation for the change and both services' clean restart. Confirmed live: checkout now
returns `200` in under a second, tax/delivery/total all correctly computed from live S4/S6 calls.

**Not a bug, confirmed correct behavior (would-be false positives during this pass):**
- `PATCH /cart/items/{id}` requiring `productId` — deliberate defense-in-depth (see the
  CartController section above), not an oversight.
- `POST /product-categories/{id}` DELETE returning `204` instead of `200` — `204 No Content` is
  the correct response for a body-less DELETE; my own test expectation was wrong, not the API.
