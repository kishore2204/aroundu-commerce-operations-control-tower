# Relationship Map

The relationships of the **current** model, as the seed reproduces them. Inside a service they are JPA relations (foreign keys); **between services they are plain scalar ids with no foreign key** (`architecture.md`), so the seeders find the other service's row by business key and the application's own lookups (Feign clients) keep working on them. Every arrow below is asserted by a check in [`VALIDATE_SEED_DATA.sql`](VALIDATE_SEED_DATA.sql) (see [DATA_VALIDATION.md](DATA_VALIDATION.md)).

## Territory and staff (S1)

```text
State ──< City ──< Zone            (Tamil Nadu > Chennai > North, South;  Karnataka > Bengaluru > West;  Telangana > Hyderabad > East)
                    ▲
UserAccount ──1:1── OperationsManager ──> City            (one ACTIVE manager per city)
UserAccount ──1:1── LocationManager   ──> Zone            (a zone may have several officers; one officer belongs to one zone)
                          └──> OperationsManager           (must manage the zone's city)
LocationManager ──< LocationManagerAssignmentHistory       (lm2.chn: North -> South)
```

## Partners (S2, S5)

```text
UserAccount (RETAILER)      ──1:1── Retailer     ──> City, Zone, OperationsManager
UserAccount (FLEET_MANAGER) ──1:1── FleetOwner   ──> City, Zone, OperationsManager
                                        │
              ┌─────────────────────────┴───────────────────────────┐
              ▼ (S5)                                                 ▼ (S5)
   Driver (──1:1── UserAccount DRIVER)                             Vehicle   [3 four-wheelers + 1 two-wheeler]
              └──────── VehicleAssignment ────────────────────────────┘   (ACTIVE: one per driver and per vehicle; ENDED kept)
   FleetOwner ──< FleetExpense ──> Vehicle, (Driver)                       (approver ≠ creator)

VerificationQueue ──> subject (Retailer | FleetOwner | Driver | Vehicle) ──< VerificationDocument   (submitted by an account, reviewed by the Location Manager of the zone)
```

## Catalogue, tax, customers (S3, S6)

```text
Retailer ──< Product ──> ProductCategory ──(id only)──< TaxConfiguration ──> State
              (S3)          (S3)                            (S6 tax_configuration.product_category_id; one ACTIVE rule per category + state)

UserAccount (CUSTOMER) ──1:1── CustomerProfile ──< CustomerAddress ──> City, Zone      (exactly 2 per customer, in 2 different zones, 1 default)
CustomerProfile ──< CustomerCart ──> Product ──1:1── CustomerCartItem ──> Retailer      (multi-retailer cart = lines of 2 retailers)
CustomerProfile ──< CustomerWishlistItem ──> Product
CustomerProfile ──< CustomerReview ──> Product, Order                                   (only for a DELIVERED order containing the product)
```

## Orders, logistics, money (S4, S6)

```text
CustomerProfile ──< Order (RETAIL)  ──< OrderItem ──> Product (+ Retailer)      one order per retailer; a multi-retailer checkout = several orders
                └─< Order (FLEET_SERVICE) ──1:1── LogisticsBookingDetail ──> Vehicle
Order ──1:1── Trip ──> Driver, Vehicle, FleetOwner   (driver / vehicle / fleet belong together; driver is the vehicle's assignee)
Trip ──< TripStatusHistory                            (null -> PLANNED -> IN_PROGRESS -> COMPLETED)
Order ──< PaymentTransaction (FAILED attempt + SUCCESS)  ──< Settlement (RETAILER per retailer | FLEET_OWNER | PLATFORM)
Order ──1:1── CustomerInvoice          (delivered retail orders)
PaymentTransaction + OrderItem + SupportTicket ──< CustomerRefund
```

## Support, engagement, audit (S6)

```text
UserAccount ──< SupportTicket ──> Order, CustomerProfile (customer tickets), assigned SUPPORT_STAFF
SupportTicket ──< SupportTicketMessage
SupportTicket >── TicketClusterIncident ──> City, Zone          (3 distinct raisers, one category/sub-category, one zone)
SupportTicket escalation ──> Retailer | FleetOwner (entity)  or  role
UserAccount ──< Notification  (reference: Order id or SupportTicket id)
UserAccount ──< AuditLog
```

## Cross-service references and how the seed resolves each

| From (service.table.column) | To | Resolved by |
|---|---|---|
| S2 retailer / fleet_owner `.user_account_id`, `.city_id`, `.zone_id`, `.operations_manager_id` | S1 account, city, zone, operations manager | account email, city / zone name |
| S5 driver `.user_account_id`, `.fleet_owner_id`, `.city_id` | S1 account, S2 fleet owner, S1 city | email, fleet owner's account email |
| S2 verification_queue `.subject_id` (driver / vehicle) | S5 driver / vehicle | driver email, registration number (S2 waits for S5) |
| S3 customer_profile `.user_account_id`, customer_address `.city_id/.zone_id` | S1 | email, city / zone name |
| S3 products `.retailer_id`, cart_item `.retailer_id` | S2 retailer | retailer's account email |
| S4 orders `.customer_profile_id`, order_item `.retailer_id/.product_id` | S3 customer, S2 retailer, S3 product | customer email, retailer + SKU |
| S4 trip `.driver_id/.vehicle_id/.fleet_owner_id`, booking `.vehicle_reference_id` | S5 driver / vehicle, S2 fleet owner | driver email, registration number |
| S4 order tax | S6 tax_configuration | category id + state of the delivery city |
| S3 customer_review `.order_id`, reward points | S4 orders | the customer's delivered order containing the product |
| S6 tax_configuration `.product_category_id`, `.state_id` | S3 category, S1 state | category name, state name |
| S6 payment_transaction / invoice / ticket `.order_id` | S4 order | order rows read from S4 |
| S6 settlement `.payee_id` | S2 retailer / fleet owner | the order items' retailer, the trip's fleet owner |
| S6 support_ticket / notifications / audit `.*_account_id`, `.customer_profile_id` | S1 account, S3 customer | email |

A retailer is *not* referenced by `user_account_id` alone anywhere in S3/S4/S6: they always carry the S2 `retailer_id` the application itself uses, which is why the seeders look it up rather than assume it.
