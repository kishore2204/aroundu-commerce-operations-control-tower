# Entity Catalog

Field-level documentation for all 34 entities, plus the entity-completeness gate and the master ownership table. Where the original developer's reasoning for a type choice cannot be established from the code itself, this is stated explicitly, followed by a separate *recommended* rationale — the two are never blended.

## 0. Entity completeness gate

| # | Entity | Service | Table | Present before | Present after | Repository | Service logic | Controller/API | Tested |
|---|--------|---------|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | State | S1 | `state` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2 | City | S1 | `city` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3 | Zone | S1 | `zone` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4 | UserAccount | S1 | `user_account` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5 | OperationsManager | S1 | `operations_manager` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 6 | LocationManager | S1 | `location_manager` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 7 | Retailer | S2 | `retailer` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 8 | FleetOwner | S2 | `fleet_owner` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 9 | VerificationDocument | S2 | `verification_document` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 10 | VerificationQueue | S2 | `verification_queue` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 11 | CustomerProfile | S3 | `customer_profile` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 12 | CustomerAddress | S3 | `customer_address` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 13 | ProductCategory | S3 | `product_categories` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 14 | Product | S3 | `products` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 15 | CustomerWishlistItem | S3 | `customer_wishlist_item` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 16 | CustomerCart | S3 | `customer_cart` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 17 | CustomerCartItem | S3 | `customer_cart_item` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 18 | CustomerReview | S3 | `customer_review` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 19 | Order | S4 | `orders` | ⚠️ (didn't compile) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 20 | OrderItem | S4 | `order_item` | ⚠️ (didn't compile) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 21 | LogisticsBookingDetail | S4 | `logistics_booking_detail` | ⚠️ (didn't compile) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 22 | Trip | S4 | `trip` | ⚠️ (didn't compile) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 23 | Driver | S5 | `driver` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 24 | Vehicle | S5 | `vehicle` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 25 | VehicleAssignment | S5 | `vehicle_assignment` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 26 | FleetExpense | S5 | `fleet_expense` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 27 | PaymentTransaction | S6 | `payment_transaction` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 28 | CustomerInvoice | S6 | `customer_invoice` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 29 | CustomerRefund | S6 | `customer_refund` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 30 | Settlement | S6 | `settlement` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 31 | TaxConfiguration | S6 | `tax_configuration` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 32 | SupportTicket | S6 | `support_ticket` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 33 | Notification | S6 | `notifications` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 34 | AuditLog | S6 | `audit_log` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Total: 34/34, before and after.** No entity was removed, merged, replaced with a DTO, or duplicated. Counts by service: S1=6, S2=4, S3=8, S4=4, S5=4, S6=8. Exact per-service test counts are in `testing.md`.

### Flagged anomaly: `driver` table / Driver entity

The business spec assigns driver **onboarding/identity/verification** to S2 (now under the merged LOCATION_MANAGER role) and driver **operational data** to S5 (now under the FLEET_MANAGER role). In the actual codebase, **S2 has no `Driver` entity at all**; **S5 owns the entire `driver` table**, including identity-adjacent fields (`license_number`, `license_expiry_date`, `verified_by_account_id`).

**Decision (unchanged from the prior integration pass, reaffirmed here): preserve S5's existing `Driver` implementation as-is. Do not create a duplicate/partial `Driver` entity in S2.** S5's `DriverServiceImpl.create()` already calls S2's `S2PartnerClient.validateDriverByUserAccount()` at creation time, which is the closest thing to an S2/S5 boundary hand-off that exists. Documented as a known architectural inconsistency, not silently fixed. This does not create an entity-count discrepancy — the SQL schema has exactly one `driver` table, fully covered by S5's `Driver` entity.

## 1. Master ownership table

| # | Entity | Service | Table | Repository | Service layer | Controller/API | Feign dependency |
|---|--------|---------|-------|------------|----------------|-----------------|-------------------|
| 1 | State | S1 | `state` | `StateRepository` | `StateService` | `StateController` (`/api/states`) | none |
| 2 | City | S1 | `city` | `CityRepository` | `CityService` | `CityController` (`/api/v1/cities`) | none |
| 3 | Zone | S1 | `zone` | `ZoneRepository` | `ZoneService`/`ZoneServiceImpl` | `ZoneController` (`/api/v1/zones`) | none |
| 4 | UserAccount | S1 | `user_account` | `UserAccountRepository` | `UserAccountService` | `UserAccountController` (`/api/user-accounts`), `AuthController` (`/api/v1/auth/login`), `CurrentUserController` (`/api/v1/users/me`), `InternalUserAccountController` (`/internal/v1/user-accounts/{id}`) | consumed by S4 (Trip audit fields), S6 (identity checks) |
| 5 | OperationsManager | S1 | `operations_manager` | `OperationsManagerRepository` | `OperationsManagerService` | `OperationsManagerController` (`/api/v1/operations-managers`), `InternalOperationsManagerController` (`/internal/v1/operations-managers`) | consumed by S6 (operations manager validation) |
| 6 | LocationManager | S1 | `location_manager` | `LocationManagerRepository` | `LocationManagerService`/`Impl` | `LocationManagerController` (`/api/v1/location-managers`) | none |
| 7 | Retailer | S2 | `retailer` | `RetailerRepository` (+ `RetailerDAO` wrapper) | `RetailerService`/`Impl` | `RetailerController` (`/api/retailers`) | consumed by S3 (`PartnerVerificationClient`) |
| 8 | FleetOwner | S2 | `fleet_owner` | `FleetOwnerRepository` (+ DAO) | `FleetOwnerService`/`Impl` | `FleetOwnerController` (`/api/fleet-owners`) | consumed by S5 (`S2PartnerClient.validateFleetOwner`) |
| 9 | VerificationDocument | S2 | `verification_document` | `VerificationDocumentRepository` (+ DAO) | `VerificationDocumentService`/`Impl` | `VerificationDocumentController` (`/api/verification-documents`) | none |
| 10 | VerificationQueue | S2 | `verification_queue` | `VerificationQueueRepository` (+ DAO) | `VerificationQueueService`/`Impl` | `VerificationQueueController` (`/api/verification-queues`) | calls S1 (`LocationManagerClient`, provisional) |
| 11 | CustomerProfile | S3 | `customer_profile` | `CustomerProfileRepository` | `CustomerServiceImpl` | `CustomerController` (`/api/v1/customers`) | none (referenced by scalar ID from S4, unvalidated) |
| 12 | CustomerAddress | S3 | `customer_address` | `CustomerAddressRepository` | `AddressServiceImpl` | `AddressController` (`/api/v1/customers/me/addresses`) | calls S1 (`PlatformTerritoryClient.validate`) |
| 13 | ProductCategory | S3 | `product_categories` | `ProductCategoryRepository` | `CategoryServiceImpl` | `CategoryController` (`/api/v1/product-categories`) | none |
| 14 | Product | S3 | `products` | `ProductRepository` | `CatalogueServiceImpl`, `InventoryServiceImpl`, `ProductDiscoveryServiceImpl` | `CatalogueController` (`/api/v1/retailers/me/products`), `InventoryController` (`/api/v1/retailers/me/inventory`), `ProductController` (`/api/v1/products`) | consumed by S4 (`ProductClient`), S6 (`CatalogServiceClient`) |
| 15 | CustomerWishlistItem | S3 | `customer_wishlist_item` | `CustomerWishlistItemRepository` | `WishlistServiceImpl` | `WishlistController` (`/api/v1/customers/me/wishlist-items`) | none |
| 16 | CustomerCart | S3 | `customer_cart` | `CustomerCartRepository` | `CartServiceImpl` | `CartController` (`/api/v1/cart`) | none |
| 17 | CustomerCartItem | S3 | `customer_cart_item` | `CustomerCartItemRepository` | `CartServiceImpl` | `CartController` (`/api/v1/cart`) | none |
| 18 | CustomerReview | S3 | `customer_review` | `CustomerReviewRepository` | `ReviewServiceImpl` | `ReviewController` (`/api/v1/reviews`) | calls S4 (`OrderLogisticsClient.reviewEligibility`) |
| 19 | Order | S4 | `orders` | `OrderRepository` | `OrderService` | `OrderController` (`/api/orders`), `InternalOrderLogisticsController` (`/api/v1/internal/orders/{orderId}/review-eligibility`) | consumed by S3 (`OrderLogisticsClient.reviewEligibility`); customerProfileId itself is an unvalidated scalar reference to S3 |
| 20 | OrderItem | S4 | `order_item` | `OrderItemRepository` | `OrderItemService` | `OrderItemController` (`/api/order-items`) | calls S3 (`ProductClient`) |
| 21 | LogisticsBookingDetail | S4 | `logistics_booking_detail` | `LogisticsBookingDetailRepository` | `LogisticsBookingDetailService` | `LogisticsBookingDetailController` (`/api/logistics-bookings`) | calls S5 (`VehicleClient`) |
| 22 | Trip | S4 | `trip` | `TripRepository` | `TripService` | `TripController` (`/api/trips`) | calls S5 (`VehicleClient`, `DriverClient`), S1 (`UserAccountClient`) |
| 23 | Driver | S5 | `driver` | `DriverRepository` | `DriverServiceImpl` | `DriverController` (`/api/drivers`) | calls S2 (`S2PartnerClient.validateDriverByUserAccount`) |
| 24 | Vehicle | S5 | `vehicle` | `VehicleRepository` | `VehicleServiceImpl` | `VehicleController` (`/api/vehicles`) | calls S2 (`S2PartnerClient.validateFleetOwner`) |
| 25 | VehicleAssignment | S5 | `vehicle_assignment` | `VehicleAssignmentRepository` | `VehicleAssignmentServiceImpl` | `VehicleAssignmentController` (`/api/assignments`) | calls S2 (`S2PartnerClient.validateDriverByUserAccount`) |
| 26 | FleetExpense | S5 | `fleet_expense` | `FleetExpenseRepository` | `FleetExpenseServiceImpl` | `FleetExpenseController` (`/api/expenses`) | calls S2 (`S2PartnerClient.validateFleetOwner`) |
| 27 | PaymentTransaction | S6 | `payment_transaction` | `PaymentTransactionRepository` | `PaymentTransactionServiceImpl` | `PaymentTransactionController` (`/api/payment-transactions`) | calls S4, S1 |
| 28 | CustomerInvoice | S6 | `customer_invoice` | `CustomerInvoiceRepository` | `CustomerInvoiceServiceImpl` | `CustomerInvoiceController` (`/api/customer-invoices`) | calls S4 |
| 29 | CustomerRefund | S6 | `customer_refund` | `CustomerRefundRepository` | `CustomerRefundServiceImpl` | `CustomerRefundController` (`/api/customer-refunds`) | calls S4, S3 |
| 30 | Settlement | S6 | `settlement` | `SettlementRepository` | `SettlementServiceImpl` | `SettlementController` (`/api/settlements`) | calls S1 |
| 31 | TaxConfiguration | S6 | `tax_configuration` | `TaxConfigurationRepository` | `TaxConfigurationServiceImpl` | `TaxConfigurationController` (`/api/tax-configurations`) | calls S1 |
| 32 | SupportTicket | S6 | `support_ticket` | `SupportTicketRepository` | `SupportTicketServiceImpl` | `SupportTicketController` (`/api/support-tickets`) | calls S1, S4 |
| 33 | Notification | S6 | `notifications` | `NotificationRepository` | `NotificationServiceImpl` | `NotificationController` (`/api/notifications`) | calls S1 |
| 34 | AuditLog | S6 | `audit_log` | `AuditLogRepository` | `AuditLogServiceImpl` | `AuditLogController` (`/api/audit-logs`) | calls S1 (existence check only) |

Full endpoint-by-endpoint detail (methods, request/response DTOs, roles, examples) is in `api-catalog.md`. The complete Feign call inventory (why each call exists, which UI feature depends on it, failure handling) is in `feign-dependencies.md`.

## 2. Field-level entity documentation

Field-level documentation for all 34 entities. Where the original developer's reasoning for a type choice cannot be established from the code itself, this is stated explicitly, followed by a separate *recommended* rationale — the two are never blended.

**Conventions used throughout, established once here to avoid repeating them 34 times:**
- **UUID primary keys** (`@GeneratedValue(strategy = GenerationType.UUID)`) are used for every entity that represents a real-world, externally-referenced business object (people, accounts, vehicles, orders' logistics detail, etc.) across all six services. *Reason not explicitly documented in the existing implementation.* **Recommended architectural reasoning**: UUIDs let each service generate globally-unique identifiers independently, without a central sequence — essential once IDs cross service/network boundaries (a `retailerId` minted by S2 must never collide with one S5 or S1 could have generated), and they don't leak a sequential row count to API consumers.
- **`Long`/`bigint identity` primary keys** are used only for `ProductCategory`, `Product` (S3), `Order`, `OrderItem` (S4), and `Notification` (S6). *Reason not explicitly documented.* **Recommended reasoning**: these are the entities with the highest expected write/scan volume and the most benefit from a compact, index-friendly, monotonically-increasing key (e.g. `products` catalogue paging, `orders` chronological listing) — a defensible, if unstated, distinction from the UUID-keyed "identity/reference" entities.
- **`BigDecimal`** is used for every monetary/currency field (prices, totals, amounts, tax rates) across all six services, with explicit `precision`/`scale` matching the SQL `numeric(p,s)` columns. This is correct practice (floating-point `double`/`float` must never represent currency) and is consistently applied — no discrepancy found.
- **`OffsetDateTime`** is used for timestamps that are meaningful across time zones (created/updated/assigned/expired-at style audit fields) in S1, S3, S4 (`Trip`), and S5; **`LocalDateTime`** is used in S4's `Order`/`OrderItem` and S6's `Notification`; **`LocalDate`** for pure calendar dates with no time component (birth dates, license expiry, invoice/settlement/expense dates). *Reason for the `OffsetDateTime` vs `LocalDateTime` split across S4 specifically is not explicitly documented* — it looks like an inconsistency introduced by different fields being added at different times rather than a deliberate design split. **Recommended reasoning**: standardize on `OffsetDateTime` everywhere a wall-clock instant crosses a service boundary, since the six services may run in different time zones/hosts.

---

## S1 — Platform & Territory (6 entities)

### 1. State
Table: `state`. Purpose: top-level geographic region (e.g. a country subdivision) that every `City` belongs to.

| Field | Java type | SQL type | Constraints |
|---|---|---|---|
| id | `UUID` | `uuid` PK | `@GeneratedValue(UUID)`, not updatable |
| stateName | `String` | `varchar` | not null (no explicit length — see discrepancy report) |
| countryCode | `String` | `varchar` | not null, application-validated as 2-letter ISO 3166-1 alpha-2 (added in this integration) |
| isActive | `Boolean` | `boolean` | not null |

No relationships (root of the hierarchy). *Why `Boolean` (boxed) instead of primitive `boolean` for `isActive`:* reason not explicitly documented; recommended reasoning is Hibernate/JPA idiom compatibility (primitives can't represent `null`, and boxed types are the conventional JPA entity-field choice even when the column is `NOT NULL`).

### 2. City
Table: `city`. Purpose: a city within a state; the unit most other entities (retailers, drivers, addresses) are located "in."

| Field | Java type | Constraints |
|---|---|---|
| id | `UUID` | PK |
| state | `State` | `@ManyToOne(fetch=LAZY, optional=false)` — *why `@ManyToOne` not a scalar `stateId`*: City and State are both owned by S1 (same service, same transaction boundary), so a real JPA relationship is appropriate and doesn't cross a service boundary, unlike the scalar-ID pattern used for *cross-service* references elsewhere in this system |
| cityName | `String` | not null |
| isActive | `Boolean` | not null |

### 3. Zone
Table: `zone`. Purpose: a sub-division of a city (the unit a `LocationManager` is actually assigned to).

| Field | Java type | Constraints |
|---|---|---|
| id | `UUID` | PK |
| city | `City` | `@ManyToOne(LAZY, optional=false)` — same-service relationship, as with City→State |
| zoneName | `String` | not null, length=100, unique per city (`uk_zone_city_name`) |
| isActive | `Boolean` | not null |

### 4. UserAccount
Table: `user_account`. Purpose: the single identity record for every human in the system (customer, retailer contact, location manager, operations manager, super admin) — the row S1's JWT is issued against.

| Field | Java type | Constraints |
|---|---|---|
| id | `UUID` | PK |
| email | `String` | not null, unique |
| phoneNumber | `String` | not null, unique |
| passwordHash | `String` | not null, `@JsonIgnore` (never serialized in responses) |
| firstName, lastName | `String` | firstName not null; lastName not null |
| role | `String` | not null — plain string, not an enum (see discrepancy report) |
| accountStatus | `String` | not null — same pattern |
| passwordChangedOn, lastLoginAt | `OffsetDateTime` | nullable |
| createdAt, updatedAt | `OffsetDateTime` | not null, stamped via `@PrePersist`/`@PreUpdate` |

*Why `role`/`accountStatus` are plain `String` rather than a Java enum*: reason not explicitly documented. **Recommended reasoning**: an enum would give compile-time safety for the 5 known roles and the known status values, at the cost of needing a code change (and redeploy) every time a new role/status value is introduced — the original developer may have chosen flexibility over strictness, but the current code does not actually exploit that flexibility (nothing dynamically adds new roles), so an enum is recommended as a future hardening step.

### 5. OperationsManager
Table: `operations_manager`. Purpose: an S1 user assigned oversight of one city's logistics operations.

| Field | Java type | Constraints |
|---|---|---|
| id | `UUID` | PK |
| userAccount | `UserAccount` | `@OneToOne(LAZY, optional=false)`, unique FK — one OM profile per account |
| city | `City` | `@ManyToOne(LAZY, optional=false)` |
| assignmentStatus | `AssignmentStatus` (enum: ACTIVE/INACTIVE/SUSPENDED/TRANSFERRED) | `@Enumerated(STRING)`, not null, default ACTIVE |
| assignedAt, updatedAt | `OffsetDateTime` | not null, stamped via lifecycle hooks |
| version | `Long` | `@Version` — optimistic locking, default 0 |

*Why this entity has `@Version` and `LocationManager` does not*, despite being structurally similar: reason not explicitly documented — an inconsistency, not a deliberate split (see discrepancy report).

### 6. LocationManager
Table: `location_manager`. Purpose: an S1 user assigned to actively manage one zone's day-to-day operations, reporting to an OperationsManager.

| Field | Java type | Constraints |
|---|---|---|
| id | `UUID` | PK |
| userAccount | `UserAccount` | `@OneToOne(LAZY, optional=false)`, unique |
| zone | `Zone` | `@ManyToOne(LAZY, optional=false)` |
| operationsManager | `OperationsManager` | `@ManyToOne(LAZY, optional=false)` |
| assignmentStatus | `AssignmentStatus` | `@Enumerated(STRING)`, not null |
| assignedAt | `OffsetDateTime` | not null |

---

## S2 — Partner Onboarding & Verification (4 entities)

All four S2 entities follow the same pattern: **UUID PK, no Lombok, plain getters/setters, no JPA relationships to anything (every cross-reference — including to entities that logically live in the same service, like `VerificationDocument.verificationQueueId`—is a raw scalar UUID column, not a `@ManyToOne`)**. *Why S2 avoids relationships even within its own service, unlike S1's City→State pattern*: reason not explicitly documented — likely just a different developer's default style, not a deliberate architectural rule. **Recommended reasoning**: scalar-everywhere is *more* defensive than necessary within one service/transaction, but is harmless; it does mean S2's repositories can't leverage JPA's automatic join-fetching and every "get related row" is a second query.

### 7. Retailer
Table: `retailer`. Purpose: a registered local store, pending or approved to sell through S3's catalogue.

| Field | Java type | Constraints |
|---|---|---|
| retailerId | `UUID` | PK |
| userAccountId | `UUID` | not null — scalar reference to S1's `UserAccount` |
| operationsManagerId | `UUID` | nullable — scalar reference to S1 |
| cityId | `UUID` | not null — scalar reference to S1 |
| longitude, latitude | `BigDecimal` | precision(11,7)/(10,7) |
| businessName | `String` | not null, length 200 |
| registrationNumber, gstNumber | `String` | unique |
| retailerStatus | `String` | not null — plain string, see discrepancy report |

### 8. FleetOwner
Table: `fleet_owner`. Purpose: an approved operator of one or more vehicles/drivers, onboarded through the same verification workflow as retailers.

| Field | Java type | Constraints |
|---|---|---|
| fleetOwnerId | `UUID` | PK |
| userAccountId, operationsManagerId, cityId | `UUID` | scalar S1 references |
| businessName | `String` | nullable, length 200 |
| bankVerifiedByAccountId | `UUID` | nullable — scalar S1 reference |
| profileStatus, ownerStatus | `String` | not null each |

### 9. VerificationDocument
Table: `verification_document`. Purpose: one uploaded KYC/business document, versioned, tied to a verification queue entry.

| Field | Java type | Constraints |
|---|---|---|
| documentId | `UUID` | PK |
| verificationQueueId | `UUID` | not null — scalar reference to `VerificationQueue` (same service) |
| documentTypeName | `String` | not null, length 120 |
| versionNumber | `Integer` | not null |
| filePath | `String` | not null, TEXT |
| expiryDate | `LocalDate` | nullable |
| documentStatus | `String` | not null, length 20 |
| rejectReason | `String` | TEXT, nullable |
| isCurrentVersion | `Boolean` | not null |
| createdAt, updatedAt | `OffsetDateTime` | not null |

### 10. VerificationQueue
Table: `verification_queue`. Purpose: the single approval workflow record for one subject (a retailer or fleet owner), tracking status and the reviewing account.

| Field | Java type | Constraints |
|---|---|---|
| verificationQueueId | `UUID` | PK |
| subjectType | `String` | not null, length 30 — expected values `RETAILER`/`FLEET_OWNER`, not enum-enforced |
| subjectId | `UUID` | not null — scalar reference to the retailer or fleet owner row |
| isActive | `Boolean` | not null |
| submittedByAccountId, reviewedByAccountId | `UUID` | not null / nullable — scalar S1 references |
| verificationStatus | `String` | not null, length 30 |
| rejectionReason, suspensionReason, deletionReason | `String` | TEXT, nullable |
| createdAt, updatedAt | `OffsetDateTime` | not null |

---

## S3 — Commerce & Customer (8 entities)

S3's entities are the most consistently and carefully typed of the six services — precision/scale, lengths, and uniqueness constraints all mirror the master SQL schema closely (see discrepancy report, near-zero findings).

### 11. CustomerProfile
Table: `customer_profile`. Purpose: S3's customer-facing record layered on top of an S1 `UserAccount` (S3 never stores name/email/password — those stay in S1).

| Field | Java type | Constraints |
|---|---|---|
| id | `UUID` | PK |
| userAccountId | `UUID` | not null, unique — scalar S1 reference, deliberately *not* a `@ManyToOne` since it crosses a service boundary |
| dateOfBirth | `LocalDate` | nullable — pure calendar date, no time/timezone relevance |
| profileStatus | `String` | not null, length 30, default `ACTIVE` |
| rewardPointsBalance | `BigDecimal` | precision(14,2), default `0` — *why `BigDecimal` for a points balance rather than `Integer`*: reason not explicitly documented; recommended reasoning is that fractional reward points (e.g. cash-back-style programs) may be a planned future feature, or simply consistency with every other monetary-shaped field in the codebase |

### 12. CustomerAddress
Table: `customer_address`. Purpose: one delivery address belonging to a customer.

| Field | Java type | Constraints |
|---|---|---|
| id | `UUID` | PK |
| customer | `CustomerProfile` | `@ManyToOne(LAZY, optional=false)` — same-service relationship |
| cityId, zoneId | `UUID` | not null / nullable — scalar S1 references |
| addressTag | `String` | not null, length 30, default `HOME` |
| line1, line2 | `String` | not null(255) / nullable(255) |
| postalCode | `String` | nullable, length 20 |
| latitude, longitude | `BigDecimal` | precision(10,7) |
| defaultAddress | `boolean` | primitive, not null — *why primitive here but `Boolean` (boxed) everywhere else in this system*: reason not explicitly documented, a minor inconsistency, functionally equivalent since the column is `NOT NULL` either way |

### 13. ProductCategory
Table: `product_categories`. Purpose: a catalogue category (e.g. "Groceries," "Furniture").

| Field | Java type | Constraints |
|---|---|---|
| id | `Long` | PK, `@GeneratedValue(IDENTITY)` |
| name | `String` | not null, unique, length 100 |
| description | `String` | nullable, length 500 |
| status | `String` | not null, length 15, default `ACTIVE` |

### 14. Product
Table: `products`. Purpose: one sellable item, owned by a retailer, with its own stock count (deliberately co-located with the catalogue row rather than a separate inventory table — see S3's own documented design note).

| Field | Java type | Constraints |
|---|---|---|
| id | `Long` | PK, IDENTITY |
| category | `ProductCategory` | `@ManyToOne(LAZY, optional=false)` — same-service |
| retailerId | `UUID` | not null — scalar S2 reference (deliberately not a relationship, crosses a service boundary) |
| sku | `String` | not null, length 80, unique per retailer |
| name | `String` | not null, length 200 |
| description | `String` | TEXT |
| unitPrice | `BigDecimal` | not null, precision(12,2) |
| stock | `int` | not null, primitive — *why primitive `int` here specifically, when every other numeric quantity elsewhere uses boxed types*: reason not explicitly documented; likely because `stock` participates in atomic SQL increment/decrement (`ProductRepository.addStock`/`removeStock`) where a primitive is the natural fit, but this reasoning is inferred, not stated in the code |
| status | `String` | not null, length 15 |
| createdAt, updatedAt | `OffsetDateTime` | not null, `@PrePersist`/`@PreUpdate` |

### 15. CustomerWishlistItem
Table: `customer_wishlist_item`. Purpose: a saved-for-later product for a customer.

| Field | Java type | Constraints |
|---|---|---|
| id | `UUID` | PK |
| customer | `CustomerProfile` | `@ManyToOne(LAZY, optional=false)` |
| product | `Product` | `@ManyToOne(LAZY, optional=false)` |
| createdAt | `OffsetDateTime` | not null |

Unique constraint on `(customer, product)` — a customer can only wishlist a given product once.

### 16. CustomerCart
Table: `customer_cart`. Purpose: one row per (customer, product) pairing currently in a customer's cart — see `CustomerCartItem` for why this is split into two entities.

| Field | Java type | Constraints |
|---|---|---|
| id | `UUID` | PK |
| customer | `CustomerProfile` | `@ManyToOne(LAZY, optional=false)` |
| product | `Product` | `@ManyToOne(LAZY, optional=false)` |
| addedAt | `OffsetDateTime` | not null |

Unique on `(customer, product)`.

### 17. CustomerCartItem
Table: `customer_cart_item`. Purpose: the quantity/status/retailer detail for one `CustomerCart` row — split from `CustomerCart` itself via a `@OneToOne`, confirmed as intentional design (see discrepancy report) rather than a modeling mistake, matching the pattern of "one cart row = one customer-product pairing, one item row = its mutable quantity/status."

| Field | Java type | Constraints |
|---|---|---|
| id | `UUID` | PK |
| cart | `CustomerCart` | `@OneToOne(LAZY, optional=false, unique=true)` |
| retailerId | `UUID` | not null — scalar S2 reference |
| quantity | `int` | not null |
| status | `String` | not null, length 30, default `ACTIVE` |
| description | `String` | TEXT |
| createdAt, updatedAt | `OffsetDateTime` | not null |

### 18. CustomerReview
Table: `customer_review`. Purpose: a customer's rating/text review of a product, tied to the specific order it was purchased in (verified-purchase enforcement).

| Field | Java type | Constraints |
|---|---|---|
| id | `UUID` | PK |
| orderId | `Long` | not null — scalar S4 reference |
| product | `Product` | `@ManyToOne(LAZY)`, **nullable** (not `optional=false`) — allows a review to survive a product being removed, with `product_id` set null rather than the review being deleted (matches the SQL's `ON DELETE SET NULL`) |
| rating | `short` | not null, 1–5 — *why `short` rather than `int`/`Integer`*: reason not explicitly documented; recommended reasoning is that a 1-5 rating is by definition tiny and `short` communicates that range intent, though `int`/`Integer` would have worked identically at negligible cost |
| text | `String` | TEXT, nullable |
| createdAt | `OffsetDateTime` | not null |

Unique on `(orderId, product)`.

---

## S4 — Order & Logistics (4 entities)

**All four entities in this section were rewritten during this integration** to remove compile-blocking relationships to nonexistent classes; the descriptions below reflect the *post-fix* state (see `changelog-integration.md` for the S4 agent's field-by-field change list once available). The general pattern applied: every field that used to be a `@ManyToOne` to another service's entity (`CustomerProfile`→S3, `Retailer`→S2, `Product`→S3, `Vehicle`/`Driver`→S5, `FleetOwner`→S2, `UserAccount`→S1) became a plain scalar `UUID` column, consistent with the scalar-reference pattern already used throughout S2/S3/S5. Only the genuinely same-service `Order`↔`LogisticsBookingDetail`/`Trip` relationships remain real JPA associations.

### 19. Order
Table: `orders`. Purpose: the unified order header for both retail and fleet-service (logistics) order types.

| Field | Java type | Constraints |
|---|---|---|
| id | `Long` | PK, IDENTITY |
| orderNumber | `String` | not null, unique |
| customerProfileId | `UUID` | not null — scalar S3 reference (unvalidated, see architecture doc) |
| orderType | `String` | not null — `RETAIL` or `FLEET_SERVICE` |
| orderDate | `LocalDateTime` | not null |
| subtotalAmount, deliveryCharge, discountAmount, totalAmount | `BigDecimal` | precision(12,2) |
| orderStatus | `String` | not null — see `application-workflow.md` §7 (S4) for the full retail-fulfilment state graph (`NEW → WAITING_FOR_RETAILER → RETAILER_ACCEPTED → FINDING_DELIVERY_PARTNER → VEHICLE_ASSIGNED → IN_TRANSIT → DELIVERED`, plus `RETAILER_REJECTED`/`SHOP_UNAVAILABLE`/`CANCELLED`) — the fleet-service order type does not use this graph, see the note at the top of this section |
| statusHistoryJson, orderTrackingJson | `String` | not null, `jsonb`-backed |
| deliveryAddress | `String` | nullable |
| deliveryLatitude, deliveryLongitude | `BigDecimal` | precision(9,6), nullable — added for the nearest-available-fleet-partner search (see `Vehicle`/`Driver` below and `application-workflow.md` §7 S5); populated from the order's resolved delivery address |
| paymentMethod, paymentStatus | `String` | not null each |
| transactionReference | `String` | nullable, unique |
| cancellationReason, cancelledDatetime | nullable | |
| updatedDatetime | `LocalDateTime` | not null |

### 20. OrderItem
Table: `order_item`. Purpose: one line item on an order, snapshotting the product's price/name/SKU at order time so later catalogue edits don't retroactively change historical orders.

| Field | Java type | Constraints |
|---|---|---|
| id | `Long` | PK, IDENTITY |
| order | `Order` | `@ManyToOne(LAZY, optional=false)` — same-service relationship, kept as a real JPA association |
| retailerId | `UUID` | not null — scalar S2 reference |
| productId | `Long` | not null — scalar S3 reference, resolved via the new `ProductClient` Feign call at creation time to populate the snapshot fields below |
| skuSnapshot, productNameSnapshot | `String` | not null — copied from S3's `Product` at order-item creation time |
| quantity | `Integer` | not null |
| unitPrice, discountAmount, lineTotal | `BigDecimal` | precision(12,2) |

### 21. LogisticsBookingDetail
Table: `logistics_booking_detail`. Purpose: the fleet-service-specific detail for one `FLEET_SERVICE`-type order (pickup/drop locations, receiver contact, cost).

| Field | Java type | Constraints |
|---|---|---|
| id | `Long` | PK — shares the `Order`'s PK via `@MapsId` (a genuine 1:1, kept as a real JPA relationship since both entities belong to S4) |
| order | `Order` | `@OneToOne(LAZY, optional=false) @MapsId` |
| vehicleReferenceId | `UUID` | nullable — scalar S5 reference |
| receiverCustomerProfileId | `UUID` | nullable — scalar S3 reference |
| receiverName, receiverPhoneNumber | `String` | not null |
| receiverEmail | `String` | nullable |
| bookingType | `String` | not null, length 40 |
| bookingLocationsJson | `String` | not null, `jsonb`-backed, default `[]` |
| specialInstructions | `String` | TEXT, nullable |

### 22. Trip
Table: `trip`. Purpose: the actual dispatched vehicle/driver run fulfilling a fleet-service order, with its own status lifecycle independent of (but synced to) the parent order.

| Field | Java type | Constraints |
|---|---|---|
| id | `UUID` | PK — *why `UUID` here but `Long` on the sibling `Order`/`OrderItem`/`LogisticsBookingDetail` (via `@MapsId`)*: reason not explicitly documented; `Trip` is the one S4 entity most likely to be referenced directly by an external service (e.g. a future driver mobile app polling trip status by ID) where a UUID avoids exposing a sequential count |
| order | `Order` | `@OneToOne(LAZY, optional=false)`, unique — same-service |
| vehicleId, driverId | `UUID` | not null each — scalar S5 references, resolved via `VehicleClient`/`DriverClient` for status/eligibility checks |
| fleetOwnerId | `UUID` | not null — scalar S2 reference, unvalidated (fleet-owner *matching* is still enforced by comparing this against the vehicle's/driver's own `fleetOwnerId` fetched from S5) |
| createdByAccountId | `UUID` | not null — scalar S1 reference, resolved via `UserAccountClient` |
| assignedByAccountId | `UUID` | nullable — scalar S1 reference |
| tripNumber | `String` | not null, unique |
| tripStatus | `String` | not null — `PLANNED`/`ASSIGNED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED` |
| plannedStartAt, actualStartAt, completedAt | `OffsetDateTime` | nullable |
| distanceKm | `BigDecimal` | precision(10,2), nullable |
| proofOfPickup, proofOfDelivery | `String` | TEXT, nullable |

---

## S5 — Fleet Operations (4 entities)

S5 is the only service besides S1 to use real Java enums for status fields (`@Enumerated(EnumType.STRING)`), giving these four entities the strongest type safety of the six services' status handling.

### 23. Driver *(see the Driver-ownership anomaly — this entity single-handedly covers what the business spec split between S2 and S5)*
Table: `driver`.

| Field | Java type | Constraints |
|---|---|---|
| driverId | `UUID` | PK |
| fleetOwnerId, cityId, verifiedByAccountId | `UUID` | scalar references (S2/S1), no length/FK enforcement |
| userAccountId | `UUID` | not null, unique — scalar S1 reference |
| licenseNumber | `String` | not null, unique |
| licenseExpiryDate | `LocalDate` | nullable — pure calendar date |
| latitude, longitude | `BigDecimal` | nullable — added for the nearest-available-fleet-partner search (`application-workflow.md` §7 S5); backs `GET /internal/v1/drivers/nearest-available` |
| driverStatus | `DriverStatus` enum (PENDING/ACTIVE/INACTIVE/SUSPENDED/LICENSE_EXPIRED) | `@Enumerated(STRING)`, entity field initializer defaults to `PENDING` — **but `DriverServiceImpl.create()` always explicitly sets `INACTIVE`** regardless of the fleet owner's own verification status, so a newly created driver is never actually `PENDING` in practice; only becomes assignment-eligible once the driver itself is separately submitted for verification and approved |

### 24. Vehicle
Table: `vehicle`.

| Field | Java type | Constraints |
|---|---|---|
| vehicleId | `UUID` | PK |
| fleetOwnerId, updatedByAccountId | `UUID` | scalar references |
| registrationNumber | `String` | not null, unique |
| vehicleType | `String` | not null — plain string, not an enum, despite S4's `LogisticsBookingDetailService` switching on known values (BIKE/AUTO/MINI_TRUCK/TRUCK/HEAVY_TRUCK) for its cost engine — *reason not explicitly documented why `vehicleType` isn't an enum given `vehicleStatus` right next to it is one*; a real inconsistency worth a follow-up |
| make, model | `String` | nullable |
| modelYear | `Integer` | nullable |
| capacityKg | `BigDecimal` | nullable |
| latitude, longitude | `BigDecimal` | nullable — added for the nearest-available-fleet-partner search (`application-workflow.md` §7 S5); backs `GET /internal/v1/vehicles/nearest-available` |
| vehicleStatus | `VehicleStatus` enum (ACTIVE/INACTIVE/MAINTENANCE/SUSPENDED/RETIRED) | `@Enumerated(STRING)`, entity field initializer defaults to `ACTIVE` — **but `VehicleServiceImpl.create()` always explicitly sets `INACTIVE`** regardless of the fleet owner's own verification status, so a newly created vehicle is never actually `ACTIVE` in practice; only becomes assignment-eligible once the vehicle itself is separately submitted for verification and approved. (This entity-vs-service default mismatch is exactly the kind of thing that made two pre-existing unit tests wrongly assert "starts ACTIVE" — fixed to assert `INACTIVE`.) |

### 25. VehicleAssignment
Table: `vehicle_assignment`. Purpose: the operational pairing of one driver to one vehicle over a time window.

| Field | Java type | Constraints |
|---|---|---|
| vehicleAssignmentId | `UUID` | PK |
| vehicleId, driverId, assignedByAccountId | `UUID` | scalar references |
| assignmentStatus | `AssignmentStatus` enum (ACTIVE/ENDED/CANCELLED) | `@Enumerated(STRING)`, default ACTIVE — *note this is a different enum from S1's `AssignmentStatus`* (same name, different package/values — S1's has ACTIVE/INACTIVE/SUSPENDED/TRANSFERRED) — a naming coincidence, not a shared type, since these are entirely separate services/JARs |
| assignedAt, endedAt | `LocalDateTime` | assignedAt stamped via `@PrePersist` if null; endedAt nullable |

### 26. FleetExpense
Table: `fleet_expense`. Purpose: an operational cost (fuel, maintenance, tolls, etc.) attributable to a fleet owner, optionally a specific vehicle/driver, subject to an approval workflow.

| Field | Java type | Constraints |
|---|---|---|
| fleetExpenseId | `UUID` | PK |
| fleetOwnerId, vehicleId, driverId, createdByAccountId, approvedByAccountId, attachmentUploadedByAccountId | `UUID` | scalar references, mixed nullable/not-null |
| expenseType | `ExpenseType` enum (FUEL/MAINTENANCE/REPAIR/INSURANCE/TOLL/PARKING/PERMIT/DRIVER_ALLOWANCE/FINE/OTHER) | `@Enumerated(STRING)` |
| amount | `BigDecimal` | not null |
| expenseDate | `LocalDate` | not null |
| approvalStatus | `ExpenseApprovalStatus` enum (PENDING/APPROVED/REJECTED/CANCELLED) | `@Enumerated(STRING)`, default PENDING |

---

## S6 — Finance, Support & Engagement (8 entities)

S6 is the weakest of the six on JPA column-level rigor — **no entity in this service uses `@Column` at all** (see discrepancy report), so every constraint below is described from the master SQL schema's intent, not enforced at the Java level.

### 27. PaymentTransaction
Table: `payment_transaction`.

| Field | Java type | Notes |
|---|---|---|
| paymentTransactionId | `UUID` | PK |
| orderId | `Long` | scalar S4 reference |
| providerReference | `String` | intended unique (SQL), unenforced in JPA |
| paymentMethod, paymentStatus, escrowStatus | `String` | plain strings, no enums |
| heldAt, processedAt | `OffsetDateTime` | nullable; **never set by any code path** (see business logic doc) |
| amount | `BigDecimal` | |
| currencyCode | `String` | SQL: `char(3) DEFAULT 'INR'`; JPA has no length/default at all — set explicitly to `"INR"` in service code instead |

### 28. CustomerInvoice
Table: `customer_invoice`.

| Field | Java type | Notes |
|---|---|---|
| invoiceId | `UUID` | PK |
| orderId | `Long` | scalar S4 reference, intended unique |
| invoiceNumber | `String` | intended unique |
| invoiceDate | `LocalDate` | |
| subtotalAmount, taxAmount, totalAmount | `BigDecimal` | computed from live S4 order-item data at creation |
| invoiceStatus | `String` | default `ISSUED` (set in service code) |

### 29. CustomerRefund
Table: `customer_refund`.

| Field | Java type | Notes |
|---|---|---|
| customerRefundId | `UUID` | PK |
| customerTicketId, paymentTransactionId | `UUID` | scalar references (same-service to `SupportTicket`/`PaymentTransaction`, still modeled as scalars rather than relationships — consistent with this service's style) |
| orderItemId | `Long` | scalar S4 reference |
| refundReference | `String` | intended unique |
| refundAmount | `BigDecimal` | |
| refundStatus | `String` | default `REQUESTED` |
| reason | `String` | |
| requestedAt, processedAt | `OffsetDateTime` | processedAt never set by any code path |

### 30. Settlement
Table: `settlement`.

| Field | Java type | Notes |
|---|---|---|
| settlementId | `UUID` | PK |
| operationsManagerId | `UUID` | scalar S1 reference, nullable |
| paymentTransactionId | `UUID` | scalar reference, not null |
| settlementReference | `String` | intended unique |
| grossAmount, feeAmount, netAmount | `BigDecimal` | `netAmount = gross - fee`, computed in service code |
| settlementStatus | `String` | default `PENDING` |
| settlementDate | `LocalDate` | |
| createdAt, completedAt | `OffsetDateTime` | completedAt never set by any code path |

### 31. TaxConfiguration
Table: `tax_configuration`.

| Field | Java type | Notes |
|---|---|---|
| taxConfigurationId | `UUID` | PK |
| taxCategoryName | `String` | |
| description | `String` | nullable |
| stateId | `UUID` | scalar S1 reference, validated ACTIVE via Feign at creation |
| cgst, sgst | `BigDecimal` | tax rates |
| effectiveFrom | `LocalDate` | |
| effectiveTo | `LocalDate` | nullable, never set by any code path |
| active | `Boolean` | getter named `isActive()` |

### 32. SupportTicket
Table: `support_ticket`.

| Field | Java type | Notes |
|---|---|---|
| customerTicketId | `UUID` | PK |
| customerProfileId | `UUID` | scalar S3 reference |
| orderId | `Long` | nullable, scalar S4 reference — if present, verified to belong to the customer |
| raisedByAccountId | `UUID` | scalar S1 reference, validated ACTIVE |
| ticketCategory, ticketSubCategory | `String` | |
| assignedSupportAccountId | `UUID` | nullable, **never set by any code path** |
| ticketNumber | `String` | intended unique |
| subject, description, priority | `String` | |
| ticketStatus | `String` | default `OPEN` |
| raisedAt, resolvedAt | `OffsetDateTime` | resolvedAt never set |

### 33. Notification
Table: `notifications`.

| Field | Java type | Notes |
|---|---|---|
| notificationId | `Long` | PK, IDENTITY — the one `Long`-keyed entity in S6, matching the SQL's `bigint GENERATED ALWAYS AS IDENTITY`; consistent with the "high-volume" `Long`-PK convention noted at the top of this document |
| userAccountId | `UUID` | scalar S1 reference, validated ACTIVE |
| role | `String` | |
| notificationType, referenceType | `String` | |
| referenceId | `String` | note: SQL declares this as `uuid`, entity types it as `String` — a real, minor type mismatch (works because both serialize/compare as text, but loses UUID-format validation at the DB level) |
| title, message | `String` | |
| read | `Boolean` | getter `isRead()`; **no "mark as read" endpoint exists** |
| sentAt | `LocalDateTime` | |

### 34. AuditLog
Table: `audit_log`.

| Field | Java type | Notes |
|---|---|---|
| auditLogId | `UUID` | PK |
| userAccountId | `UUID` | nullable, scalar S1 reference — existence-checked via Feign but the check's result is discarded (see business logic doc) |
| action | `String` | |
| sourceModule | `String` | nullable |
| oldValues, newValues | `String` | intended `jsonb` in SQL; plain `String` in JPA — works, but no JSON-shape validation at either layer |
| ipAddress | `String` | SQL: `inet` type; JPA: plain `String` — same "works but no format validation" pattern |
| performedAt | `OffsetDateTime` | |

---

## Collection-type note (List vs Set)

No entity in any of the six services declares a `@OneToMany`/`@ManyToMany` collection field at all — every "many" side of a relationship is queried via the owning repository's derived-query methods (e.g. `CustomerCartItemRepository.findByCartCustomerId(...)`) rather than a mapped Java collection on the parent entity. This means the "why `List` vs `Set`" question the audit brief anticipated **does not arise anywhere in this codebase** — there are simply no collection-valued entity fields to compare, in any of the 34 entities, across any of the six services.
