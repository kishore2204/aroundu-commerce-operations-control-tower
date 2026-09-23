# Seed Data Contract

The development dataset is documented in full in [`seed-data/`](../seed-data/README.md) - start with
[`seed-data/README.md`](../seed-data/README.md), [`seed-data/credentials.md`](../seed-data/credentials.md) and
[`seed-data/RELATIONSHIP_MAP.md`](../seed-data/RELATIONSHIP_MAP.md). This file only states the contract the six
`DataSeeder` classes follow. (The API test logs under `docs/api-reference/` were recorded against the previous, now
removed, demo dataset - their emails and fixed ids no longer exist.)

## How the six seeders cooperate

* All six services run against **one** database, and every cross-service reference is a plain scalar id (no foreign
  key). Each service owns its own `DataSeeder` (an idempotent `ApplicationRunner`, `@Order(1)`).
* **No id is invented or shared.** Every id is what the application would generate: random UUIDs (JPA
  `GenerationType.UUID`) or database identity values (`Long` products, categories, orders, order items,
  notifications). A seeder finds the rows of the services it depends on by their **business key** - account email,
  state / city / zone name, business name, retailer + SKU, category name, vehicle registration number, order
  number - waiting (up to 7 minutes) until the other service has written them, so the six services can be started in
  any order.
* Every service except S1 seeds on a background daemon thread (so it starts, and its tests load, without waiting for the
  others; a failure is logged, not fatal). `app.seed.enabled=false` switches that seeder off. Rows that depend on an
  order (S3 reviews and reward points, S2 driver / vehicle verification, S6 payments, settlements, invoices, tickets ...)
  are written later in the same thread once the orders exist.
* Everything is idempotent on natural keys, so restarting a service never duplicates data.
* Passwords are stored by the application's own delegating encoder (BCrypt), never as plaintext.
* Timestamps are relative to the fixed moment of the dataset (2026-09-20 18:00 IST); nothing is in the future.
* Rows are written with `JdbcTemplate` (the seed backdates created / updated timestamps, which the entities'
  lifecycle callbacks would overwrite) except S4's orders, order items and logistics bookings, which use the
  repositories (JSON columns).

| Service | Seeds | Depends on (by business key) |
|---|---|---|
| S1 | states, cities, the 4 zones, 34 accounts, operations and location managers, one transfer history row | - |
| S2 | retailers, fleet owners, verification queues and documents | S1 |
| S5 | drivers, vehicles, assignments, expenses | S1, S2 |
| S3 | customers, addresses, categories, products, carts, wishlists; later reviews and reward points | S1, S2, S4 (phase 2) |
| S4 | orders, items, trips, trip history, logistics bookings | S1, S2, S3, S5, S6 (tax) |
| S6 | tax configuration; later payments, settlements, invoices, refunds, tickets, notifications, audit log | S1, S3, S4 |

## Critical shared bug found in S1 — check every other service's SecurityConfig too

Live-tested (not just unit tests — `@WithMockUser`-based MockMvc tests do NOT catch
this): an authenticated request with the WRONG role was returning **401 instead of
403**. Root cause, confirmed via `logging.level.org.springframework.security=DEBUG`:

1. `AccessDeniedHandlerImpl` correctly logs "Responding with 403 status code" and calls
   `response.sendError(403)`.
2. `sendError()` triggers the servlet container's error-page dispatch to `GET /error`
   (Spring Boot's `BasicErrorController`) — an internal forward, not a new HTTP request,
   so it carries no `Authorization` header.
3. That `/error` forward re-enters the SAME Spring Security filter chain. Since `/error`
   wasn't in the `permitAll()` list, it hits `anyRequest().authenticated()`, fails
   authentication (no token on the forward), and the `authenticationEntryPoint` sends
   **401** — overwriting the original 403 before it reaches the client.

**Fix**: add `"/error"` to the `permitAll()` matcher list in every service's
`SecurityConfig` (alongside swagger/actuator-health). Also confirm each service's
`exceptionHandling()` sets both `.authenticationEntryPoint(...)` (401) AND
`.accessDeniedHandler(new AccessDeniedHandlerImpl())` (403) explicitly — some services
may only set the entry point, same as S1 did before this fix. Verify LIVE (curl with a
real JWT of the wrong role against a role-restricted endpoint), not just via
`@WithMockUser` tests — those don't exercise the real error-dispatch path.
