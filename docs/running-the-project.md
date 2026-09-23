# Running the Project

A from-scratch guide — no prior context needed beyond what's here. For the fastest path, use the `.cmd` scripts in `scripts/` (§6); this document also gives the manual/per-service commands they wrap.

## 1. Prerequisites

- **Java 17** (JDK). This project was built and tested against a JDK 24 runtime via `--release 17` compilation, which works fine, but Java 17 is the declared/supported target — use 17 if you have a choice.
- **Maven**: not required to be pre-installed — every module ships its own wrapper (`mvnw` / `mvnw.cmd`). From PowerShell/`cmd.exe` use `mvnw.cmd`; from Git Bash/WSL use `./mvnw`.
- Internet access on first build (Maven downloads dependencies into `~/.m2/repository`; subsequent builds work offline).
- **No external database is required for local dev/testing** — every service defaults to embedded H2 (§4). For a real, persistent database, run against PostgreSQL instead (§4a) — needs a local (or remote) PostgreSQL 13+ server; no Docker/containers involved, a native install is all that's needed.

## 2. Project structure (normalized)

```
project/
├── database.sql                  # authoritative 34-table schema (reference; only S1 auto-applies its own copy via Flyway)
├── docs/                         # this document and its siblings
├── scripts/                      # start-all.cmd, stop-all.cmd, test-all.cmd, start-and-test.cmd, test-api.cmd
├── api-tests/                    # manual-api-test-cases.md
├── eureka-server/                # service registry, port 8761
├── api-gateway/                  # single entry point + JWT auth + CORS + role authorization, port 8080
├── S1-platform-territory/        # lbos-platform, port 8081
├── S2-partner-verification/      # lbos-partner, port 8082
├── S3-commerce-customer/         # lbos-commerce, port 8083
├── S4-order-logistics/           # lbos-order, port 8084
├── S5-fleet-operations/          # lbos-fleet, port 8085
└── S6-finance-support/           # lbos-finance, port 8086
```

Every one of the 8 modules is now exactly `<module>/pom.xml` + `<module>/src/` — no nested intermediate project folders. (This is a change from an earlier pass of this project, which had inconsistent nesting depth per service, e.g. `S3-commerce-customer/commerce-customer-service/commerce-customer-service/`. All eight modules were flattened and re-verified building/testing green from their new locations.)

## 3. Ports

| Service | Eureka name | Port |
|---|---|---|
| Eureka Server | `lbos-eureka` | 8761 |
| API Gateway | `lbos-gateway` | 8080 |
| S1 Platform & Territory | `lbos-platform` | 8081 |
| S2 Partner Onboarding & Verification | `lbos-partner` | 8082 |
| S3 Commerce & Customer | `lbos-commerce` | 8083 |
| S4 Order & Logistics | `lbos-order` | 8084 |
| S5 Fleet Operations | `lbos-fleet` | 8085 |
| S6 Finance, Support & Engagement | `lbos-finance` | 8086 |

## 4. H2 (default)

Every service runs its own **in-memory** H2 instance (`jdbc:h2:mem:...`), auto-created on startup — nothing to install. Each exposes the H2 web console at `http://localhost:<port>/h2-console`:
- JDBC URL: the exact value in that service's `application.properties`/`.yml` (e.g. S1: `jdbc:h2:mem:lbos;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE`; S3: `jdbc:h2:mem:commercecustomerdb;MODE=PostgreSQL;...`)
- Username: `sa` (S2 uses `dharani` — inherited from the original team, unchanged)
- Password: blank

Since it's in-memory, **data resets every restart**. S1 seeds two demo users via Flyway (`V2__demo.sql`) on every startup; the other five services start with empty tables.

This is also what every service's test suite runs against (`mvn test` never needs a live database), so it stays the *default* profile even now that PostgreSQL is available — switching the default would mean `mvn test` fails on a machine with no PostgreSQL server running.

## 4a. PostgreSQL (real, persistent database — native Windows install, no Docker)

Every service now ships an `application-postgres.properties`/`.yml` profile — same properties, pointed at a real PostgreSQL instance instead of embedded H2, each service in its own database (DB-per-service, matching the existing H2-per-service isolation):

| Service | Database name | Default JDBC URL |
|---|---|---|
| S1 Platform & Territory | `lbos_platform` | `jdbc:postgresql://localhost:5432/lbos_platform` |
| S2 Partner Verification | `lbos_partner` | `jdbc:postgresql://localhost:5432/lbos_partner` |
| S3 Commerce & Customer | `lbos_commerce` | `jdbc:postgresql://localhost:5432/lbos_commerce` |
| S4 Order & Logistics | `lbos_order` | `jdbc:postgresql://localhost:5432/lbos_order` |
| S5 Fleet Operations | `lbos_fleet` | `jdbc:postgresql://localhost:5432/lbos_fleet` |
| S6 Finance & Support | `lbos_finance` | `jdbc:postgresql://localhost:5432/lbos_finance` |

**1. Install/start PostgreSQL natively** (no containers). On Windows, the [EDB installer](https://www.postgresql.org/download/windows/) registers a Windows service (e.g. `postgresql-x64-17`) that starts automatically on boot — confirm it's running:

```powershell
Get-Service postgresql*
# or start it if it's stopped:
Start-Service postgresql-x64-17    # match your installed version's service name
```

By default the installer's `pg_hba.conf` trusts local/loopback connections (`127.0.0.1`, `::1`) with no password required — if yours is configured differently, set `DB_USERNAME`/`DB_PASSWORD` (per service, see §5) to match. macOS/Linux: install via your package manager (`brew install postgresql`, `apt install postgresql`, etc.) and ensure the server is running on port 5432.

**2. Create the six databases** (safe to re-run — skips any that already exist):

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -f scripts\init-postgres-databases.sql
```

(Adjust the `psql.exe` path to your installed version. On macOS/Linux: `psql -U postgres -h 127.0.0.1 -f scripts/init-postgres-databases.sql`.) Already have PostgreSQL running elsewhere, or a different admin user? Just create the six databases listed above however you normally would, or point `DB_URL`/`DB_USERNAME`/`DB_PASSWORD` at whatever you have.

**3. Start every service with the `postgres` profile active.** Either:

```cmd
scripts\start-all.cmd /postgres
```

(this also checks that a `postgresql*` Windows service is running and warns you if not) or, per service, set `SPRING_PROFILES_ACTIVE=postgres` before `mvnw spring-boot:run` (or pass `--spring.profiles.active=postgres` as a program argument):

```bash
cd S1-platform-territory && SPRING_PROFILES_ACTIVE=postgres ./mvnw spring-boot:run
```

On plain `cmd.exe`: `set SPRING_PROFILES_ACTIVE=postgres` before the same command (or run `start-all.cmd /postgres`, which sets it for you).

**What happens on first startup against Postgres:**
- S1 uses Flyway (`spring.flyway.enabled=true`, already the default, unaffected by the profile) — it creates its schema from `V1__schema.sql`/etc. and seeds demo accounts from `V2__demo.sql`/`V3__demo_credentials.sql`, the same as it does against H2 today.
- S2–S6 use Hibernate's `ddl-auto=update` (auto-generates/updates tables from the JPA entities) — same mechanism they already use against H2, just against a database that persists between restarts. Note the `postgres` profile deliberately overrides S3's default `ddl-auto: create-drop` to `update`, since `create-drop` would destroy S3's data on every restart/shutdown once it's a real database instead of disposable in-memory H2.
- Data now **survives restarts** (unlike H2). To reset to a clean slate: `DROP DATABASE <name>;` then re-run `init-postgres-databases.sql`.

The H2 console is disabled under this profile (`spring.h2.console.enabled=false`) since it's not applicable to a Postgres-backed run.

## 4b. Connecting to PostgreSQL on a different machine (e.g. running the platform on one laptop, DB on another)

Every service already reads its connection details from the environment
(`DB_URL`/`DB_USERNAME`/`DB_PASSWORD`, each falling back to a `localhost:5432` default — see
each service's `application-postgres.properties`/`.yml`), so nothing in the application code
needs to change to point at a remote database. `start-all.cmd` has a convenience mode that
builds the right per-service JDBC URL for you, since each service still owns its own database
(`lbos_platform`, `lbos_partner`, `lbos_commerce`, `lbos_order`, `lbos_fleet`, `lbos_finance` —
same six names as the local setup in §4a, just on a different host):

```cmd
scripts\start-all.cmd /dbhost:192.168.1.50 /dbusername:lbos_app /dbpassword:Correct-Horse-1
```

`/dbhost` implies `/postgres`. `/dbport` defaults to `5432`; `/dbusername`/`/dbpassword` default
to `postgres`/`postgres` (matching the local default) if omitted. Before running this:

1. **The six databases must already exist on the target server.** From any machine that can
   reach it: `"C:\Program Files\PostgreSQL\<version>\bin\psql.exe" -U postgres -h <that host> -p 5432 -f scripts\init-postgres-databases.sql` (or run the equivalent `CREATE DATABASE` statements by hand — see `scripts/init-postgres-databases.sql`).
2. **The target Postgres server must accept remote TCP connections** — by default a fresh
   install only trusts `127.0.0.1`/`::1` (see §4a). On the *database* machine, edit
   `postgresql.conf` (`listen_addresses = '*'`) and `pg_hba.conf` (add a `host` line for the
   application machine's IP/subnet with `md5` or `scram-sha-256` auth, not `trust`, since this
   is no longer loopback-only), then restart the Postgres service. Also confirm port 5432 (or
   whatever `/dbport` you're using) isn't blocked by a firewall between the two machines.
3. **Without the script**, the same thing can be done manually per service — each service needs
   its own `DB_URL` (note the different database name per service):
   ```bash
   cd S1-platform-territory
   DB_URL="jdbc:postgresql://192.168.1.50:5432/lbos_platform" DB_USERNAME=lbos_app DB_PASSWORD="Correct-Horse-1" \
     SPRING_PROFILES_ACTIVE=postgres ./mvnw spring-boot:run
   ```
   repeated for each of the six services with its own database name from the table in §4a, plus
   Eureka and the Gateway (neither needs `DB_*` — they have no database of their own).

### One shared database instead of six (managed/corporate PostgreSQL)

A managed or corporate PostgreSQL instance often hands you exactly **one** database and one
user with no `CREATE DATABASE` privilege — you can't create the other five databases the table
in §4a assumes. In that case, point every service at the *same* database instead:

```cmd
scripts\start-all.cmd /dbhost:10.23.240.29 /dbusername:my_db_user /dbpassword:my-password /dbname:my_single_db
```

`/dbname` overrides the per-service database name lookup so all six services' tables coexist
in that one database. This is safe: no two services' JPA entities share a table name (checked
across every entity in S1–S6 — the closest near-miss is S4's `Order` entity, which is
explicitly mapped to `orders`, not the reserved SQL keyword `order`). Nothing else about this
mode differs from the six-database setup — same `ddl-auto=update` behavior, same restart
persistence, same everything, just one database instead of six schemas' worth of isolation.

Without the script, the manual equivalent is passing the *same* `DB_URL` (pointing at your one
database) to every one of the six services instead of a different one each.

## 5. Configuration

No `.env` file is required for local/dev use — every property has a sensible default baked into each `application.properties`/`.yml`, overridable via environment variables:

| Variable | Used by | Default |
|---|---|---|
| `EUREKA_URL` | all services + Gateway | `http://localhost:8761/eureka/` |
| `JWT_SECRET` | S1, Gateway (must match on both) | a shared dev placeholder — **change this for anything beyond local training use** |
| `JWT_EXPIRATION_MINUTES` | S1 | `60` |
| `SERVICE_PASSWORD` | S1 (internal Basic-auth account `lbos-service`), S4 (must match S1's value) | `service123` |
| `CORS_ALLOWED_ORIGINS` | Gateway | `http://localhost:3000,http://localhost:5173` |
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | all six services, only when the `postgres` profile is active (§4a) | that service's own `jdbc:postgresql://localhost:5432/<db>` / `postgres` / `postgres` |

## 6. Starting everything (cmd.exe, recommended)

```cmd
:: From the repository root, in cmd.exe (or double-click the .cmd file directly):
scripts\start-all.cmd

:: Skip the pre-start build (faster restart when nothing changed):
scripts\start-all.cmd /skipbuild

:: Stop everything the above started:
scripts\stop-all.cmd

:: Build + run every test suite for all 8 modules, print a running summary, generate JaCoCo:
scripts\test-all.cmd

:: Run tests first, and only start the platform if everything passes:
scripts\start-and-test.cmd

:: Live smoke-test a running platform (Eureka, Gateway, one call per service):
scripts\test-api.cmd
:: or, with a real account to exercise the authenticated checks too:
scripts\test-api.cmd /email:you@example.com /password:your-password
```

`start-all.cmd` doesn't save a PID file - it launches each service via `start` (so the child
process correctly inherits every `DB_URL`/`JWT_SECRET`/`SPRING_PROFILES_ACTIVE` override this
script sets, which `wmic process call create` - the usual way to get a PID back - does not) and
`stop-all.cmd` finds them afterward by matching `java.exe` command lines against this repo's
path. It does not block, so your terminal is free immediately; tail `logs/<module>.log` to watch
startup progress.

## 7. Manual startup order (what the scripts do under the hood)

Eureka first; the six services and Gateway will retry registration if it's not up yet, but nothing routes correctly until it is. Add `SPRING_PROFILES_ACTIVE=postgres` (see §4a) before any service's `mvnw spring-boot:run` below to run it against real PostgreSQL instead of embedded H2 — make sure your local PostgreSQL server is running and `init-postgres-databases.sql` has been applied first.

```bash
# 1. Eureka Server
cd eureka-server && ./mvnw spring-boot:run

# 2. Each service (separate terminals), any order, though S4 benefits from S1/S3/S5 already being up
cd S1-platform-territory && ./mvnw spring-boot:run
cd S2-partner-verification && ./mvnw spring-boot:run
cd S3-commerce-customer && ./mvnw spring-boot:run
cd S4-order-logistics && ./mvnw spring-boot:run
cd S5-fleet-operations && ./mvnw spring-boot:run
cd S6-finance-support && ./mvnw spring-boot:run

# 3. Gateway last (or at least last-verified — routes 503 until their target registers)
cd api-gateway && ./mvnw spring-boot:run
```

Confirm everyone registered: `curl http://localhost:8761/eureka/apps` (or open `http://localhost:8761` in a browser for the dashboard) — you should see `LBOS-PLATFORM`, `LBOS-PARTNER`, `LBOS-COMMERCE`, `LBOS-ORDER`, `LBOS-FLEET`, `LBOS-FINANCE`, `LBOS-GATEWAY`.

## 8. Swagger / OpenAPI

Each service exposes its own Swagger UI directly (no Gateway aggregation was built — see known limitations):
- S1: `http://localhost:8081/swagger-ui.html`
- S2: `http://localhost:8082/swagger-ui.html`
- S3: `http://localhost:8083/swagger-ui.html`
- S4: `http://localhost:8084/swagger-ui.html`
- S5: `http://localhost:8085/swagger-ui.html`
- S6: `http://localhost:8086/swagger-ui.html`

`springdoc-openapi-starter-webmvc-ui` is on every service's classpath.

## 9. Login / JWT and signup flow

### Local training accounts

S1 seeds these development-only accounts (the full list is in `seed-data/credentials.md`):

| Role | Email | Password |
|---|---|---|
| SUPER_ADMIN | `admin@lbos.com` | `Lbos@2026!` |
| OPERATIONS_MANAGER | `op.ch@lbos.com` | `Lbos@2026!` |
| LOCATION_MANAGER | `lm1.chn@lbos.com` | `Lbos@2026!` |

These credentials are for local training only.

### Customer self-registration

Customers do not need an administrator to create their account.

```bash
curl -X POST http://localhost:8080/api/v1/auth/register/customer \
  -H "Content-Type: application/json" \
  -d '{"email":"newcustomer1@lbos.com","phoneNumber":"9876543210","password":"Customer@123","firstName":"Demo","lastName":"Customer"}'
```

The endpoint always creates the role `CUSTOMER`; the client cannot choose another role.

### Login

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"newcustomer1@lbos.com","password":"Customer@123"}'
```

The response contains `accessToken`, `userAccountId` and `role`.

Use the token on subsequent Gateway calls:

```bash
curl http://localhost:8080/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

The first authenticated S3 customer request automatically creates the customer's `CustomerProfile` if it does not already exist.

For a complete browser/Swagger workflow, use `docs/ECLIPSE_MANUAL_TESTING.md`.

## 10. Sample API calls

```bash
# List active cities (through the gateway, needs a valid token)
curl http://localhost:8080/api/v1/cities?active=true -H "Authorization: Bearer $TOKEN"

# Browse products (S3, through the gateway)
curl http://localhost:8080/api/v1/products -H "Authorization: Bearer $TOKEN"

# Direct-to-service call, bypassing the gateway (useful while developing one service in isolation)
curl http://localhost:8083/api/v1/products
```

See `api-catalog.md` for every endpoint's full request/response shape, and `api-tests/manual-api-test-cases.md` for complete worked scenarios including cross-service flows.

## 11. Testing commands

```bash
# All 8 modules at once (recommended):
scripts\test-all.cmd

# Any single service:
cd S1-platform-territory && ./mvnw test

# Just one test class:
./mvnw test -Dtest=JwtServiceTest

# Compile only (fast feedback):
./mvnw compile

# Generate/refresh a JaCoCo report for one module (report is bound to the `test` phase already,
# so `test` alone regenerates it — `clean test` guarantees a fresh one):
./mvnw clean test
# then open target/site/jacoco/index.html
```

Full per-module results are in `testing.md`.

## 12. Troubleshooting / common errors

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot access central (...) in offline mode` | First build with no cached dependencies and no network | Ensure internet access for the first `./mvnw compile`/`test` per module; after that it's cached in `~/.m2` |
| `Non-resolvable parent POM ... spring-boot-starter-parent:pom:4.1.1` | Same as above, or a corporate proxy blocking Maven Central | Configure a mirror/proxy in `~/.m2/settings.xml`, or pre-warm the `.m2` cache from a machine with access |
| `Schema validation: missing table [x]` on S1 startup | Flyway didn't run before Hibernate validated (an actual bug fixed during integration — confirm `spring-boot-starter-flyway`, not `flyway-core` alone, is on S1's classpath) | Rebuild after re-pulling the fixed `pom.xml` |
| `Unknown data type: "JSONB"` during a service's schema creation | An entity declared a literal Postgres-only `columnDefinition="jsonb"` (fixed in S4 during integration — see `changelog-integration.md`) | If you see this on a *new* entity someone adds, remove the literal `columnDefinition` and use `@JdbcTypeCode(SqlTypes.JSON)` instead, which is dialect-aware |
| `401 Unauthorized` on every Gateway call | Missing/expired `Authorization: Bearer` header, or `JWT_SECRET` differs between S1 and the Gateway | Re-login; ensure both services' `app.jwt.secret` match |
| Login succeeds (returns a token) but the *very next* request 401s, and the frontend immediately shows "session expired" for every user | `JWT_SECRET` differs somewhere across the 7 JWT-aware modules (S1–S6 + Gateway) — classic when config gets hand-edited per-machine (e.g. shipping to another laptop, switching to `-Postgres`) and the edit only touches some of the seven files | Every one of these modules now logs `JWT signing key fingerprint: <8 hex chars>` (a SHA-256 hash prefix, never the secret itself) on startup. Check every service's log for this line — **all seven must show the identical fingerprint**. The Gateway's is the one that matters most: it's the sole JWT validation point for the whole platform (downstream services trust its `X-User-Account-Id`/`X-User-Role` headers), so if only the Gateway's differs, every authenticated call fails right there before ever reaching a downstream service. Fix: set `JWT_SECRET` to the exact same value for all seven (or unset it everywhere and let all seven fall back to the identical default literal), then restart everything. |
| A service launched by `start-all.cmd` immediately logs `'mvnw.cmd' is not recognized as an internal or external command` | The Windows environment variable `NoDefaultCurrentDirectoryInExePath` is set, which stops `cmd.exe` from implicitly searching the current directory for an executable | Already fixed in `start-all.cmd`/`test-all.cmd` (uses `.\mvnw.cmd`, not a bare `mvnw.cmd`) — if writing your own launch command, always use an explicit relative/absolute path to `mvnw.cmd` |
| A `.cmd` script you're editing prints `'Tests' is not recognized...` (or similar) from a decorative `echo` banner line | An unescaped `|` in an `echo` line is parsed as a real pipe operator, not literal text - splits the line into several commands | Escape every literal `\|` in an `echo` statement as `^\|` |
| A `.cmd` script's control flow looks scrambled - a summary/label block prints once "early" with wrong data, then again correctly at the end | Line-ending mismatch: a batch file saved with LF-only line endings (no CR) can throw off cmd.exe's quote/paren-balance tracking in ways that don't error, just misbehave - confirmed live, traced to a `set` line building a JSON body with literal `\"` escapes | Save/convert every `.cmd` file to CRLF line endings. Also avoid literal `\"` in a `set "VAR=...\"...\""` line - build embedded quotes via a `set QUOTE="` variable (or, if the value is being passed as an argument to another program like curl, a `set BSQ=\%QUOTE%` backslash-quote pair) referenced through ordinary percent-expansion instead |
| S1 fails on startup under the `postgres` profile with `Migration checksum mismatch` | The target Postgres database already has a `flyway_schema_history` table from unrelated/older migrations with different file contents | Point S1 at a different, empty database (`DB_URL`), or if you're certain the existing history is disposable, resolve it directly with Flyway's `repair`/by dropping and recreating that database — never done automatically, since it could be real data |
| `403 Forbidden` on a Gateway call with a valid token | The token's role isn't in the allowed-role set for that route (see `architecture.md`'s `RouteAuthorizationRules` section, or `api-catalog.md` for the exact roles per endpoint) | Log in as a role that's actually permitted for that endpoint |
| `503 Service Unavailable` on a Gateway route right after startup | Spring Cloud LoadBalancer's service-instance cache hasn't refreshed yet (up to ~30s after a service registers) | Wait a few seconds and retry; this is expected transient behavior, not a bug |
| A downstream Feign call throws a generic `500` instead of `404`/`503` | Several services (S2, S5) have no global exception handler mapping generic `RuntimeException`/Feign failures to proper HTTP codes — pre-existing, documented gap | See `sql-jpa-discrepancy-report.md` / `architecture.md` known limitations |
| Ambiguous `assertEquals` compile error in a test you're adding | Boot 4.1.1's bundled JUnit adds an `assertEquals(Integer, int)` overload that can collide with `assertEquals(int, int)` for narrower numeric types (`short`, etc.) | Cast the literal to the narrower type, e.g. `assertEquals((short) 1, value)` |
| JaCoCo throws `Unsupported class file major version 68` while instrumenting | JaCoCo 0.8.12 predates Java 24 (class file major version 68); this JVM is Java 24 | Use JaCoCo **0.8.13+** (already pinned in every module's `pom.xml`) |

## 13. What was verified live, and what was not

**Update — PostgreSQL profile, live verification (native Windows install, no Docker):**
`scriptsstart-all.cmd /postgres` brought up all 8 processes against a real local PostgreSQL 17 server; all seven `LBOS-*` names showed `UP` in `GET /eureka/apps`; every one of the six databases had real tables after startup (S1 via Flyway, S2–S6 via Hibernate `ddl-auto=update` — see §4a for the full per-database table list). Also re-confirmed through the Gateway specifically under this profile: `GET /api/v1/products` direct-to-S3 → `200`; the same route through the Gateway with no token → `401`; `POST /api/v1/auth/login` with the seeded `admin@aroundu.local` account through the Gateway → `200` with a real JWT, issued from S1 now backed by real Postgres data (not H2). Note this session's auth hardening (JWT rolled out to S2–S6) happened after the "Verified live" note directly below was originally written — some of its specifics (e.g. S5's `/api/drivers` being callable with no token) predate that work and no longer hold; treat this update as the current state for anything auth-related.

**Verified live, all eight processes running together** (Eureka + all six services + Gateway) — from an earlier session, before JWT auth was rolled out past S1:
- All eight registered/served correctly; `GET /eureka/apps` showed all seven application entries UP simultaneously.
- Direct-to-service calls work (S3 `/api/v1/products` → 200, S5 `/api/drivers` → 200).
- The Gateway returns 401 for both of those same routes without a token.
- A login POST with a wrong password is correctly routed through the Gateway to S1 and returns S1's own 401.

**Verified via `./mvnw clean test` on every module, from its final normalized location, after all hardening changes** (this is the authoritative, most-recent verification — see `testing.md` for full detail): **all 8 modules build and pass their full test suites — 600 tests total, 0 failures, 0 errors.**

**NOT verified live in this session:**
- A complete *authenticated* happy-path request through the Gateway to a business endpoint end-to-end (no seeded demo account has a known usable password — see §9).
- A live `403` role-mismatch response through a running Gateway (verified at the unit-test level instead — `JwtAuthenticationGatewayFilterTest`, 8 tests covering the full role/route matrix).
- Live Feign call chains firing between services under real simultaneous traffic (verified at the mocked-unit-test level in every service's own suite, not via real HTTP calls between live instances in this session).
**The `postgres` profile (§4a) WAS verified live**, against a native Windows PostgreSQL 17 install (no Docker) — `scriptsstart-all.cmd /postgres` brought up all 8 processes (Eureka, all six services, Gateway), all seven `LBOS-*` names showed `UP` in `GET /eureka/apps`, and every one of the six databases has real tables created by the actual running services (`\dt` confirmed: S1's `city`/`state`/`operations_manager`/`location_manager`/`flyway_schema_history` via Flyway; S2's `retailer`/`fleet_owner`/`verification_queue`/`verification_document`; S3's `customer_profile`/`customer_cart`/etc.; S4's `orders`/`order_item`/`trip`/`logistics_booking_detail`; S5's `driver`/`vehicle`/`vehicle_assignment`/`fleet_expense`; S6's `payment_transaction`/`customer_refund`/`customer_invoice`/`audit_log`/`notifications` — all via Hibernate `ddl-auto=update`). Two issues were found and fixed in the process (both now reflected in this doc and in the scripts): S1's default Postgres database name collided with an unrelated pre-existing `lbos` database on this machine (renamed S1's target to `lbos_platform`, matching the other five services' naming), and S5's default profile sets the raw `spring.jpa.properties.hibernate.dialect` key rather than `spring.jpa.database-platform`, which needed overriding directly in its `postgres` profile too or Postgres connections kept resolving to `H2Dialect`.
