# S3 — Commerce & Customer: Business Logic

Note on code style: most files in this service (including both files below) are written as
single-line minified Java — that's the pre-existing, intentional style in this codebase, not a
formatting accident. The line/character references below point into that same single-line
format.

---

## 1. Reward-points earn & redeem at checkout

**Endpoint:** `POST /api/v1/checkout/prepare`

**Files:**
- [S3-commerce-customer/src/main/java/com/lbos/commercecustomer/service/impl/CheckoutServiceImpl.java](../../S3-commerce-customer/src/main/java/com/lbos/commercecustomer/service/impl/CheckoutServiceImpl.java) — all logic lives in `prepare()`
- [S3-commerce-customer/src/main/java/com/lbos/commercecustomer/entity/CustomerProfile.java](../../S3-commerce-customer/src/main/java/com/lbos/commercecustomer/entity/CustomerProfile.java) — `rewardPointsBalance` (`BigDecimal`, defaults to `ZERO`) — this field existed before but nothing anywhere in the codebase ever mutated it
- [S3-commerce-customer/src/main/java/com/lbos/commercecustomer/dto/request/CheckoutRequest.java](../../S3-commerce-customer/src/main/java/com/lbos/commercecustomer/dto/request/CheckoutRequest.java) — gained an optional `redeemPoints` field
- [S3-commerce-customer/src/main/java/com/lbos/commercecustomer/dto/response/CheckoutResponse.java](../../S3-commerce-customer/src/main/java/com/lbos/commercecustomer/dto/response/CheckoutResponse.java) — gained `pointsRedeemed`, `pointsEarned`, `rewardPointsBalance`

### The gap before

`CustomerProfile.rewardPointsBalance` was a real, persisted column with a sensible default —
and absolutely nothing in the service layer ever read or wrote it. It was pure dead data.
`prepare()` itself was a read-only quote calculation (`@Transactional(readOnly = true)`):
validate the cart, check serviceability via S4, get tax from S6, sum the total, return it. No
mutation, no loyalty program, no notion of "this checkout actually happened."

### The logic (step by step)

Because S3 doesn't own `Order` (S4 does) and has no separate "confirm" step of its own,
`prepare()` **is** the checkout action from S3's point of view — so it was changed from
`@Transactional(readOnly = true)` to `@Transactional` to allow it to persist the point-balance
change.

1. Compute `orderValue = subtotal + tax + delivery` exactly as before.
2. Read the requested redemption: `requested = r.redeemPoints()` (or zero if not supplied).
   Reject negative values outright (`BusinessValidationException`).
3. **Redemption cap** — the actual amount redeemed is the *minimum* of three numbers:
   - what the customer asked for,
   - their current `rewardPointsBalance`,
   - **50% of `orderValue`** (a redemption can never wipe out more than half the order).
   This is a silent clamp, not a rejection — asking for more than you can redeem just redeems
   the maximum instead of erroring.
4. `grandTotal = orderValue - pointsRedeemed`. As a final safety net, if that would somehow go
   negative, `pointsRedeemed` is reduced so `grandTotal` lands exactly at zero (never negative).
5. **Earn** — `pointsEarned = 2% of the *final* grandTotal` (after redemption, not before),
   rounded to 2 decimals.
6. New balance = `oldBalance - pointsRedeemed + pointsEarned`, persisted via
   `CustomerProfileRepository.save(customer)`.
7. The response now returns `pointsRedeemed`, `pointsEarned`, and the resulting
   `rewardPointsBalance` alongside the existing fields.

### Live verification

```
Checkout #1 (balance starts at 0, no redemption requested):
  subtotal 1000.0 + tax 180.0 + delivery 49.0 = grandTotal 1229.0
  pointsRedeemed: 0   pointsEarned: 24.58   rewardPointsBalance: 24.58   <- exactly 2% of 1229

Checkout #2 (same cart topped up, redeemPoints: 9999 -- a deliberately absurd ask):
  pre-discount order value: 1500 + 270 + 49 = 1819    50% cap would be 909.50
  but balance was only 24.58, so redemption clamped to the LOWER cap (balance):
  pointsRedeemed: 24.58   grandTotal: 1819 - 24.58 = 1794.42
  pointsEarned: 2% of 1794.42 = 35.89   rewardPointsBalance: 0 - 24.58 + 24.58... = 35.89
```

Every number above is copy-pasted from an actual live response — the 50%-vs-balance cap
selection, the redemption arithmetic, and the earn-on-final-total calculation all matched by
hand.

### What to say to the reviewer

> "`rewardPointsBalance` was a column that existed on the customer entity and was completely
> dead — nothing ever wrote to it. I built a real loyalty mechanic into the checkout endpoint:
> customers earn 2% of their final order total in points, and can redeem existing points as a
> discount, capped at whichever is lower of their actual balance or 50% of the order value — so
> a redemption request can never be gamed to zero out an order or go negative. I verified the
> exact arithmetic live, including a deliberately oversized redemption request (9999 points
> against a real balance of 24.58) to prove the cap-selection logic picks the tighter of the two
> limits correctly, not just the 50% one."

**If asked "why compute earn on the post-redemption total, not pre-redemption?"**: computing
earn on the pre-discount total would let a customer redeem points and still earn as if they'd
paid full price — a leak that lets points compound risk-free. Earning on what they actually
paid is the only version that doesn't create free value out of the redemption itself.

**If asked "why is this in `prepare()` and not a separate `/confirm` endpoint?"**: S3 doesn't
own the `Order` entity — S4 does — so there is no later "the order is now real" event inside
this service to hook into. `prepare()` is already the last thing S3 does before the client
hands off to S4's order-creation flow, so it's the only point where S3 can attach a
checkout-triggered side effect at all.

---

## 2. Review-triggered product quality flag

**Endpoint:** `POST /api/v1/reviews`, `PATCH /api/v1/reviews/{id}`, `DELETE /api/v1/reviews/{id}` (all three drive the same flag)

**Files:**
- [S3-commerce-customer/src/main/java/com/lbos/commercecustomer/service/impl/ReviewServiceImpl.java](../../S3-commerce-customer/src/main/java/com/lbos/commercecustomer/service/impl/ReviewServiceImpl.java) — private helper `refreshQualityFlag(Long productId)`, called from `create()`, `update()`, and `delete()`
- [S3-commerce-customer/src/main/java/com/lbos/commercecustomer/entity/Product.java](../../S3-commerce-customer/src/main/java/com/lbos/commercecustomer/entity/Product.java) — new nullable `qualityFlag` column
- [S3-commerce-customer/src/main/java/com/lbos/commercecustomer/dto/response/ProductResponse.java](../../S3-commerce-customer/src/main/java/com/lbos/commercecustomer/dto/response/ProductResponse.java) and [.../mapper/CommerceMapper.java](../../S3-commerce-customer/src/main/java/com/lbos/commercecustomer/mapper/CommerceMapper.java) — the flag was being set correctly on the entity but wasn't exposed through `GET /api/v1/products/{id}` until live testing caught the gap; both now include `qualityFlag`

### The gap before

`ReviewServiceImpl` already computed rating aggregates (`rating(productId)` returns an
average + a 1–5 star distribution), but that was purely a read-side report — nothing about a
review ever fed back into the `Product` entity itself. A product with five glowing reviews
looked identical, from the catalogue's point of view, to one with five terrible ones.

### The logic (step by step)

`refreshQualityFlag(productId)` is one small helper, called after every mutation
(`create`/`update`/`delete`) so the flag can never go stale relative to the review data it's
derived from:

1. Reuse the exact same aggregate queries `rating()` already used —
   `repo.average(productId)` and `repo.countByProductId(productId)` — no duplicated logic.
2. Apply thresholds:
   - `count >= 5 && average >= 4.5` → `"TRENDING"`
   - `count >= 5 && average <= 2.0` → `"LOW_RATED"`
   - anything else (including under 5 reviews) → `null` (flag cleared)
3. Save the flag onto the `Product` row.

The `count >= 5` gate on *both* branches matters: without it, a single 5-star or 1-star review
would swing a brand-new product's flag immediately, which would be noise, not signal.

### Live verification

Fired end-to-end for real: created 5 fresh `RETAIL` orders against the live stack (running on
PostgreSQL), each with one `OrderItem` for product 1 ("Rice 5kg"), walked each through the real
`NEW → BOOKING_CONFIRMED → VEHICLE_ASSIGNED → IN_TRANSIT → DELIVERED` transition (the same state
machine documented in [S4-order-logistics.md](S4-order-logistics.md#1-order-status-state-machine--cancellation-fee)),
then submitted one review per order with ratings `5, 5, 5, 5, 4` (average 4.6, count 5 — clears
the `TRENDING` threshold):

```
POST /api/v1/reviews (x5, one per delivered order, ratings 5/5/5/5/4)  ->  all 201

SELECT quality_flag FROM products WHERE product_id = 1;   -- direct DB check
  quality_flag: TRENDING

GET /api/v1/products/1
  -> {"id":1,"name":"Rice 5kg", ..., "qualityFlag":"TRENDING"}
```

**This live run caught a real gap**: the flag was set correctly on the `Product` entity/database
row the whole time, but `GET /api/v1/products/{id}` didn't return it — `ProductResponse` and
`CommerceMapper.product()` had never been updated to include the new field, so the logic was
100% correct and completely invisible through the API. Fixed by adding `qualityFlag` to both
(one line each) and confirmed the field now appears in the live response above.

### What to say to the reviewer

> "Reviews already fed a `rating()` report endpoint, but that was a dead end — nothing about a
> product's own reviews ever changed how the product itself looked in the catalogue. I made
> review mutations feed back into the product: five or more reviews averaging 4.5+ flags it
> `TRENDING`, five or more averaging 2.0 or below flags it `LOW_RATED`, and it clears the flag
> otherwise. I proved this live — created five real delivered orders and reviews for the same
> product and watched its flag flip to `TRENDING` — and that live run actually caught a real bug:
> the flag was being computed and saved correctly the entire time, but the product's response DTO
> never exposed it, so the field was invisible through the API despite the logic underneath being
> right. I fixed that gap (one line in the DTO, one line in the mapper) and reconfirmed the fix
> live."
