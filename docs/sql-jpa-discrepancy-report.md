# SQL ↔ JPA Discrepancy Report

Compares the authoritative schema (`database.sql.txt`, 34 tables) against each service's actual JPA entities and (where present) its own Flyway/DDL scripts. Only S1 ships its own SQL migration (`db/migration/V1__schema.sql`, Flyway-managed, `ddl-auto=validate`); S2/S3/S4/S5/S6 rely on Hibernate `ddl-auto=update`/`create-drop` to generate schema from the entities directly, so for those five services the comparison is authoritative-SQL vs entity only (there's no second SQL file to cross-check).

Discrepancies below were identified during the Phase 1 audit and confirmed/extended while building and testing each service in this session. **Fixed** = corrected during this integration. **Documented, not fixed** = flagged per the "do not silently modify" instruction, left for the team to decide.

## S1 — Platform & Territory

| Entity.Field | Master SQL | S1's own `V1__schema.sql` | JPA entity | Issue | Status |
|---|---|---|---|---|---|
| `State.stateName` | `varchar(120)` | `varchar(100)` | `@Column(nullable=false)`, no length (defaults 255) | S1's own migration already disagrees with the master schema's length (100 vs 120); JPA enforces neither | **Documented, not fixed** — would require picking one authoritative length and isn't a functional bug at H2 dev scale |
| `State.countryCode` | `char(2)` | `varchar(10)` | `@Column(nullable=false)`, no length | Master schema wants a strict 2-char code; S1's migration allows up to 10; JPA allows up to 255 at the column level (though service-layer validation now enforces exactly 2 letters — see changelog) | **Partially fixed** — application-level format validation added; DB column length still not tightened to avoid an unnecessary migration-vs-running-data risk |
| `UserAccount.role`, `UserAccount.accountStatus` | `varchar(40)` / `varchar(30)` | matches lengths | plain `String`, no `@Enumerated` enum, no `@Column(length=...)` | Values (`OPERATIONS_MANAGER`, `LOCATION_MANAGER`, `ACTIVE`, etc.) are enforced only by scattered string-literal checks in service code, not by the type system or a DB length constraint | **Documented, not fixed** — introducing an enum would touch every consumer of these two fields (JWT claims, security role mapping, `V2__demo.sql` seed data) for a correctness gain that doesn't block the current integration |
| `LocationManager` | has no `updated_at` column in master SQL either (SQL table has no such column) | matches (no `updated_at`) | entity also has no `updatedAt`/`@Version`, inconsistent with `OperationsManager` which has both | Consistent with SQL, but an internal inconsistency between two structurally similar entities | **Documented, not fixed** — not a SQL/JPA mismatch, a code-consistency note only |

All other S1 entities (`City`, `Zone`, `OperationsManager`) match the master schema's column names, types, nullability, and FK relationships closely; no further discrepancies found.

## S2 — Partner Onboarding & Verification

No local SQL migration exists (Hibernate `ddl-auto=update` generates the schema from entities). Compared directly against `database.sql.txt`:

| Entity.Field | Master SQL | JPA entity | Issue | Status |
|---|---|---|---|---|
| `Retailer.retailerStatus`, `FleetOwner.profileStatus`/`ownerStatus`, `VerificationQueue.verificationStatus`, `VerificationDocument.documentStatus`, `VerificationQueue.subjectType` | all `varchar(N)` with implied fixed vocabularies (`PENDING`, `VERIFIED`, `REJECTED`, `RETAILER`/`FLEET_OWNER`, etc.) | plain `String`, no enums anywhere in S2 | Same "stringly-typed status" pattern as S1's `UserAccount`, but S2 additionally has **no repository-level or DB-level constraint** limiting these to a known set — `VerificationQueueServiceImpl.processVerificationResult` accepts any string as a result value | **Documented, not fixed** — a real correctness gap (a typo'd status string is silently accepted) but fixing it means introducing enums across every S2 entity/DTO, out of scope for this integration pass |
| All UUID FK columns (`operations_manager_id`, `city_id`, etc.) | proper FK constraints with `ON DELETE` rules | plain `UUID` columns, **no `@ManyToOne`, no FK enforcement at the JPA level** | S2 never validates these IDs reference real rows (in S1) at all — by design, since S1 owns that data and S2 correctly avoids a cross-service JPA relationship, but there's also no Feign validation call anywhere in S2 confirming a given `cityId`/`operationsManagerId` actually exists | **Documented, not fixed** — this is the correct microservice pattern (scalar ID, no local FK) but the *absence of any validation at all* (not even a Feign call) means a garbage UUID is silently accepted. Flagged as a recommended follow-up (add a lightweight Feign existence-check), not implemented here to avoid scope creep into a service told to be preserved as-is |
| `driver` table | full table (`driver_id`, `fleet_owner_id`, `user_account_id`, `city_id`, `verified_by_account_id`, `license_number`, `license_expiry_date`, `driver_status`) | **entity does not exist in S2 at all** | See the Driver-ownership anomaly in `entity-catalog.md and api-catalog.md` | **Documented, not fixed** (explicit instruction: preserve S5's existing Driver, do not duplicate) |

## S3 — Commerce & Customer

No local SQL migration. This service's entities were found to match the master schema almost exactly — table names, column names, types (`BigDecimal` precision/scale, `OffsetDateTime`, `UUID`/`Long` PK strategies matching the SQL's `uuid`/`bigint identity`), nullability, and unique constraints all line up. Two minor notes:

| Entity.Field | Master SQL | JPA entity | Issue | Status |
|---|---|---|---|---|
| `CustomerCartItem` | SQL's `customer_cart_item` has `cart_id` as a plain FK column (one cart can have many cart items conceptually via the FK) | Entity maps `cart` as `@OneToOne(unique=true)` — i.e. each `CustomerCart` row maps to at most one `CustomerCartItem` row | The SQL schema doesn't itself forbid multiple cart-items per cart row; S3's actual usage pattern is one `CustomerCart` row *per customer-product pairing* (see `CustomerCart`'s own `(customer_profile_id, product_id)` unique constraint), so a 1:1 join is the intended design, just not obvious from the SQL alone | **Documented, not fixed** — verified this is intentional design (confirmed via S3's own integration guide and passing test suite), not a bug |
| `CustomerAddress` | no `created_at` column | entity also has no `createdAt` | Matches SQL, but means "default address" reassignment on deletion falls back to ID order rather than a true creation-time order (S3's own documented limitation) | **Documented, not fixed** — SQL/JPA agree, this is a product-level limitation, not a mapping bug |

## S4 — Order & Logistics

See `changelog-integration.md` for the full entity-relationship rewrite. Before the fix, every one of S4's 4 entities had `@ManyToOne`/`@OneToOne` relationships to 7 nonexistent classes, which is the most severe possible SQL/JPA discrepancy (the module didn't compile, so no schema could even be generated to compare). After the fix (confirmed: `BUILD SUCCESS`, 90/90 tests, and independently re-verified with a clean `mvnw test` run plus a source grep confirming zero remaining imports of the 7 foreign classes), foreign keys to other services' tables (`customer_profile_id`, `retailer_id`, `product_id`, `vehicle_reference_id`, `receiver_customer_profile_id`, `vehicle_id`, `driver_id`, `fleet_owner_id`, `created_by_account_id`, `assigned_by_account_id`) are plain scalar columns matching the master SQL's types (`uuid`/`bigint`) exactly.

| Entity.Field | Master SQL | JPA entity | Issue | Status |
|---|---|---|---|---|
| `Order.updatedDatetime` | column `updated_at` | `@Column(name = "updated_datetime", ...)` | Column-name mismatch — masked today because every service generates/validates its own schema independently (no service validates against `database.sql.txt` directly), but would break immediately against a real shared Postgres schema created from the master SQL file | **Documented, not fixed** — flagged by the implementing agent as out-of-scope for the compile-fix task; a one-line rename, left for a deliberate follow-up rather than bundled into this integration's unrelated changes |

## S5 — Fleet Operations

No local SQL migration. Entities match the master schema closely, and — unlike S1/S2/S6 — S5 **does** use real Java enums (`DriverStatus`, `VehicleStatus`, `AssignmentStatus`, `ExpenseType`, `ExpenseApprovalStatus`) mapped via `@Enumerated(EnumType.STRING)`, which is the most type-safe status handling of any service in this system. One note:

| Entity.Field | Master SQL | JPA entity | Issue | Status |
|---|---|---|---|---|
| All FK columns (`fleet_owner_id`, `vehicle_id`, `driver_id`, etc.) | proper FK constraints | plain `UUID` columns, no JPA relationships, **and no length/precision constraints mirrored from SQL** (e.g. `registrationNumber` has no `@Column(length=30)` matching the SQL's `varchar(30)`) | Same "no @Column length" pattern seen in S1 | **Documented, not fixed** |

## S6 — Finance, Support & Engagement

No local SQL migration. This service has the **weakest** SQL/JPA alignment of the six: **no entity uses `@Column` at all** (no `nullable`, `unique`, or `length` constraints anywhere), **no entity uses `@ManyToOne`/relationships** (consistent with correct microservice boundaries, but combined with zero `@Column` constraints means Hibernate's `ddl-auto=update` will generate a schema with default (unconstrained, nullable, `varchar(255)`) columns for everything, which will differ from the master schema's explicit `NOT NULL`/`varchar(N)`/`CHECK` constraints on every single column.

| Issue | Status |
|---|---|
| Every S6 entity field lacks explicit `nullable`/`length` — e.g. `PaymentTransaction.currencyCode` (SQL: `char(3) NOT NULL DEFAULT 'INR'`) has no length/nullable/default at the JPA level at all | **Documented, not fixed** — a real gap, but touching all 8 entities' column annotations for a training-project H2 setup (where `ddl-auto=update` papers over it at runtime) was judged lower priority than the compile-blocking S4 fix and the missing test coverage, given the time budget for this integration pass |
| `TaxConfiguration.effectiveTo`, `Settlement.completedAt`, `SupportTicket.resolvedAt`/`assignedSupportAccountId` are never set by any service-layer code path | **Documented, not fixed** — a business-logic gap (no status-transition endpoints exist for these fields at all, see `application-workflow.md`), not a schema mismatch |

## Summary of what was actually fixed vs. documented-only

**Fixed during this integration** (required for the system to build/run at all, or directly contradicted the entity's own pre-existing test):
- S1: `city` unique-index syntax (H2 compatibility), `StateService` country-code format validation.
- S4: the entire entity-relationship layer (compile-blocking).

**Documented, deliberately not fixed** (would require touching business logic in services explicitly marked "preserve as much as possible," and none block compilation, startup, or the currently-implemented feature set): every item listed above without a "Fixed" status. All are legitimate follow-up candidates for a future hardening pass.
