# LBOS Finance Integration Service

This project contains all eight entities with complete CRUD APIs visible in Swagger and separate OpenFeign clients for future external microservice connections. It contains no mock controllers and no mock data factory.

## Eight entities
PaymentTransaction, Settlement, CustomerRefund, TaxConfiguration, SupportTicket, Notification, AuditLog, CustomerInvoice.

## API count
Each entity exposes POST, GET all, GET by ID, PUT and DELETE. Total: 8 x 5 = 40 APIs.

## External connection DTOs
OrderResponse, OrderItemResponse, CustomerProfileResponse, UserAccountResponse, ProductResponse, ProductCategoryResponse, TripResponse, OperationsManagerResponse and StateResponse.

## External Feign clients
OrderServiceClient, IdentityServiceClient, CatalogServiceClient, LogisticsServiceClient and OperationsServiceClient.

Update the five `external-services.*-url` properties when the real services are available.

## Run
Import as an Existing Maven Project in Eclipse and run `LbosFinanceIntegrationApplication` as Spring Boot App.

- Swagger: http://localhost:8080/swagger-ui.html
- H2 Console: http://localhost:8080/h2-console
- JDBC URL: jdbc:h2:file:./data/lbos_finance_integration_db
- Username: sa
- Password: blank

Important: because mocks were removed, create/update operations that use Feign require the configured external services to be running. Swagger itself and local GET operations can load without them.
