# Quick Test After Debug Fixes

## Frontend
```bash
cd frontend
npm ci
npm run build
npm start
```

## Backend
Start Eureka, Gateway and S1-S6 with your existing PostgreSQL/environment configuration. For each Maven service you can use:
```bash
./mvnw clean test
./mvnw spring-boot:run
```

Recommended manual smoke order:
1. Admin -> Accounts -> create user with invalid/valid phone.
2. Admin -> Territory -> select City -> New zone.
3. Signup -> Terms and Conditions modal.
4. Customer -> Address -> State -> City -> Zone.
5. Retailer -> onboarding -> State/City/Zone -> upload all 4 docs -> Submit once.
6. Location Manager -> Verification Queue -> Review -> inspect details/docs -> reject one document -> verify resubmission flow -> approve all -> final approve.
7. Retailer -> Catalogue -> add product with multiple images -> Customer browse/detail gallery.
8. Checkout -> confirm total appears automatically -> click Place Order once repeatedly and confirm one UI request is in flight.
9. Fleet -> Assignments -> confirm pickup/drop/distance/load context and capacity-aware vehicle choice.
10. Close Retailer store -> customer product discovery should no longer expose that store's products.
11. Assign driver+vehicle to an order -> customer cancellation should be blocked.
12. Admin/Operations -> Audit -> confirm successful portal mutations are recorded.
