# Data Validation

Results of `seed-data/VALIDATE_SEED_DATA.sql` (portable SQL, part 1 = counts, part 2 = 87 integrity and business-rule checks that must each return **0 violations**, part 3 = money overview) run against the database after **all six services had started and seeded it from an empty database**.

## How this was verified - and what was not

* **Executed:** all six services (S1-S6) compiled and started together, each running its own `DataSeeder`, against one shared database created by their own Hibernate `ddl-auto` schema; the seed then waited for its cross-service dependencies exactly as designed (start order irrelevant). The validation script and the document generator were run on that result, and the run was repeated to prove **idempotency** (a second start of all six services added nothing and changed no count).
* **Databases used:** (1) an **H2 file database** standing in for PostgreSQL while the project's remote PostgreSQL server was unreachable; (2) afterwards a **local PostgreSQL 18** server (empty database created with `scripts/create-local-database.cmd`, services started with `DB_URL` pointing at it). Both runs gave the identical 136 result lines below. The H2 run needed two harness-only workarounds (H2's dialect sizes `bytea` at 255 bytes, so two `ALTER`s and `ddl-auto=none`); the PostgreSQL run needed none - the services created all 39 tables themselves and seeded on the first start.
* **Also executed on PostgreSQL 18:** a clean first start (39 tables, all seed log lines, 0 violations), a full restart (nothing added, identical result - idempotent), and `RESET_DEVELOPMENT_DB.sql` followed by a reseed from the emptied database (identical result again). **Unit tests** were run for S1 (172), S3 (119) and S4 (149): all pass. The `@SpringBootTest` / repository tests of S2, S5 and S6 connect to the remote PostgreSQL configured as the default `DB_URL`, which was unreachable from the build machine (connection timeout, as before this work), so they were not verified here.
* **How to repeat on PostgreSQL:** start the six services against an empty database (or reset with `RESET_DEVELOPMENT_DB.sql`), wait for the `S? seed:` log lines, then run `psql -f seed-data/VALIDATE_SEED_DATA.sql`; every row of part 2 must show `0`.

## 1. Record counts

| Item | Count |
|---|---:|
| audit_log | 34 |
| city | 3 |
| customer_address | 14 |
| customer_cart (lines) | 12 |
| customer_cart_item | 12 |
| customer_invoice | 15 |
| customer_profile | 7 |
| customer_refund | 4 |
| customer_review | 22 |
| customer_wishlist_item | 15 |
| driver | 9 |
| fleet_expense | 12 |
| fleet_owner | 3 |
| location_manager | 4 |
| location_manager_assignment_history | 1 |
| logistics_booking_detail | 2 |
| notifications | 134 |
| operations_manager | 3 |
| order_item | 49 |
| orders | 23 |
| payment_transaction | 23 |
| product_categories | 9 |
| products | 30 |
| retailer | 5 |
| settlement | 47 |
| state | 3 |
| support_ticket | 11 |
| support_ticket_message | 27 |
| tax_configuration | 25 |
| tax_configuration (active) | 24 |
| ticket_cluster_incident | 1 |
| trip | 18 |
| trip_status_history | 51 |
| user_account | 34 |
| vehicle | 12 |
| vehicle (two-wheeler BIKE) | 3 |
| vehicle_assignment | 12 |
| verification_document | 48 |
| verification_queue | 29 |
| zone | 4 |
| DELIVERED / IN_TRANSIT / VEHICLE_ASSIGNED retail orders have exactly one trip | 0 |

Summary of what was asked for: 34 accounts (3 Operations Managers, 4 Location Managers, 5 retailers, 3 fleet owners, 9 drivers, 7 customers, 1 admin, 2 support), 12 vehicles of which 3 are two-wheelers (one per fleet), 14 addresses (2 per customer), 30 products in 8 active categories, 23 orders (49 items), 18 trips, 24 active tax rules.

## 2. Integrity and business rules (violations)

| Check | Violations | Result |
|---|---:|---|
| FLEET_SERVICE order has a logistics booking with a vehicle | 0 | pass |
| PAID order has a SUCCESS payment | 0 | pass |
| RETAIL order has items of ONE retailer (one order per retailer) | 0 | pass |
| RETAILER settlement -> retailer, FLEET_OWNER settlement -> fleet owner | 0 | pass |
| a multi-retailer checkout exists (same customer + moment, 2 orders) | 0 | pass |
| a single-retailer and a multi-retailer cart exist | 0 | pass |
| address postal code is 6 digits | 0 | pass |
| address zone belongs to its city | 0 | pass |
| all four zones are used by customer addresses | 0 | pass |
| approved queue has all required current documents approved | 0 | pass |
| assignment cargo fits the vehicle | 0 | pass |
| assignment: driver and vehicle belong to the same fleet owner | 0 | pass |
| at most one ACTIVE assignment per driver | 0 | pass |
| at most one ACTIVE assignment per vehicle | 0 | pass |
| at most one SUCCESS payment per order | 0 | pass |
| audit log -> user account | 0 | pass |
| cart line -> customer + product + retailer of the product | 0 | pass |
| cluster incident: tickets exist, same category / zone | 0 | pass |
| customer -> account (CUSTOMER) | 0 | pass |
| delivery address of an order is one of the customer's addresses | 0 | pass |
| driver -> account (DRIVER) + fleet owner | 0 | pass |
| escrow RELEASED exactly for DELIVERED orders | 0 | pass |
| every ACTIVE category has an active tax rule in every state | 0 | pass |
| every category is used by a product (ACTIVE ones) | 0 | pass |
| every city has a state | 0 | pass |
| every customer has exactly 1 default address | 0 | pass |
| every customer has exactly 2 addresses | 0 | pass |
| every delivered retail order has an invoice | 0 | pass |
| every fleet owner has 3 four-wheelers and a two-wheeler | 0 | pass |
| every fleet owner has exactly 3 drivers | 0 | pass |
| every retailer / fleet owner / driver / vehicle has an APPROVED verification queue | 0 | pass |
| every zone has a city | 0 | pass |
| exactly 4 zones | 0 | pass |
| expense -> fleet owner + vehicle of that fleet | 0 | pass |
| expense amount within 0 < x <= 10000 | 0 | pass |
| expense approver is not its creator | 0 | pass |
| fleet owner -> account, city, zone in that city | 0 | pass |
| invoice -> delivered retail order; total = subtotal + tax | 0 | pass |
| location manager -> account + zone + operations manager of the same city | 0 | pass |
| no legacy seed accounts (@aroundu.local) remain | 0 | pass |
| no two accounts share an email or phone | 0 | pass |
| no two active tax rules for the same category + state | 0 | pass |
| nothing dated after the dataset moment (2026-09-20 18:00 IST) | 0 | pass |
| notification -> user account | 0 | pass |
| operations manager -> account + city | 0 | pass |
| order -> customer | 0 | pass |
| order item -> product of the same retailer | 0 | pass |
| order item line total = quantity x unit price | 0 | pass |
| order status matches its trip status | 0 | pass |
| order statuses are valid | 0 | pass |
| order subtotal = sum of line totals (RETAIL) | 0 | pass |
| order tax = per-line tax of the category in the delivery state (RETAIL) | 0 | pass |
| order total = subtotal + delivery + tax + platform fee - discount | 0 | pass |
| password is BCrypt (delegating encoder) | 0 | pass |
| payment -> order, amount = order total (SUCCESS) | 0 | pass |
| payment reference = order transaction reference (SUCCESS) | 0 | pass |
| phone numbers are exactly 10 digits | 0 | pass |
| platform fee = 2% of the subtotal (RETAIL) | 0 | pass |
| product -> category (no orphan) | 0 | pass |
| product -> retailer (no orphan) | 0 | pass |
| product SKU pattern [A-Za-z0-9_-]{3,20} | 0 | pass |
| product description 10..300 characters | 0 | pass |
| product only in an ACTIVE category, or unchanged | 0 | pass |
| product stock >= 0 | 0 | pass |
| refund -> ticket + payment + order item; amount <= item line total | 0 | pass |
| resolved / closed ticket has resolved_at; open one does not | 0 | pass |
| retailer -> account, city, zone in that city | 0 | pass |
| retailer GSTIN is 15 characters | 0 | pass |
| review -> delivered order of that customer containing the product | 0 | pass |
| review rating 1..5 | 0 | pass |
| settlement -> payment; net = gross - fee | 0 | pass |
| settlements of an order add up to its total + discount | 0 | pass |
| stock = opening stock minus ordered quantity (non-cancelled orders): no negative stock | 0 | pass |
| tax rule -> category + state | 0 | pass |
| the 2 addresses of a customer are in different zones | 0 | pass |
| ticket -> raiser account; customer ticket -> customer + own order | 0 | pass |
| ticket message -> ticket, sent after the ticket was raised | 0 | pass |
| trip completed after it started, started after it was planned | 0 | pass |
| trip status history: PLANNED -> IN_PROGRESS -> COMPLETED in time order | 0 | pass |
| trip: driver + vehicle + fleet owner belong together | 0 | pass |
| trip: driver is the ACTIVE / historical assignee of the vehicle | 0 | pass |
| trip: vehicle capacity >= order weight | 0 | pass |
| vehicle -> fleet owner | 0 | pass |
| verification document has file content and size | 0 | pass |
| verification queue -> subject exists | 0 | pass |
| wishlist -> customer + product | 0 | pass |
| zone names are North/South/East/West | 0 | pass |

**87 of 87 checks pass; 0 fail.**

The checks cover, among others: no orphan product / category / address / order item / trip / payment / invoice / review / tax rule; every customer has exactly 2 addresses in 2 different zones with exactly 1 default; every fleet owner has 3 drivers, 3 four-wheelers and a two-wheeler; every product belongs to a category and every ACTIVE category has an active tax rule in every state; every order's tax equals the per-line tax of the product categories in the delivery state; totals, platform fees, invoices, payments and settlements add up; every review references a delivered order containing the product; trips, drivers, vehicles and fleets are consistent and capacity-safe; multi-retailer checkouts are split into one order per retailer; nothing is dated after the dataset moment; no legacy seed account remains.

## 3. Money overview (orders by type and status)

| Type | Status | Orders | Subtotal | Tax | Delivery | Platform fee | Discount | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| FLEET_SERVICE | BOOKING_CONFIRMED | 1 | 0.00 | 0.00 | 184.00 | 0.00 | 0.00 | 184.00 |
| FLEET_SERVICE | DELIVERED | 1 | 0.00 | 0.00 | 75.00 | 0.00 | 0.00 | 75.00 |
| RETAIL | CANCELLED | 1 | 360.00 | 0.00 | 49.00 | 7.20 | 0.00 | 416.20 |
| RETAIL | DELIVERED | 15 | 8156.00 | 816.62 | 735.00 | 163.12 | 40.00 | 9830.74 |
| RETAIL | FINDING_DELIVERY_PARTNER | 2 | 722.00 | 85.54 | 98.00 | 14.44 | 0.00 | 919.98 |
| RETAIL | IN_TRANSIT | 1 | 189.00 | 22.32 | 49.00 | 3.78 | 0.00 | 264.10 |
| RETAIL | RETAILER_REJECTED | 1 | 268.00 | 13.40 | 49.00 | 5.36 | 0.00 | 335.76 |
| RETAIL | VEHICLE_ASSIGNED | 1 | 311.00 | 15.55 | 49.00 | 6.22 | 0.00 | 381.77 |

## 4. Business-rule coverage matrix

| Requirement | Evidence |
|---|---|
| Exactly four zones North / South / East / West | check "exactly 4 zones", "zone names are North/South/East/West" |
| Every customer has exactly 2 addresses in different zones | checks on customer addresses (3 checks) |
| Every fleet has a two-wheeler | "every fleet owner has 3 four-wheelers and a two-wheeler" |
| Every driver / vehicle belongs to a fleet | "driver -> account + fleet owner", "vehicle -> fleet owner" |
| Every product has a category and a valid tax mapping | "product -> category", "every ACTIVE category has an active tax rule in every state", "order tax = per-line tax ..." |
| Every review references an actual purchase | "review -> delivered order of that customer containing the product" |
| Multi-retailer cart and multi-retailer checkout | "a single-retailer and a multi-retailer cart exist", "a multi-retailer checkout exists", "RETAIL order has items of ONE retailer" |
| Passwords hashed like the application | "password is BCrypt (delegating encoder)" |
| No stale old seed data | "no legacy seed accounts (@aroundu.local) remain" |
