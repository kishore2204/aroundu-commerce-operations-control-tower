# AroundU Backend - Eclipse + Swagger Manual Testing Guide

This guide is for the training/demo backend after the final integration fixes. It assumes you are using Eclipse on a company laptop where PowerShell scripts may be blocked.

## 1. Required startup order

Run the applications as normal Spring Boot applications in Eclipse:

1. `eureka-server`
2. `S1-platform-territory`
3. `S2-partner-verification`
4. `S3-commerce-customer`
5. `S4-order-logistics`
6. `S5-fleet-operations`
7. `S6-finance-support`
8. `api-gateway`

Expected ports:

| Application | Port |
|---|---:|
| Eureka | 8761 |
| Gateway | 8080 |
| S1 | 8081 |
| S2 | 8082 |
| S3 | 8083 |
| S4 | 8084 |
| S5 | 8085 |
| S6 | 8086 |

Open Eureka first:

`http://localhost:8761`

Wait until all six business services and the Gateway are registered.

## 2. Importing into Eclipse

Import each directory as a Maven project:

`File -> Import -> Maven -> Existing Maven Projects`

Select the repository root, then make sure Eclipse detects:

- S1-platform-territory
- S2-partner-verification
- S3-commerce-customer
- S4-order-logistics
- S5-fleet-operations
- S6-finance-support
- api-gateway
- eureka-server

If Eclipse shows stale dependency errors:

`Right click project -> Maven -> Update Project -> Force Update`

Then:

`Project -> Clean`

The repository targets Java 17. In Eclipse use a Java 17 JDK for the projects.

## 3. Run each application in Eclipse

Open the `*Application.java` class and choose:

`Run As -> Spring Boot App`

Do this in the startup order above.

Do not run the `mvnw` scripts if company policy blocks scripts. Eclipse can run the same Maven lifecycle through its Maven integration.

## 4. Demo accounts

Fresh S1 startup runs Flyway migrations and creates local training accounts.

These credentials are DEV-ONLY:

| Role | Email | Password |
|---|---|---|
| SUPER_ADMIN | admin@lbos.com | Lbos@2026! |
| OPERATIONS_MANAGER | op.ch@lbos.com | Lbos@2026! |
| LOCATION_MANAGER | lm1.chn@lbos.com | Lbos@2026! |

Do not use these credentials outside the local training environment.

## 5. Swagger URLs

Each service exposes Swagger separately:

- S1: `http://localhost:8081/swagger-ui.html`
- S2: `http://localhost:8082/swagger-ui.html`
- S3: `http://localhost:8083/swagger-ui.html`
- S4: `http://localhost:8084/swagger-ui.html`
- S5: `http://localhost:8085/swagger-ui.html`
- S6: `http://localhost:8086/swagger-ui.html`

The frontend should use the Gateway at `http://localhost:8080`, but direct service Swagger is useful for isolating a service while debugging.

## 6. First test - Customer signup

Use S1 Swagger.

`POST /api/v1/auth/register/customer`

Request:

```json
{
  "email": "newcustomer1@lbos.com",
  "phoneNumber": "9876543210",
  "password": "Customer@123",
  "firstName": "Demo",
  "lastName": "Customer"
}
```

Expected:

`201 Created`

The role is always `CUSTOMER`. The client cannot choose SUPER_ADMIN, RETAILER, or another role.

## 7. Login

Use S1 Swagger:

`POST /api/v1/auth/login`

```json
{
  "email": "newcustomer1@lbos.com",
  "password": "Customer@123"
}
```

Copy the `accessToken` from the response.

## 8. Swagger JWT authorization

For S1 Swagger, click `Authorize`.

Enter:

`Bearer <accessToken>`

Do not put the email/password into the Authorize box. The email/password are used only by `/api/v1/auth/login`.

If you are testing through the Gateway, use the same Bearer token with Gateway requests.

## 9. Create the customer profile

The customer profile is automatically provisioned by S3 on the first authenticated customer-context request.

Use S3:

`GET /api/v1/customers/me`

Include the JWT/trusted identity when testing through the Gateway.

Expected:

`200 OK`

A CustomerProfile UUID is returned.

## 10. Test product browsing

S3:

`GET /api/v1/products`

This is the simplest customer-facing API.

If the response contains no products, that is because S3's H2 database is empty. Create catalogue data using a RETAILER account or insert demo catalogue data through S3's APIs.

## 11. Test checkout serviceability

After you have:

- a customer account
- a customer profile
- a customer address
- at least one ACTIVE product with stock
- that product in the customer's cart

call:

`POST /api/v1/checkout/prepare`

S3 internally calls:

`S3 -> Feign -> S4 /api/v1/internal/delivery/serviceability-checks`

The S4 serviceability endpoint now:

- validates address identifiers are present
- validates every product exists
- validates every product is ACTIVE
- validates every product has stock
- returns a demo retail delivery charge of INR 49
- returns an estimate of `30-60 minutes`

The INR 49 charge is intentionally a training/demo rule because the 34-entity model has no retail fare table.

## 12. Retail checkout sequence

The current architecture keeps checkout preparation separate from order creation.

Call in this order:

1. `POST /api/v1/checkout/prepare`
2. `POST /api/orders`
3. `POST /api/order-items`
4. `POST /api/payment-transactions`

The backend does not pretend these four operations are one transaction across four microservices.

## 13. Test Gateway

After direct service testing works, repeat the important calls through:

`http://localhost:8080`

Example:

`POST http://localhost:8080/api/v1/auth/login`

then:

`GET http://localhost:8080/api/v1/users/me`

and:

`GET http://localhost:8080/api/v1/products`

The Gateway validates JWTs and adds trusted identity headers.

## 14. Test Gateway role restrictions

Use the CUSTOMER token and try:

`GET /api/vehicles`

Expected:

`403 Forbidden`

Then use the FLEET_MANAGER token for fleet APIs.

The Gateway is fail-closed: an API route that has no explicit authorization rule is rejected rather than automatically allowed.

## 15. Test Eureka + Feign

Check Eureka first.

Then test an operation that crosses services.

Examples:

- S3 checkout -> S4 serviceability
- S3 checkout -> S6 tax
- S4 -> S3 product
- S4 -> S5 vehicle/driver
- S4 -> S1 user account
- S5 -> S2 partner validation
- S6 -> S1 user account
- S6 -> S3 customer profile
- S6 -> S4 order/trip

Normal Feign clients now use Eureka service names instead of `http://localhost:PORT`.

## 16. Test S2 without DAO layer

S2 now uses Spring Data repositories directly.

Architecture is:

`Controller -> Service -> Repository -> Entity`

There is no redundant:

`Controller -> Service -> DAO -> Repository`

The removed DAO classes did not own business logic; they only delegated one-to-one to the repositories.

## 17. H2 consoles

Useful H2 consoles:

- S1: `http://localhost:8081/h2-console`
- S2: `http://localhost:8082/h2-console`
- S3: `http://localhost:8083/h2-console`
- S5: `http://localhost:8085/h2-console`
- S6: `http://localhost:8086/h2-console`

H2 is intentionally isolated per microservice. Do not expect a table created in S3 to appear in S4's H2 database.

For S1:

JDBC URL:

`jdbc:h2:mem:lbos;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE`

Username:

`sa`

Password:

blank

## 18. Useful manual negative tests

### Customer

Try accessing another customer's resource.

Expected:

`403` or `404`, depending on the owning service's resource rule.

### Invalid login

Use:

```json
{
  "email": "newcustomer1@lbos.com",
  "password": "wrong"
}
```

Expected:

`401 Unauthorized`

### Invalid signup

Use a weak password:

```json
{
  "email": "bad@lbos.com",
  "phoneNumber": "9876543211",
  "password": "abc",
  "firstName": "Bad",
  "lastName": "Password"
}
```

Expected:

`400 Bad Request`

### Duplicate signup

Register the same email twice.

Expected:

`409 Conflict`

### Wrong role

Use CUSTOMER JWT against:

`GET /api/vehicles`

Expected:

`403 Forbidden`

### Unknown Gateway route

Call an unknown `/api/...` route with a valid JWT.

It must not silently pass through the Gateway.

## 19. Running tests in Eclipse

For an individual project:

`Right click project -> Run As -> Maven test`

For a specific test class:

`Right click test class -> Run As -> JUnit Test`

For coverage:

Install/use Eclipse's coverage runner if available:

`Right click project -> Coverage As -> JUnit Test`

The Maven JaCoCo configuration also generates:

`target/site/jacoco/index.html`

after the Maven `test`/`verify` lifecycle.

## 20. If PowerShell is blocked

You do NOT need PowerShell to run the backend - every script in `scripts/` is a plain `.cmd`
batch file (`start-all.cmd`, `stop-all.cmd`, `test-all.cmd`, `start-and-test.cmd`,
`test-api.cmd`), runnable from `cmd.exe` or by double-clicking, no PowerShell execution policy
involved at all.

If Eclipse is preferred anyway (or `.cmd` files themselves are restricted on a locked-down
machine), use Eclipse to start the applications and Swagger for manual API testing instead.

For a company laptop where even `.cmd` files are restricted, the recommended workflow is:

`Eclipse -> Spring Boot Apps`

then:

`Eureka -> Swagger -> JWT -> API testing`

## 21. Recommended testing order

Do not test random APIs first.

Use this sequence:

```text
1. Eureka
2. S1
3. S2
4. S3
5. S4
6. S5
7. S6
8. Gateway
9. S1 login
10. Customer signup
11. Customer login
12. /users/me
13. Customer profile
14. Customer address
15. Product browsing
16. Cart
17. Checkout prepare
18. S4 serviceability
19. Order creation
20. Order items
21. Payment
22. Tracking
23. Fleet APIs
24. Verification APIs
25. Finance/support APIs
```

If an API fails, check the service that owns that API first, then check its Feign dependencies in Eureka.

## 22. What "frontend ready" means here

The frontend should use only:

`http://localhost:8080`

for normal API calls.

It should:

1. Register/login.
2. Store the JWT.
3. Send `Authorization: Bearer <token>`.
4. Never construct `X-User-Account-Id`.
5. Never call a microservice's private port in normal frontend code.
6. Use the API catalogue and UI/API mapping for endpoint details.
