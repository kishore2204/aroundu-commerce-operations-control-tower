# AroundU Backend

AroundU is a six-microservice Spring Boot backend combining Porter-style logistics with Zepto-style local-retailer commerce.

## Services

| Service | Responsibility | Port |
|---|---|---:|
| S1 | Platform & Territory | 8081 |
| S2 | Partner Onboarding & Verification | 8082 |
| S3 | Commerce & Customer | 8083 |
| S4 | Order & Logistics | 8084 |
| S5 | Fleet Operations | 8085 |
| S6 | Finance, Support & Engagement | 8086 |
| Eureka | Service discovery | 8761 |
| Gateway | Front-door API | 8080 |

## Roles

- CUSTOMER
- RETAILER
- LOCATION_MANAGER
- OPERATIONS_MANAGER
- FLEET_MANAGER
- SUPER_ADMIN
- SUPPORT_STAFF

## Technology

- Java 17
- Spring Boot 4.1.1
- Spring Cloud 2025.1.2
- Spring Data JPA
- PostgreSQL
- Eureka
- Spring Cloud Gateway
- OpenFeign
- JWT
- Swagger/OpenAPI
- JUnit + Mockito
- JaCoCo

## Start in Eclipse

Use `File -> Import -> Maven -> Existing Maven Projects`, then run the eight applications in this order:

1. Eureka
2. S1
3. S2
4. S3
5. S4
6. S5
7. S6
8. Gateway

See `docs/ECLIPSE_MANUAL_TESTING.md`.

## Local training credentials

See [credentials.md](credentials.md) for the full list of seeded demo accounts.

Customers can self-register through:

`POST /api/v1/auth/register/customer`

## Swagger

- S1: http://localhost:8081/swagger-ui.html
- S2: http://localhost:8082/swagger-ui.html
- S3: http://localhost:8083/swagger-ui.html
- S4: http://localhost:8084/swagger-ui.html
- S5: http://localhost:8085/swagger-ui.html
- S6: http://localhost:8086/swagger-ui.html

Normal frontend traffic goes through:

`http://localhost:8080`

## Documentation

Start with:

1. `docs/ECLIPSE_MANUAL_TESTING.md`
2. `docs/FINAL_FIXES.md`
3. `docs/frontend-integration-guide.md`
4. `docs/ui-api-mapping.md`
5. `docs/api-catalog.md`

## Build/test note

Maven Wrapper files are included. If PowerShell is blocked by company policy, run tests through Eclipse's Maven/JUnit integration.

The final Maven build and coverage run must be performed on the company laptop because the supplied environment could not download Maven from Maven Central.
