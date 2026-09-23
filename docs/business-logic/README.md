# Business Logic Added for Code Review (12 endpoints, 6 services)

The reviewer's feedback was: **each service should have complex business logic in their
endpoints.** This folder documents the 12 endpoints (2 per service) where real, non-CRUD
business logic was added, so it can be walked through in the Monday review.

Each service has its own file with, per endpoint: the business scenario, a full
step-by-step logic walkthrough, exact file/line references, the live curl test that proved
it, and a "what to say to the reviewer" talking-point paragraph.

All 12 features were built AND then verified against a fully live stack (Eureka + all six
services + Gateway, running simultaneously) with real curl calls against seeded demo data —
not just unit tests. Every result quoted in these docs is copy-pasted from an actual response,
not predicted.

## Index

| # | Service | Endpoint | What it does | Doc |
|---|---|---|---|---|
| 1 | S1 Platform & Territory | `POST /api/v1/auth/login` | Blocks login if the password is >90 days old | [S1-platform-territory.md](S1-platform-territory.md#1-password-age-policy-at-login) |
| 2 | S1 Platform & Territory | `PATCH /api/v1/location-managers/{id}/deactivate` | Cross-service check (Feign → S2) blocking deactivation while reviews are still assigned | [S1-platform-territory.md](S1-platform-territory.md#2-cross-service-deactivation-guard) |
| 3 | S2 Partner Verification | `PATCH /api/verification-queues/{id}/assign` | Workload-capped, guarded reviewer assignment | [S2-partner-verification.md](S2-partner-verification.md#1-workload-capped-guarded-reviewer-assignment) |
| 4 | S2 Partner Verification | `POST /api/verification-queues/{id}/process-result` | Auto-suspends a repeat offender after 3 rejections | [S2-partner-verification.md](S2-partner-verification.md#2-repeat-offender-auto-suspension) |
| 5 | S3 Commerce & Customer | `POST /api/v1/checkout/prepare` | Reward-points earn (2%) and redemption (capped) | [S3-commerce-customer.md](S3-commerce-customer.md#1-reward-points-earn--redeem-at-checkout) |
| 6 | S3 Commerce & Customer | `POST/PATCH/DELETE /api/v1/reviews/**` | Review-driven product quality flag (`TRENDING`/`LOW_RATED`) | [S3-commerce-customer.md](S3-commerce-customer.md#2-review-triggered-product-quality-flag) |
| 7 | S4 Order & Logistics | `PUT /api/orders/{id}` | Real order-status state machine + tiered cancellation fee | [S4-order-logistics.md](S4-order-logistics.md#1-order-status-state-machine--cancellation-fee) |
| 8 | S4 Order & Logistics | `GET /api/orders/{id}/tracking` | Delivery SLA detection (`ON_TIME`/`LATE`/`AT_RISK`/...) | [S4-order-logistics.md](S4-order-logistics.md#2-delivery-sla-detection) |
| 9 | S5 Fleet Operations | `POST /api/assignments` | Cargo-capacity / vehicle-type matching | [S5-fleet-operations.md](S5-fleet-operations.md#1-cargo-capacity--vehicle-type-matching) |
| 10 | S5 Fleet Operations | `GET /api/assignments/reliability` | Churn/reliability analytics from assignment history | [S5-fleet-operations.md](S5-fleet-operations.md#2-assignment-reliabilitychurn-analytics) |
| 11 | S6 Finance & Support | `GET /api/analytics/overview` | Real derived metrics (refund rate, settlement fee ratio, avg resolution time) | [S6-finance-support.md](S6-finance-support.md#1-real-derived-analytics-metrics) |
| 12 | S6 Finance & Support | `POST /api/support-tickets/escalate-overdue` | Priority-tiered SLA escalation sweep | [S6-finance-support.md](S6-finance-support.md#2-priority-tiered-sla-escalation) |

## How to use this for the review

1. **Lead with the gap, not the feature.** Every section below starts with what the endpoint
   used to do (usually: blindly copy a DTO onto an entity with no validation) before the fix.
   That framing is what makes it read as "closing a real gap" rather than "added a feature for
   the sake of it."
2. **Have the live test results ready.** Each doc quotes the exact curl request/response that
   proved the logic fires correctly — including the *rejection* cases (409/422/400), which are
   usually more convincing to a reviewer than the happy path.
3. **All 12 endpoints are now proven live**, including the three that initially weren't:
   - S1's 90-day password lock and S6's SLA escalation both depend on elapsed wall-clock time
     from a timestamp only ever set to "now" through the API. The fix: switched the whole stack
     to run against a real local PostgreSQL instance (`scriptsstart-all.cmd /postgres`) instead
     of in-memory H2 (whose web console 404'd on this build), then used `psql` to directly
     backdate the relevant timestamp columns and re-ran the calls. Both now have real
     request/response proof of the "already expired"/"already overdue" branches, not just unit
     tests.
   - S3's product-quality-flag needed 5 delivered orders + reviews to clear its eligibility gate,
     which was built for real against the Postgres-backed stack. This run also caught and fixed a
     genuine bug: the flag was computed and saved correctly the whole time, but the product
     response DTO never exposed it — the API was silently hiding a working feature. Fixed and
     reconfirmed live.
4. **Cross-service pair (S1 ↔ S2).** Endpoints #2 and (indirectly) #3/#4 are a matched pair —
   S1's deactivation guard is a live Feign call into a brand-new internal endpoint on S2. This is
   the best one to demo end-to-end since it's real distributed-systems logic (a service calling
   another service to make a decision), not just in-process validation.
5. **The stack currently runs against PostgreSQL, not H2** — a deliberate switch made to unlock
   direct database access for the backdating above. Data now persists across restarts (unlike
   H2), so seed data + everything created during these test runs (extra orders, reviews,
   verification queues, support tickets) is still sitting in the six `lbos_*` databases. Worth
   knowing before the review if a clean slate is wanted — see §4a of
   `docs/running-the-project.md` for how to reset it.
