# AroundU Development Seed Data

A complete, realistic development dataset for all six services: territory, staff, partners, customers, catalogue, tax, carts, orders, trips, payments, settlements, refunds, support, notifications and audit trail - written by the services' own `DataSeeder` classes so that it looks and behaves like data created through the application.

**Log in with any account of [credentials.md](credentials.md); the password is `Lbos@2026!` for all of them.**

| Document | What it contains |
|---|---|
| [SEED_DATA_README.md](SEED_DATA_README.md) | Design, how the seed works, how to recreate / reset / verify, decisions and limitations - **start here** |
| [credentials.md](credentials.md) | Every account: role, business / name, email, password, state, city, zone |
| [USERS_AND_MANAGERS.md](USERS_AND_MANAGERS.md) | Territory (exactly 4 zones), all accounts, Operations / Location Managers, transfer history |
| [RETAILERS.md](RETAILERS.md) | The 5 retailers with every field, verification queue and documents |
| [FLEET.md](FLEET.md) | Fleet by fleet: owner, 3 drivers, 4 vehicles (incl. a two-wheeler), assignments, expenses |
| [CUSTOMERS.md](CUSTOMERS.md) | The 7 customers and their 2 addresses each (always in different zones) |
| [CATEGORIES.md](CATEGORIES.md) / [PRODUCTS.md](PRODUCTS.md) | Categories and the 30 products (by retailer) |
| [PRODUCTS_AND_TAX.md](PRODUCTS_AND_TAX.md) | Retailer -> product -> category -> tax rule -> state -> CGST / SGST, and the tax charged on each order |
| [CARTS_AND_WISHLISTS.md](CARTS_AND_WISHLISTS.md) | Single- and multi-retailer carts, wishlists |
| [ORDERS.md](ORDERS.md) | All 23 orders: items, totals, payment, trip, driver, vehicle, invoice; multi-retailer checkouts |
| [LOGISTICS.md](LOGISTICS.md) | Logistics bookings, trips, trip status history |
| [REVIEWS.md](REVIEWS.md) | Reviews of delivered purchases |
| [VERIFICATION.md](VERIFICATION.md) | Verification queues and documents for every partner, driver and vehicle |
| [FINANCE.md](FINANCE.md) | Payments, invoices, settlements, refunds, money overview |
| [SUPPORT.md](SUPPORT.md) | Tickets, conversations, cluster incident |
| [NOTIFICATIONS_AND_AUDIT.md](NOTIFICATIONS_AND_AUDIT.md) | Notifications and audit log |
| [ENTITY_FIELD_COVERAGE.md](ENTITY_FIELD_COVERAGE.md) | Every column of every entity: type, required, populated, how the value is produced |
| [RELATIONSHIP_MAP.md](RELATIONSHIP_MAP.md) | The current relationships and how cross-service references are resolved |
| [DATA_VALIDATION.md](DATA_VALIDATION.md) | Counts and the 87 integrity / business-rule checks (all pass) - and what was and was not executed |
| [RESET_DEVELOPMENT_DB.sql](RESET_DEVELOPMENT_DB.sql) | **Development-only** reset of all 39 tables |
| [VALIDATE_SEED_DATA.sql](VALIDATE_SEED_DATA.sql) | The validation queries (portable SQL) |
| [tools/](tools) | `GenerateSeedDocs.java` and `Coverage.java` - regenerate the documents from a running dataset |
