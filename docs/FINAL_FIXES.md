# Final Targeted Fixes

This document records the changes applied to the uploaded repository for the final training/demo integration pass.

## Implemented

1. Customer self-registration at `POST /api/v1/auth/register/customer`.
2. Customer signup always creates `CUSTOMER`; the client cannot select a role.
3. S3 automatically provisions a `CustomerProfile` for a newly registered customer on first authenticated customer-context access.
4. S4 now implements `POST /api/v1/internal/delivery/serviceability-checks`.
5. Retail serviceability validates address scope and product existence/status/stock.
6. Retail demo delivery charge is INR 49 with a `30-60 minutes` estimate. This is a training rule because no retail fare table exists in the 34-entity model.
7. S5 -> S2 Feign now uses Eureka service name `lbos-partner`.
8. S6 identity boundary split:
   - `IdentityServiceClient` -> S1 UserAccount
   - `CustomerServiceClient` -> S3 CustomerProfile
9. S3 exposes an internal customer-profile lookup for S6.
10. Gateway now fails closed for unknown/unconfigured protected routes.
11. Gateway treats customer signup as public.
12. S1 separates internal Basic authentication from the end-user JWT filter chain, preventing a Basic Auth browser challenge on normal user APIs.
13. S1 Swagger now advertises Bearer JWT rather than Basic Auth.
14. Added `GET /api/analytics/overview` using aggregation over existing finance/support/audit data. No analytics entity was introduced.
15. Removed S2's redundant DAO/DAO-implementation layer after verifying it only delegated directly to Spring Data repositories. S2 now follows Controller -> Service -> Repository.
16. Updated relevant tests for the removed DAO layer and the new checkout/signup/client boundaries.
17. Added `docs/ECLIPSE_MANUAL_TESTING.md` with Eclipse startup, Swagger, signup, JWT, Gateway, Eureka/Feign and manual end-to-end test steps.
18. Updated `docs/running-the-project.md` and frontend guidance for signup and the new testing workflow.
19. Added local training credentials through a Flyway migration. These are development-only and must not be reused in production.

## Important verification limitation

This environment does not have Maven installed and could not download the Maven wrapper distribution from Maven Central. Therefore the final Maven build/test/JaCoCo execution could not be independently completed here.

The source tree was inspected and modified, but Eclipse/Maven must be used on the company laptop for the final compile and test run.
