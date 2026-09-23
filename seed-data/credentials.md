# Credentials

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

**Every account has the same development password: `Lbos@2026!`** (it satisfies the application's password policy: 8-72 characters with an uppercase letter, a lowercase letter, a number and a special character). The database stores only its BCrypt hash (`{bcrypt}$2a$10$...`, produced by the application's own delegating `PasswordEncoder`); the plaintext exists only in this document.

Log in with `POST /api/v1/auth/login` `{"email": "...", "password": "Lbos@2026!"}` (through the gateway, `http://localhost:8080`). Every account is `ACTIVE`; the roles that depend on a profile can log in because their profile is verified / active (retailers `VERIFIED`, fleet owners `VERIFIED` + `ACTIVE`, drivers `ACTIVE`, managers with an `ACTIVE` assignment).

Zone names are exactly `North`, `South`, `East` and `West`.

| Role | Business / Name | Email | Password | State | City | Zone | Service | Notes |
|---|---|---|---|---|---|---|---|---|
| SUPER_ADMIN | Rohan Mehta | `admin@lbos.com` | `Lbos@2026!` | — | — | — | S1 (login) | Platform-wide access |
| SUPPORT_STAFF | Ananya Krishnan | `support1@lbos.com` | `Lbos@2026!` | — | — | — | S1 (login) | Works the support tickets of all zones |
| SUPPORT_STAFF | Imran Sheikh | `support2@lbos.com` | `Lbos@2026!` | — | — | — | S1 (login) | Works the support tickets of all zones |
| OPERATIONS_MANAGER | Lakshmi Narayanan | `op.ba@lbos.com` | `Lbos@2026!` | Karnataka | Bengaluru | all zones of Bengaluru | S1 operations_manager |  |
| OPERATIONS_MANAGER | Suresh Venkataraman | `op.ch@lbos.com` | `Lbos@2026!` | Tamil Nadu | Chennai | all zones of Chennai | S1 operations_manager |  |
| OPERATIONS_MANAGER | Srinivas Reddy | `op.hy@lbos.com` | `Lbos@2026!` | Telangana | Hyderabad | all zones of Hyderabad | S1 operations_manager |  |
| LOCATION_MANAGER | Manjunath Gowda | `lm1.baw@lbos.com` | `Lbos@2026!` | Karnataka | Bengaluru | West | S1 location_manager |  |
| LOCATION_MANAGER | Karthik Subramanian | `lm1.chn@lbos.com` | `Lbos@2026!` | Tamil Nadu | Chennai | North | S1 location_manager |  |
| LOCATION_MANAGER | Venkatesh Rao | `lm1.hye@lbos.com` | `Lbos@2026!` | Telangana | Hyderabad | East | S1 location_manager |  |
| LOCATION_MANAGER | Divya Ramesh | `lm2.chn@lbos.com` | `Lbos@2026!` | Tamil Nadu | Chennai | South | S1 location_manager |  |
| RETAILER | Chennai Fresh Basket (Arjun Balasubramanian) | `retailer1.chn@lbos.com` | `Lbos@2026!` | Tamil Nadu | Chennai | North | S2 retailer |  |
| RETAILER | Arunachalam Store (Arunachalam S R) | `retailer.arun@lbos.com` | `Lbos@2026!` | Tamil Nadu | Chennai | North | S2 retailer |  |
| RETAILER | Bengaluru Daily Mart (Prakash Shetty) | `retailer2.baw@lbos.com` | `Lbos@2026!` | Karnataka | Bengaluru | West | S2 retailer |  |
| RETAILER | Hyderabad Harvest Store (Sravani Chowdary) | `retailer3.hye@lbos.com` | `Lbos@2026!` | Telangana | Hyderabad | East | S2 retailer |  |
| RETAILER | Southern Spice Market (Ramya Iyer) | `retailer4.chs@lbos.com` | `Lbos@2026!` | Tamil Nadu | Chennai | South | S2 retailer |  |
| RETAILER | Perambur Daily Needs (Mohammed Faizal) | `retailer5.chn@lbos.com` | `Lbos@2026!` | Tamil Nadu | Chennai | North | S2 retailer |  |
| FLEET_MANAGER | Bengaluru Route Logistics (Ravi Kumar Naidu) | `fleet1.baw@lbos.com` | `Lbos@2026!` | Karnataka | Bengaluru | West | S2 fleet_owner |  |
| FLEET_MANAGER | Deccan Fleet Services (Naveen Goud) | `fleet2.hye@lbos.com` | `Lbos@2026!` | Telangana | Hyderabad | East | S2 fleet_owner |  |
| FLEET_MANAGER | Chennai City Carriers (Senthil Murugan) | `fleet3.chn@lbos.com` | `Lbos@2026!` | Tamil Nadu | Chennai | North | S2 fleet_owner |  |
| DRIVER | Harish Kumar | `driver1fleet1.baw@lbos.com` | `Lbos@2026!` | Karnataka | Bengaluru | West | S5 driver | Driver of Bengaluru Route Logistics |
| DRIVER | Anil Kumar Yadav | `driver1fleet2.hye@lbos.com` | `Lbos@2026!` | Telangana | Hyderabad | East | S5 driver | Driver of Deccan Fleet Services |
| DRIVER | Murugan Selvam | `driver1fleet3.chn@lbos.com` | `Lbos@2026!` | Tamil Nadu | Chennai | North | S5 driver | Driver of Chennai City Carriers |
| DRIVER | Mahesh Babu | `driver2fleet1.baw@lbos.com` | `Lbos@2026!` | Karnataka | Bengaluru | West | S5 driver | Driver of Bengaluru Route Logistics |
| DRIVER | Mohammed Irfan | `driver2fleet2.hye@lbos.com` | `Lbos@2026!` | Telangana | Hyderabad | East | S5 driver | Driver of Deccan Fleet Services |
| DRIVER | Prakash Raj | `driver2fleet3.chn@lbos.com` | `Lbos@2026!` | Tamil Nadu | Chennai | North | S5 driver | Driver of Chennai City Carriers |
| DRIVER | Ganesh Naik | `driver3fleet1.baw@lbos.com` | `Lbos@2026!` | Karnataka | Bengaluru | West | S5 driver | Driver of Bengaluru Route Logistics |
| DRIVER | Vamsi Krishna | `driver3fleet2.hye@lbos.com` | `Lbos@2026!` | Telangana | Hyderabad | East | S5 driver | Driver of Deccan Fleet Services |
| DRIVER | Arun Pandian | `driver3fleet3.chn@lbos.com` | `Lbos@2026!` | Tamil Nadu | Chennai | North | S5 driver | Driver of Chennai City Carriers |
| CUSTOMER | Priya Ramanathan | `customer1.chn@lbos.com` | `Lbos@2026!` | Tamil Nadu | Chennai | North | S3 customer_profile | Default address North; second address in West (Bengaluru) |
| CUSTOMER | Rahul Deshpande | `customer2.baw@lbos.com` | `Lbos@2026!` | Karnataka | Bengaluru | West | S3 customer_profile | Default address West; second address in East (Hyderabad) |
| CUSTOMER | Anjali Reddy | `customer3.hye@lbos.com` | `Lbos@2026!` | Telangana | Hyderabad | East | S3 customer_profile | Default address East; second address in South (Chennai) |
| CUSTOMER | Vignesh Kannan | `customer4.chn@lbos.com` | `Lbos@2026!` | Tamil Nadu | Chennai | North | S3 customer_profile | Default address North; second address in South (Chennai) |
| CUSTOMER | Sneha Raghavan | `customer5.chs@lbos.com` | `Lbos@2026!` | Tamil Nadu | Chennai | South | S3 customer_profile | Default address South; second address in East (Hyderabad) |
| CUSTOMER | Aditya Hegde | `customer6.baw@lbos.com` | `Lbos@2026!` | Karnataka | Bengaluru | West | S3 customer_profile | Default address West; second address in North (Chennai) |
| CUSTOMER | Kavya Bhat | `customer7.baw@lbos.com` | `Lbos@2026!` | Karnataka | Bengaluru | West | S3 customer_profile | Default address West; second address in North (Chennai) |

