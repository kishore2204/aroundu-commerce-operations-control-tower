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
