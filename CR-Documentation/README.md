# AroundU — Change Request Documentation (8 completed CRs)

Study material for the eight completed change requests in `CR Ticket Tracker - Template - Copy (1).xlsx` (sheet **CR**).

The tracker describes **what was requested**. These documents describe **what was actually implemented**, and every snippet was taken from the project's source code.

## 1. The eight CRs

| CR | Title | Document | Main modules |
| --- | --- | --- | --- |
| CHG0030033 | Performance Optimization Enhancements (2 iterations) | [CR-CHG0030033-Performance-Optimization.md](CR-CHG0030033-Performance-Optimization.md) | Iteration 1: Angular audit interceptor, S6, S3, all services' configuration, Angular services. Iteration 2: S2 retailer/fleet-owner "my profile" endpoints, database indexes (S2/S3/S4/S5), HikariCP configuration (S1–S6), retailer orders and fleet assignments pages |
| CHG0030038 | Reassign Location Managers Across Locations | [CR-CHG0030038-Reassign-Location-Managers.md](CR-CHG0030038-Reassign-Location-Managers.md) | S1 (assignment + history), Operations "Location managers" page |
| CHG0030041 | Product Weight Management and Vehicle Validation | [CR-CHG0030041-Product-Weight-Vehicle-Validation.md](CR-CHG0030041-Product-Weight-Vehicle-Validation.md) | S3 (product), S4 (order weight, trip), retailer catalogue, fleet assignments |
| CHG0030044 | Enhanced Customer Order Tracker Experience | [CR-CHG0030044-Customer-Order-Tracker.md](CR-CHG0030044-Customer-Order-Tracker.md) | S4 (tracking group), order detail page, order-status stepper |
| CHG0030046 | Enhanced Location Manager Dashboard and Zone User Management | [CR-CHG0030046-Location-Manager-Dashboard.md](CR-CHG0030046-Location-Manager-Dashboard.md) | S2 (dashboard + zone security), S1/S3/S4/S5 read endpoints, gateway, `/location/dashboard` |
| CHG0030047 | Document Re-Upload Workflow and Historical Document Management | [CR-CHG0030047-Document-Reupload-Workflow.md](CR-CHG0030047-Document-Reupload-Workflow.md) | S2 (documents, queue), S6 notifications (reused), queue detail, onboarding, history dialog |
| CHG0030048 | Retailer Bulk Product Upload Capability | [CR-CHG0030048-Retailer-Bulk-Product-Upload.md](CR-CHG0030048-Retailer-Bulk-Product-Upload.md) | S3 (bulk upload service), retailer catalogue dialogs |
| CHG0030050 | Reassign Verification Requests, Controlled Location Manager Deactivation | [CR-CHG0030050-Reassign-Verification-Deactivation.md](CR-CHG0030050-Reassign-Verification-Deactivation.md) | S2 (pending work, transfer), S1 (guards), Work Transfer popup, Officers and Accounts pages |

Every document has the same structure: overview → understanding → existing problem → root cause → solution → implementation details → execution flow → files changed → **actual code changes** → before vs after → testing → final result.

## 2. How the CRs relate

| Link | Why |
| --- | --- |
| CHG0030041 ↔ CHG0030048 | The bulk-upload template also carries the optional **Weight (kg)** column |
| CHG0030038 ↔ CHG0030050 | An officer cannot be **moved** (038) while pending work exists; that work is handed over with the popup from 050 |
| CHG0030046 ↔ CHG0030050 | The dashboard's pending counts and the officer's queue use the same "pending work" rule that 050 defines |
| CHG0030046 ↔ CHG0030047 | The zone check added for the dashboard also protects document and history endpoints for Location Managers |
| CHG0030033 ↔ CHG0030038 / 050 | The audit whitelist decides which of these actions are audited ("Transfer Location Manager", "Transfer Verification Work") |

## 3. Project layout (used throughout the documents)

| Folder | Service | Port | Role |
| --- | --- | --- | --- |
| `frontend` | Angular 19 web app | 4200 | Screens for every role |
| `eureka-server` | Service registry | 8761 | Services register here |
| `S1-platform-territory` | **S1** `lbos-platform` | 8081 | Accounts, login, states/cities/zones, Operations & Location Managers |
| `S2-partner-verification` | **S2** `lbos-partner` | 8082 | Retailers, fleet owners, verification queue and documents |
| `S3-commerce-customer` | **S3** `lbos-commerce` | 8083 | Products, catalogue, cart, reviews, customers |
| `S4-order-logistics` | **S4** `lbos-order` | 8084 | Orders, order items, trips, tracking |
| `S5-fleet-operations` | **S5** `lbos-fleet` | 8085 | Drivers, vehicles |
| `S6-finance-support` | **S6** `lbos-finance` | 8086 | Payments, support, notifications, audit log |
| `api-gateway` | API gateway | 8080 | Single entry point; validates the JWT and applies role rules |

Source-file paths in the documents are written relative to the service, e.g. `S4-order-logistics/.../service/TripService.java` or `frontend/src/app/...`.

## 4. Running the project

Run **`run-project.cmd`** from the project root (the folder that contains `frontend`, `eureka-server`, `S1-…`, `S6-…` and `api-gateway`).

It opens a separate command window for each part, in this order, and does not wait for any of them to finish:

```text
1. frontend        →  npm install  →  npm start
2. eureka-server   →  mvn spring-boot:run       (a 20-second head start is given before the services)
3. S1              →  mvn spring-boot:run
4. S2 … 8. S6      →  mvn spring-boot:run       (5 seconds apart)
9. api-gateway     →  mvn spring-boot:run
```

Requirements: Node.js/npm and a JDK. The script uses `mvn` when it is on the PATH and otherwise uses the Maven wrapper (`mvnw.cmd`) that is inside every service folder. Open <http://localhost:4200> after the frontend has finished starting; the Eureka console is at <http://localhost:8761>.

**Database.** Each service reads its PostgreSQL connection from its own `src/main/resources/application.properties` (the values can be overridden with the `DB_URL`, `DB_USERNAME` and `DB_PASSWORD` environment variables). The services use `spring.jpa.hibernate.ddl-auto=update`, so the new columns and tables introduced by these CRs are created automatically at startup. **No database credentials are written in these documents.**

## 5. Points where the implementation differs from the wording of the tracker

These are stated in the individual documents; they are collected here so nothing is a surprise.

| CR | Tracker wording | What the code does |
| --- | --- | --- |
| CHG0030033 | Performance improvements | Iteration 1: nothing was measured (the shared database was not reachable during development); improvements are described as work removed, with no percentages. Iteration 2: the database and full stack were reachable, so this round includes direct evidence (live PostgreSQL connection/index queries, browser network traces, test-suite results) — still no timing/percentage figures, since counts (requests, connections, indexes) were the meaningful evidence available |
| CHG0030038 | Update "permissions" and "responsibilities" | Permissions are role-based (`LOCATION_MANAGER`) and there is no per-zone permission table; zone access is read from the officer's assignment on every request. Supervisor and zone are updated; the previous location is stored in a new history table |
| CHG0030046 | Reviews/ratings shown for retailers, fleet owners and drivers (a requirement given for this dashboard) | The platform has customer reviews for retailers only. No fleet-owner or driver rating exists, so those show "Not rated" |
| CHG0030047 | "Audit logs for every submission cycle" | Every cycle is kept as an immutable version row (uploader, time, status, reviewer, comment). No new audit-log entries were added for document actions; the existing audit whitelist still records a document decision made by an internal role |
| CHG0030050 | "Open verification requests, pending approvals and active assignments" | The only work owned by a Location Manager is the verification request, so that is what the popup lists. Reassignment is per selection (one target per Transfer click) |

## 6. Testing

Each document ends with a table of practical positive and negative scenarios. Automated tests that exist for each CR are named at the end of its testing section. Note that the S2, S5 and S6 `@SpringBootTest` context tests need the remote PostgreSQL server and cannot pass without it, and older frontend `*.spec.ts` files (about 29 type errors across them) do not compile and were already stale before these CRs, so `ng test` cannot run.

## Test files and main code location

Every document ends with a **Test Files Created** section (the backend test files that belong to it, or a note that no backend code changed) and a **Main Code Location** section. The main place is marked in the source code by a banner comment of the form `CR_<change id>_<name>_<employee id(s)>` (for example `CR_CHG0030048_Retailer_Bulk_Product_Upload_3238281`).
