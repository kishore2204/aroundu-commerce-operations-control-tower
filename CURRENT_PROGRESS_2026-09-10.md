# AroundU — Current Progress Snapshot

Date: 2026-09-10

This ZIP is an **intermediate work-in-progress snapshot** of the latest AroundU fixes requested in the current task. It is provided so the team can inspect and test what has been implemented so far. It is not being represented as the final fully runtime-validated release.

## Implemented so far

### Customer / Commerce
- Added backend-backed wishlist-to-cart serviceability protection so an item cannot be added when it is not serviceable for the active address/zone.
- Preserved wishlist independence from the currently active delivery zone.
- Added cart-aware protection around active-address switching in the customer address/location flow.
- Cart now presents the current delivery address as display-only rather than an address switcher.
- Checkout now presents the current delivery address as display-only.
- Checkout total calculation is requested automatically; the separate manual Calculate Total interaction has been removed from the modified checkout flow.
- Checkout response/model work has been extended to support retailer-specific financial breakdowns so split orders can be based on each retailer's actual order items instead of blindly dividing the overall value.
- Order list/detail UI has been expanded for richer item, delivery/tracking and financial information.
- Delivered-order review flow work now uses products from the selected order instead of requiring manual order/product identifiers.
- Product detail work includes retailer navigation/Browse This Shop behaviour and same-retailer suggested-products integration using existing retailer/zone product filtering where available.
- Customer profile and saved-address UI/API integration has been expanded using existing supported account/profile/address fields.

### Authentication / Driver
- Driver login handling was adjusted so an unverified driver can receive a verification-specific message instead of a generic invalid-credentials message where the backend state is available.
- Driver trip proof UI/service flow has been tightened so start/pickup and finish/delivery image proof is treated as mandatory in the modified trip flow.

### Logistics
- Logistics booking UI flow has been reorganized so service type is chosen before vehicle selection.
- Outstation selection prevents two-wheeler choices such as bike/scooty; within-city remains compatible with two-wheelers.
- Added Operations Manager vehicle-category logistics-rate configuration support for Bike, Scooty, Auto, Small Truck, 4-Wheel Truck, 8-Wheel Truck and 16-Wheel Truck.
- Rate configuration includes rate per kilometre, minimum distance and minimum rate.
- Delivery-fee calculation service work uses these configured rates.
- No database schema/table was added for these rates in this snapshot; therefore rate configuration is runtime/in-memory and resets when the S4 service restarts.

### Support / Retailer / Admin UX
- Retailer navigation has been extended with Notifications and Support entries/components.
- Customer support ticket raising has been separated into a customer-facing component.
- A separate non-admin user support component has been added for other user roles.
- Support escalation UI/context work now resolves Retailer/Fleet Owner business identity for display so business name can be used instead of requiring users to type a raw business UUID.
- Support escalation business type/name fields are intended to be display/read-only context in the modified flow.
- Admin routing/support navigation work has been adjusted toward removing the generic My Tickets experience and supporting a Contact Developers destination where wired by the current route set.

### API / Integration Changes
- Added/updated API Gateway authorization/routing required by the new logistics-rate APIs.
- Added S4 logistics-rate controller/service/DTO implementation following the existing Spring service architecture.
- Added S6 partner-service integration support for richer ticket/business context.
- Updated S3 checkout DTO/service flow to expose retailer-specific breakdown data.
- Updated S1 authentication/current-user/internal-user handling used by the driver-verification and profile-related changes.

## Main files changed so far

Changes currently span S1, S3, S4, S5, S6, API Gateway and the Angular frontend. Major frontend areas modified include:

- `frontend/src/app/app.routes.ts`
- `frontend/src/app/core/auth/auth.service.ts`
- `frontend/src/app/core/models/checkout.model.ts`
- `frontend/src/app/core/models/logistics-rate.model.ts`
- `frontend/src/app/core/models/support-context.model.ts`
- `frontend/src/app/core/models/user.model.ts`
- `frontend/src/app/core/services/logistics-rate.service.ts`
- `frontend/src/app/features/addresses/`
- `frontend/src/app/features/cart/`
- `frontend/src/app/features/checkout/`
- `frontend/src/app/features/driver/dashboard/`
- `frontend/src/app/features/logistics/`
- `frontend/src/app/features/operations/finance/`
- `frontend/src/app/features/operations/support/`
- `frontend/src/app/features/orders/`
- `frontend/src/app/features/products/product-detail/`
- `frontend/src/app/features/profile/`
- `frontend/src/app/features/retailer/notifications/`
- `frontend/src/app/features/support/customer-support/`
- `frontend/src/app/features/support/user-support/`
- `frontend/src/app/layout/retailer-shell/`
- `frontend/src/app/layout/shell/`
- `frontend/src/app/shared/serviceability-conflict-dialog/`
- `frontend/src/app/shared/support/`

Backend changes currently include authentication/account handling in S1, checkout/address/cart changes in S3, logistics rates/trip logic in S4, driver integration in S5, support-ticket context/escalation work in S6, and API Gateway routing/authorization updates.

## Validation status at this snapshot

- Frontend TypeScript source was previously run through syntax/transpilation-oriented checks during implementation.
- Relative frontend imports were checked in the earlier debug pass.
- Java source was previously run through syntax-oriented checks in the earlier debug pass.
- Maven compile attempts for the affected services could not complete because the Maven wrapper requires dependency/tool downloads and the execution environment could not reach Maven Central.
- Full Angular dependency build could not be completed because required npm packages were not available in the local cache and external package download was unavailable.
- The project ZIP itself is integrity-tested when this snapshot is packaged.

## Important status

This is **not the final completed release** for the entire current bug list. It is the exact project state containing the fixes implemented up to this point so that the team can begin manual testing immediately. Additional integration/runtime corrections may still be required after running the full stack with PostgreSQL and the project's normal external/runtime dependencies.
