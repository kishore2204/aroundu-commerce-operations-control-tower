# AroundU - development credentials

DEV-ONLY. Every seeded account uses the password **`Lbos@2026!`** (stored BCrypt-hashed, exactly as the application stores
passwords). The complete list - role, business / person name, email, state, city and zone - is in
[seed-data/credentials.md](seed-data/credentials.md); the dataset is described in [seed-data/README.md](seed-data/README.md).

Quick start (all traffic goes through the gateway, `http://localhost:8080`):

| Role | Email |
|---|---|
| SUPER_ADMIN | `admin@lbos.com` |
| OPERATIONS_MANAGER | `op.ch@lbos.com` (Chennai), `op.ba@lbos.com` (Bengaluru), `op.hy@lbos.com` (Hyderabad) |
| LOCATION_MANAGER | `lm1.chn@lbos.com`, `lm2.chn@lbos.com`, `lm1.baw@lbos.com`, `lm1.hye@lbos.com` |
| RETAILER | `retailer1.chn@lbos.com` ... `retailer5.chn@lbos.com` |
| FLEET_MANAGER | `fleet1.baw@lbos.com`, `fleet2.hye@lbos.com`, `fleet3.chn@lbos.com` |
| DRIVER | `driver1fleet1.baw@lbos.com` ... `driver3fleet3.chn@lbos.com` |
| CUSTOMER | `customer1.chn@lbos.com` ... `customer7.baw@lbos.com` |
| SUPPORT_STAFF | `support1@lbos.com`, `support2@lbos.com` |

## Where to log in

| Service | Direct port (Swagger) |
|---|---:|
| S1 Platform & Territory | 8081 |
| S2 Partner Onboarding & Verification | 8082 |
| S3 Commerce & Customer | 8083 |
| S4 Order & Logistics | 8084 |
| S5 Fleet Operations | 8085 |
| S6 Finance, Support & Engagement | 8086 |
| Eureka | 8761 |
| Gateway | 8080 |

## Database

All six services share ONE PostgreSQL database (`DB_URL` / `DB_USERNAME` / `DB_PASSWORD` - see each service's
`application.properties`); each service's Hibernate `ddl-auto=update` creates its own tables, and each service's
`DataSeeder` fills them (see [docs/SEED_DATA_CONTRACT.md](docs/SEED_DATA_CONTRACT.md)). To start from a clean
development database run [seed-data/RESET_DEVELOPMENT_DB.sql](seed-data/RESET_DEVELOPMENT_DB.sql) and restart the services.



# Alternative Credentials

accounts use the same password: **`AroundU@123`**

Seed data now covers every module with 10+ rows, zone-wise across 5 cities (Chennai,
Coimbatore, Bengaluru, Madurai, Mysuru) and their 12 zones. Most accounts follow a plain
numbered pattern — `roleN@aroundu.local` for `N` beyond the "notable" ones below — so you
rarely need to look up an exact email:

| Pattern | Count | Role |
|---|---:|---|
| `manager@aroundu.local`, `manager2@aroundu.local`, `manager3@aroundu.local`, `manager4@aroundu.local` | 4 | OPERATIONS_MANAGER |
| `location@aroundu.local`, `location2..location6@aroundu.local` | 6 | LOCATION_MANAGER |
| `retailer1..retailer10@aroundu.local` | 10 | RETAILER |
| `fleetowner1..fleetowner6@aroundu.local` | 6 | FLEET_MANAGER |
| `customer1..customer10@aroundu.local` | 10 | CUSTOMER |
| `driver1..driver10@aroundu.local` | 10 | DRIVER |
| `support1@aroundu.local`, `support2@aroundu.local` | 2 | SUPPORT_STAFF |
| `admin@aroundu.local` | 1 | SUPER_ADMIN |

**Notable accounts** (richest seeded history — best for demoing a feature end to end):

| Email | Role | Notes |
|---|---|---|
| `admin@aroundu.local` | SUPER_ADMIN | Full platform access |
| `manager@aroundu.local` | OPERATIONS_MANAGER | Assigned to Chennai |
| `location@aroundu.local` | LOCATION_MANAGER | North Zone, Chennai |
| `retailer1@aroundu.local` | RETAILER | Store VERIFIED, Chennai — 6 seeded products, several orders |
| `retailer2@aroundu.local` | RETAILER | Store VERIFIED, Chennai — 6 seeded products, several orders |
| `retailer4..retailer10@aroundu.local` | RETAILER | Zone-wise mix: 5 VERIFIED, 2 PENDING, 1 REJECTED (e.g. "Sri Balaji Grocers", "Green Valley Mart") |
| `fleetowner1@aroundu.local` | FLEET_MANAGER | Chennai — owns vehicles/drivers/assignments/expenses across the full fleet-ops demo |
| `customer1@aroundu.local` | CUSTOMER | Has 2 seeded addresses, several orders (RETAIL + FLEET_SERVICE, including DELIVERED), a support ticket, a notification |
| `customer2@aroundu.local` | CUSTOMER | Has an address, a DELIVERED FLEET_SERVICE order |
| `driver1@aroundu.local` | DRIVER | Belongs to fleetowner1, ACTIVE, logs into /driver/dashboard and /driver/trips |
| `driver3@aroundu.local` (S1 user id `...046`) | DRIVER | Assigned to a DELIVERED trip — good for demoing the Earnings & Trips page and the escrow driver-earnings estimate |
| `support1@aroundu.local` | SUPPORT_STAFF | First-line support ticket handler ("Support Admin") — 10 seeded tickets across categories/statuses to triage |
