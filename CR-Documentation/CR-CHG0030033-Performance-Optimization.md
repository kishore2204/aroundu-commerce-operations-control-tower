# CHG0030033 — Performance Optimization Enhancements

> This CR has two iterations. **Iteration 1** (sections 1–12 below) covers the audit-logging rework, service timeouts, and the first round of S3/frontend caching — done while the shared database was unreachable, so nothing in it is measured. **[Iteration 2](#iteration-2--2026-09-22--retailerfleet-owner-profile-lookup-order-list-batching-database-indexes-and-connection-pooling)** (further down this document) covers a live-database investigation of the customer order, retailer/fleet-owner list, product/home and address-dropdown screens, and the changes made as a result — this time measured directly against the running PostgreSQL instance and the live application.

## 1. CR Overview

| Item | Detail |
| --- | --- |
| CR number | CHG0030033 |
| Title | Performance Optimization Enhancements |
| Purpose | Reduce response times, page-load time, database round-trips, service-to-service calls and unnecessary processing across the application |
| Main affected area | Audit logging (Angular interceptor + S6), S3 product/cart reads, S1–S6 and gateway timeouts and logging, Angular services (caching, duplicate requests) |

> **How performance was assessed.** The shared PostgreSQL server was not reachable from the development machine, so **nothing below was measured**. Every finding comes from reading the code, and every improvement is described as *what work is no longer done*, not as a percentage. No figures have been invented.

## 2. Understanding the CR

**What was requested**

Find and remove bottlenecks so the application responds faster and copes with more users: faster pages and APIs, fewer/lighter database queries, caching where it is safe, less wasted background processing.

**What was done** (details in sections 5–6)

| # | Area | Change |
| --- | --- | --- |
| A | **Audit logging** | An audit entry is written only for **important actions performed by internal roles**, instead of after **every** successful POST/PUT/PATCH/DELETE from **every** user |
| B | Service-to-service calls | Timeouts so one dead hop fails in seconds; S2/S3 pinned to `localhost` like the other services |
| C | S3 reads | Retailer summaries cached for 30 s; fetch-joined queries; no DB transaction wrapped around HTTP calls |
| D | Frontend | Short-lived caches for reference data, de-duplicated requests, a product-list effect that no longer fires twice |
| E | Logging | `show-sql` turned off in S2, S5, S6 |

## 3. Existing Problem

### 3.1 Audit logging (the main item)

The browser's `auditInterceptor` wrote an audit entry after **every** successful `POST`, `PUT`, `PATCH` or `DELETE` made by **any** logged-in user — customers adding to the cart, checkout steps, messages, uploads, retailer stock edits, driver updates, and so on. The original interceptor:

```ts
/** Records every successful portal mutation in S6's immutable audit log. */
export const auditInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
  const excluded = req.url.includes('/api/audit-logs') || req.url.includes('/api/v1/auth/login') ||
    req.url.includes('/api/v1/auth/forgot-password') || req.url.includes('/api/v1/auth/reset-password');
  return next(req).pipe(tap((event) => {
    if (!(event instanceof HttpResponse) || !mutation || excluded || !auth.isAuthenticated()) return;
    ...
    void fetch('/api/audit-logs', {
      method: 'POST',
      ...
        userAccountId, action: `${req.method.toUpperCase()} ${pathname}`.slice(0, 250),
```

Each such entry is an extra browser → gateway → S6 request, and in S6 it costs a **database insert plus a Feign lookup to S1** (`AuditLogServiceImpl.createAuditLog` checks the account). S6 also accepted the write from any authenticated role.

### 3.2 Other bottlenecks found by reading the code

| Problem | Where |
| --- | --- |
| A stuck or unreachable service caused pages to hang for minutes | Feign defaults (10 s connect / 60 s read) and no useful gateway timeouts; S2 and S3 did not pin their Eureka address to `localhost` although S1, S4, S5 and S6 already documented an unreachable registered address as the cause of hangs |
| Every product page, cart read and cart mutation made **one sequential S2 call per distinct retailer** | `RetailerEnrichmentSupport.resolveOne` |
| Cart read cost **1 + 2N** queries (each cart line lazily loaded its cart and its product) and each distinct product category on a page cost one lazy select | `CustomerCartItemRepository`, `ProductSpecifications` |
| Product search held a **database connection while making HTTP calls to S2** | `ProductDiscoveryServiceImpl.search` was `@Transactional` |
| 20+ requests per product page: each product card requested its own image list on every visit | `ProductService.images` |
| Product list requested **twice**, and paging jumped back to page 0 | `effect()` in `product-list.component.ts` re-ran on every page change |
| Categories and city/zone lists re-fetched on every visit | `CategoryService`, `TerritoryService` |
| Verification queue list: one request per row plus duplicate fleet-owner lookups | `queue-list.component.ts` |
| SQL echoed to the console | `spring.jpa.show-sql=true` in S2, S5, S6 |

## 4. Root Cause

- **Audit:** the interceptor had no notion of "which actions matter" or "who is being audited" — it treated *every* successful mutation as auditable, so audit volume grew with **all** traffic instead of with important internal actions.
- **Timeouts/hangs:** missing/loose time limits and an unreachable Eureka address, so one bad hop stalled a whole request chain.
- **N+1 patterns:** per-row lazy loads and per-retailer HTTP calls in loops.
- **Held resources:** a transaction spanning remote calls.
- **Repeated identical requests** for data that rarely changes, because the frontend had no cache and no de-duplication.

## 5. Solution

### 5.1 Audit logging — before and after

```text
Before:
Any user action (POST/PUT/PATCH/DELETE succeeded)
    ↓
Audit log request  →  Gateway  →  S6  →  Feign lookup in S1  →  Database insert

After:
Important action performed by an INTERNAL role  →  Audit log (one entry, business wording)
Any other action (customer, retailer, driver, reads, cart, checkout, messages, uploads …)
    →  NO audit request at all: no gateway hop, no S6 call, no S1 lookup, no database write
```

The interceptor now writes an entry only when **all** of these are true:

1. the call **succeeded** (`HttpResponse`) and was a mutation;
2. the caller has an **internal role**: `SUPER_ADMIN`, `OPERATIONS_MANAGER`, `LOCATION_MANAGER`, `SUPPORT_STAFF` (`INTERNAL_ROLES`);
3. the request is listed in a whitelist of **important / sensitive / state-changing operations** (`audit-events.ts`) — user and account changes, operations-manager and location-manager assignment/activation/transfer, territory (state/city/zone) changes, verification decisions and revocation, support-ticket assignment/escalation/resolution, refund and settlement decisions, tax and logistics-rate changes.

S6 enforces the same rule on the server: `POST /api/audit-logs` is accepted only from the internal roles. Because a filtered action never makes the request, it also never reaches S6's database insert or the S1 lookup.

The stored action is now the readable business action (e.g. *Activate Location Manager*, *Approve Fleet Owner*) instead of `POST /api/v1/...`; the technical detail stays only inside the detail JSON.

### 5.2 Everything else

```text
Timeouts:        Feign 3 s connect / 30 s read (S1–S6) · gateway 3 s connect / 60 s response
Eureka address:  S2, S3 pinned to localhost (as S1, S4, S5, S6)
S3 retailer summaries:  30 s in-memory cache (display-only data); "is the store open" stays live
S3 queries:      cart items fetch-joined with cart+product; product page fetch-joins category
S3 search:       no method-level transaction around S2 HTTP calls
Frontend:        TtlCache for categories (5 min), city/zone lists (2 min, cleared on writes), image lists (5 min)
                 product-list effect wrapped in untracked(); queue list de-duplicates lookups
Logging:         show-sql=false in S2, S5, S6
```

## 6. Implementation Details

### 6.1 Audit logging — Frontend

- **`core/auth/audit.interceptor.ts`** → rewritten to apply the three conditions above, and to build the stored entry from `resolveAuditEvent(...)`.
- **`core/api/audit-events.ts`** (new) → the whitelist `AUDITED_ACTIONS` (key = `METHOD normalized-path`, value = business action), `resolveAuditEvent`, and `AUDIT_SUBJECT` (lets a caller add context such as which kind of partner a verification decision concerns, giving *Approve Fleet Owner* / *Reject Driver*).
- **`core/models/user.model.ts`** → `INTERNAL_ROLES`.
- **`core/api/audit-action.util.ts`** → turns old stored rows (`POST /api/v1/...`) into readable text so the Audit Log screen and CSV export still read well; old rows are not deleted.
- **`verification-queue.service.ts` / `queue-detail.component.ts`** → pass the partner type to the interceptor for decision entries.

### 6.2 Audit logging — Backend (S6)

`config/SecurityConfig.java`: `POST /api/audit-logs` restricted from *any authenticated user* to the internal roles. The endpoint, the S6 service and the older rows remain; the backend `AuditRecorder` classes in S1/S2/S6 have no callers, so the interceptor is the only writer and one action is logged once.

### 6.3 Timeouts and addresses (S1–S6, gateway)

`application.properties` (every service) and gateway `application.yml`; see the code section.

### 6.4 S3

- **`RetailerEnrichmentSupport`** → `resolveOne` keeps a bounded (1000) map with a 30-second TTL; failed lookups are never cached; open-store availability (`openRetailerIds()`) is deliberately not cached.
- **`CustomerCartItemRepository`** → `findWithCartAndProductByCartCustomerId` (one query, fetch-joining cart and product); **`CartServiceImpl`** uses it.
- **`ProductSpecifications.fetchCategory()`** → fetch-joins the category for the page query but is skipped for the count query used by pagination; **`ProductDiscoveryServiceImpl.search`** uses it and is no longer `@Transactional`.
- **`CartServiceComprehensiveTest`** → updated to stub the new repository method.

### 6.5 Frontend caches

- **`core/api/ttl-cache.ts`** (new) → small cache: concurrent callers share one in-flight request, later callers within the TTL reuse the result, failures are dropped so the next call retries. Documented rule: never for user-specific or time-critical data (cart, checkout, orders, payments, stock, permissions, auth).
- **`category.service.ts`**, **`territory.service.ts`**, **`product.service.ts`** → use it; the territory cache is cleared on any city/zone create or (de)activate.
- **`product-list.component.ts`** → `untracked(...)`, so the effect depends only on the active address.
- **`queue-list.component.ts`** → in-flight de-duplication of subject lookups and one shared fleet-owner lookup per fleet.

## 7. Execution Flow

**Audit decision inside the interceptor**

```text
HTTP call finishes
   ├─ not a successful mutation ............................ stop
   ├─ user is not an internal role ......................... stop   (customer, retailer, fleet, driver)
   ├─ request not in AUDITED_ACTIONS ........................ stop   (cart, checkout, uploads, messages …)
   └─ internal role + listed action → POST /api/audit-logs (fire-and-forget, never delays the action)
```

**Example — customer adds to cart:** `POST /api/v1/cart/items` → not internal → no audit request. **Example — Operations Manager deactivates a Location Manager:** `PATCH …/location-managers/{id}/deactivate` → internal + listed → one entry "Deactivate Location Manager".

**Example — product page:** one cached retailer lookup per 30 s instead of one per request; category fetched in the same query; images cached per product; the list is requested once.

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Frontend | `core/auth/audit.interceptor.ts` | Only internal-role, whitelisted, successful mutations are audited |
| Frontend | `core/api/audit-events.ts` (new) | Whitelist and wording |
| Frontend | `core/models/user.model.ts` | `INTERNAL_ROLES` |
| Frontend | `core/api/audit-action.util.ts` | Readable wording for stored entries |
| Backend S6 | `config/SecurityConfig.java` | `POST /api/audit-logs` internal roles only |
| Config | `S1…S6 application.properties` | Feign timeouts; S2/S3 Eureka pinning; `show-sql=false` (S2, S5, S6) |
| Config | `api-gateway/src/main/resources/application.yml` | Connect / response timeouts |
| Service S3 | `RetailerEnrichmentSupport.java` | 30-second retailer-summary cache |
| Repository S3 | `CustomerCartItemRepository.java`, `ProductSpecifications.java` | Fetch joins |
| Service S3 | `CartServiceImpl.java`, `ProductDiscoveryServiceImpl.java` | Use them; no transaction around HTTP calls |
| Frontend | `core/api/ttl-cache.ts` (new), `product.service.ts`, `category.service.ts`, `territory.service.ts` | Caches |
| Frontend | `product-list.component.ts`, `queue-list.component.ts` | No duplicate requests |
| Tests | `CartServiceComprehensiveTest` | Updated for the new query |

## 9. Important Code Changes

### 9.1 Audit interceptor — after — `frontend/src/app/core/auth/audit.interceptor.ts`

```ts
export const auditInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const method = req.method.toUpperCase();
  const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  return next(req).pipe(tap((event) => {
    if (!(event instanceof HttpResponse) || !mutation || !auth.isAuthenticated()) return;
    const role = auth.role();
    if (!role || !INTERNAL_ROLES.includes(role)) return;
    const token = auth.accessToken();
    const userAccountId = auth.userAccountId();
    if (!token || !userAccountId) return;
    let pathname = req.url;
    try { pathname = new URL(req.url, window.location.origin).pathname; } catch {}
    const audit = resolveAuditEvent(method, pathname, req.body, req.context.get(AUDIT_SUBJECT));
    if (!audit) return;
    void fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        userAccountId, action: audit.action, sourceModule: audit.sourceModule, oldValues: null,
        // Technical detail stays here (internal use only); the screen shows just the action.
        newValues: JSON.stringify({ status: event.status, role, request: `${method} ${pathname}` }).slice(0, 250),
        ipAddress: null,
      }),
    }).catch(() => undefined);
  }));
};
```

Explanation: two early returns remove customers/partners and unlisted actions **before** any network call is made.

### 9.2 Internal roles — `frontend/src/app/core/models/user.model.ts`

```ts
/** Platform-internal roles - the only ones whose business actions are written to the audit log. */
export const INTERNAL_ROLES: Role[] = ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'LOCATION_MANAGER', 'SUPPORT_STAFF'];
```

### 9.3 Important actions only — `frontend/src/app/core/api/audit-events.ts`

```ts
const AUDITED_ACTIONS: Record<string, (request: AuditRequest) => string> = {
  // Users / accounts
  'POST user-accounts': () => 'Create User',
  'PUT user-accounts': () => 'Update User',
  'PATCH user-accounts/status': (r) => statusAction(field(r.body, 'accountStatus'), 'User'),
  'DELETE user-accounts': () => 'Delete User',
  ...
  // Location managers
  'POST location-managers': () => 'Assign Location Manager',
  'PATCH location-managers/activate': () => 'Activate Location Manager',
  'PATCH location-managers/deactivate': () => 'Deactivate Location Manager',
  ...
  // Verification (retailer / fleet owner / driver / vehicle applications)
  'POST verification-queues/process-result': (r) => decision(r, 'Verification'),
  'POST verification-queues/revoke': () => 'Revoke Approval',
  ...
  // Finance / operations decisions
  'POST customer-refunds/approve': () => 'Approve Refund',
  'POST settlements/complete': () => 'Complete Settlement',
  'POST tax-configurations': () => 'Create Tax Configuration',
};
```

```ts
export function resolveAuditEvent(method: string, pathname: string, body: unknown, subject: string | null): AuditEvent | null {
  const path = normalizedRequestPath(pathname);
  const build = AUDITED_ACTIONS[`${method.toUpperCase()} ${path}`];
  if (!build) return null;
  const module = path.split('/')[0].replace(/[-_]+/g, ' ').toUpperCase();
  return { action: build({ body, subject }), sourceModule: module };
}
```

Explanation: anything not in the table returns `null` and is not audited.

### 9.4 Server-side enforcement — `S6-finance-support/.../config/SecurityConfig.java`

Before:

```java
/* Portal actions from every authenticated role may append immutable audit entries.
 * GET audit-log access remains covered by the staff-only fallback below. */
.requestMatchers(HttpMethod.POST, "/api/audit-logs")
.authenticated()
```

After:

```java
/* Business-action audit entries are appended by INTERNAL roles only (customers/partners are
 * never audited - see the frontend audit interceptor). GET audit-log access remains
 * covered by the staff-only fallback below. */
.requestMatchers(HttpMethod.POST, "/api/audit-logs")
.hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER", "SUPPORT_STAFF")
```

### 9.5 What one audit write cost — `S6-finance-support/.../service/AuditLogServiceImpl.java`

```java
@Override public AuditLog createAuditLog(AuditLogRequest request) {
    AuditLog entity = new AuditLog();
    ...
    if (request.userAccountId() != null) {
        try {
            identityServiceClient.getUserAccount(request.userAccountId());
```

Explanation: each entry that used to be written for every action carried a Feign call to S1 plus a database insert; skipping the request skips both.

### 9.6 Timeouts and addresses — `application.properties` (S1–S6)

```properties
# Fail fast on service-to-service calls. Feign's defaults (10s connect / 60s read) let a single
# unreachable or slow dependency stall a whole request chain for minutes; a healthy local call
# answers in milliseconds, so these limits only ever cut off calls that were already stuck.
spring.cloud.openfeign.client.config.default.connect-timeout=3000
spring.cloud.openfeign.client.config.default.read-timeout=30000
```

S2 and S3 (matching S1/S4/S5/S6):

```properties
eureka.instance.prefer-ip-address=false
eureka.instance.hostname=localhost
```

S2, S5, S6:

```properties
spring.jpa.show-sql=false
```

`api-gateway/src/main/resources/application.yml`:

```yaml
httpclient:
  connect-timeout: 3000
  response-timeout: 60s
```

(Database connection settings are intentionally not repeated in this document; they live only in each service's `application.properties`.)

### 9.7 Retailer summary cache — `S3-commerce-customer/.../service/impl/RetailerEnrichmentSupport.java`

```java
private static final long SUMMARY_TTL_NANOS = TimeUnit.SECONDS.toNanos(30);
private static final int MAX_CACHED_SUMMARIES = 1_000;
...
public RetailerSummaryResponse resolveOne(UUID retailerId) {
    if (retailerId == null) {
        return null;
    }
    long now = System.nanoTime();
    CachedSummary cached = summaryCache.get(retailerId);
    if (cached != null && now < cached.expiresAtNanos()) {
        return cached.summary();
    }
    try {
        RetailerSummaryResponse fresh =
                feignCallSupport.call("lbos-partner", () -> partnerVerificationClient.get(retailerId));
        if (fresh != null) {
            if (summaryCache.size() >= MAX_CACHED_SUMMARIES) {
                summaryCache.clear();
            }
            summaryCache.put(retailerId, new CachedSummary(fresh, now + SUMMARY_TTL_NANOS));
        }
        return fresh;
    } catch (RuntimeException failure) {
        return null;
    }
}
```

### 9.8 Fetch joins — `S3-commerce-customer/.../repository`

`CustomerCartItemRepository.java`:

```java
@Query("select i from CustomerCartItem i join fetch i.cart c join fetch c.product where c.customer.id=:customerId")
List<CustomerCartItem> findWithCartAndProductByCartCustomerId(@Param("customerId") UUID customerId);
```

`ProductSpecifications.java`:

```java
public static Specification<Product> fetchCategory() {
    return (root, query, cb) -> {
        if (query != null && !Long.class.equals(query.getResultType()) && !long.class.equals(query.getResultType())) {
            root.fetch("category", jakarta.persistence.criteria.JoinType.INNER);
        }
        return null;
    };
}
```

### 9.9 No transaction around HTTP calls — `ProductDiscoveryServiceImpl.java`

```java
   * Deliberately NOT @Transactional: the S2 lookups above and below are HTTP calls, and a
   * method-level transaction would hold a pooled DB connection for their whole duration. The
   * query itself runs in the repository's own read-only transaction and fetches the category
   * eagerly (fetchCategory), so nothing is lazily loaded afterwards.
   */
  public PageResponse<ProductResponse> search(String q,Long cat,UUID retailer,Boolean stock,UUID zoneId,int p,int z){
```

### 9.10 Frontend TTL cache — `frontend/src/app/core/api/ttl-cache.ts`

```ts
export class TtlCache<K, V> {
  private readonly entries = new Map<K, { expiresAt: number; source: Observable<V> }>();
  ...
  get(key: K, load: () => Observable<V>): Observable<V> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.source;

    if (this.entries.size >= this.maxEntries) this.entries.clear();
    const source: Observable<V> = load().pipe(
      catchError((error) => {
        if (this.entries.get(key)?.source === source) this.entries.delete(key);
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.entries.set(key, { expiresAt: Date.now() + this.ttlMs, source });
    return source;
  }
```

Usage:

`product.service.ts`:

```ts
private readonly imageLists = new TtlCache<number, ProductImage[]>(5 * 60_000, 1000);
```

`category.service.ts`:

```ts
private readonly activeCategories = new TtlCache<'active', ProductCategory[]>(5 * 60_000);
```

`territory.service.ts` (cache, and cleared after a write):

```ts
private readonly lists = new TtlCache<string, SpringPage<City> | SpringPage<Zone>>(2 * 60_000);
...
return this.http.post<City>('/api/v1/cities', request).pipe(tap(() => this.lists.clear()));
```

### 9.11 Duplicate product-list request — `frontend/src/app/features/products/product-list/product-list.component.ts`

```ts
effect(() => {
  this.zone.activeAddress();
  untracked(() => {
    this.page.set(0);
    this.load();
  });
});
```

### 9.12 Queue list de-duplication — `frontend/src/app/features/location/queue-list/queue-list.component.ts`

```ts
private readonly lookupsInFlight = new Set<string>();
/** One fleet-owner request per owner, shared by every driver/vehicle row of that fleet (a fleet
 *  with 10 drivers used to cost 10 identical owner requests). Failed lookups are dropped so a
 *  later load retries them. */
private readonly ownerLookups = new Map<string, Observable<FleetOwner | null>>();
...
if (this.subjectNames()[entry.subjectId] || this.lookupsInFlight.has(entry.subjectId)) continue;
```

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| **Audit — who** | Every logged-in role | Internal roles only (`SUPER_ADMIN`, `OPERATIONS_MANAGER`, `LOCATION_MANAGER`, `SUPPORT_STAFF`) |
| **Audit — what** | Every successful POST/PUT/PATCH/DELETE (cart, checkout, uploads, messages, …) | Only whitelisted important / sensitive / state-changing actions |
| **Audit — per action cost** | Extra browser → gateway → S6 request, S1 lookup and DB insert for every mutation | Only for audited actions; everything else makes no audit request at all |
| **Audit — server** | S6 accepted the write from any authenticated user | S6 accepts it from internal roles only |
| **Audit — wording** | `POST /api/v1/...` | Business action (e.g. *Deactivate Location Manager*) |
| Dead-hop behavior | Up to Feign defaults (10 s / 60 s) and no useful gateway limits | 3 s connect / 30 s read (Feign); 3 s / 60 s (gateway) |
| S2, S3 addresses | Machine-dependent registered address | Pinned to `localhost` like the other services |
| Retailer lookups on product/cart pages | One S2 call per retailer per request | One per retailer per 30 s |
| Cart read | 1 + 2N queries | 1 query (fetch join) |
| Product search | DB connection held during S2 calls; extra select per category | No transaction around HTTP calls; category fetched with the page |
| Product images / categories / city-zone lists | Requested on every visit | Cached (5 / 5 / 2 minutes), one shared in-flight request |
| Product list | Two requests, paging reset to page 0 | One request, paging kept |
| Console | SQL echoed (S2, S5, S6) | Off |

## 11. Testing

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Customer adds to cart, checks out, edits profile | **No** `/api/audit-logs` request in the browser network tab |
| 2 | Retailer edits stock / adds a product | No audit request |
| 3 | Operations Manager deactivates a Location Manager | Exactly one audit request; Audit Log shows *Deactivate Location Manager* |
| 4 | Super Admin approves a fleet owner's verification | One entry: *Approve Fleet Owner* |
| 5 | Internal user only reads data (GET) | No audit request |
| 6 | A failed internal action (4xx/5xx) | No audit request |
| 7 | Call `POST /api/audit-logs` with a customer token | 403 from S6 |
| 8 | Open the Audit Log screen | Old rows still listed in readable wording; nothing deleted |
| 9 | Stop S2, open a product page | Page fails/degrades within seconds (timeouts) instead of hanging for minutes |
| 10 | Product page: watch network | One product list request per change; images requested once per product per 5 minutes |
| 11 | Open the same cart twice within 30 s | Retailer details not re-fetched from S2 |
| 12 | Create a city, open a city list | New city appears immediately (territory cache cleared on write) |
| 13 | Change page in the product list | Stays on the chosen page; one request |
| 14 | Retailer closes their store | Customer catalogue reflects it (open-store check is not cached) |

## 12. Final Result

Audit logging now scales with **important internal actions** instead of with all application traffic, and S6 enforces it. Alongside it, repeated remote calls, N+1 queries, duplicate frontend requests and open-ended timeouts were removed. The improvements are expected from the reduced work per request; they have not been measured, and no percentages are claimed.

---

# Iteration 2 — 2026-09-22 — Retailer/Fleet-Owner Profile Lookup, Order-List Batching, Database Indexes, and Connection Pooling

## CR Overview (Iteration 2)

| Field | Details |
| --- | --- |
| CR Number | CHG0030033 |
| CR Title | Performance Optimization Enhancements — Iteration 2 |
| Main Areas | Retailer/Fleet-Owner "my profile" lookup (S2), Retailer's own orders page and Fleet Manager's delivery-assignment queue (frontend), database indexes (S2, S3, S4, S5 entities), HikariCP pool configuration (S1–S6) |
| Purpose | Remove confirmed duplicate/unbatched HTTP requests and full-table-scan lookups, add indexes for columns proven (by reading the actual queries) to be filtered/joined without one, and make connection-pool sizing explicit and evidence-based — all without changing any authorization rule, business rule, or response shape an existing screen already relies on |

This iteration was investigated with the full application stack running against the live PostgreSQL instance (unlike iteration 1), so it includes direct database and browser-network evidence in addition to source-code review.

## 1. Understanding the CR (Iteration 2)

**What users experienced.** Retailer and fleet-owner screens (dashboard, orders, profile, onboarding) all depend on first resolving "my own" retailer/fleet-owner profile; the retailer's own incoming-orders page and the fleet manager's delivery-assignment queue both showed a product summary per order.

**Why performance matters here.** "My profile" resolution happens on essentially every retailer/fleet-owner page load, so its cost is paid constantly, not just on one screen; the orders/assignments pages are worked from directly by retailers and fleet managers throughout the day.

**What the CR was intended to improve**, using the same wording the request was given in:

```text
Order page
View All Orders
Retailer view/list
Fleet Owner view/list
Product/home display
Address dropdown
Caching behaviour
Database pooling
Unnecessary API/database/inter-service work
```

**What was explicitly not supposed to change:** the multi-retailer order model, checkout/payment flow, product ownership, address ownership, role/zone authorization, or the existing "is this shop open right now" business rule — and no UUID/internal database id was to be newly exposed to the browser.

## 2. Existing Problem

### 2.1 Retailer/Fleet-Owner "my profile" full scan

`RetailerService.resolveMine()` and `FleetOwnerService.resolveMine()` (frontend) had no endpoint to fetch "the retailer/fleet-owner that belongs to me" directly, so they listed **every** retailer/fleet-owner on the platform and filtered by `userAccountId` in the browser — confirmed by the code's own comment ("There is no 'get my retailer profile' endpoint … resolves 'mine' by listing everyone and filtering client-side").

```text
Retailer logs in
        ↓
RetailerService.resolveMine()
        ↓
GET /api/retailers  (every retailer row, whole table)
        ↓
Filter the array in the browser for one matching userAccountId
```

### 2.2 Retailer orders page: one request per order

`features/retailer/orders/orders.component.ts` fetched the retailer's own orders, then called `orderService.itemsForOrder(order.id)` **once per order** inside a `forkJoin`, even though a batched `itemsForOrders(orderIds)` endpoint already existed and was already used by the customer's own order list for the same purpose.

```text
Retailer opens "Orders"
        ↓
GET /api/orders/mine?retailerId=...
        ↓
For each order returned: GET /api/order-items/by-order/{id}
        ↓
N orders → N extra requests, none of them reusing the existing batched endpoint
```

### 2.3 Fleet assignments queue: one request per order (retail orders)

`features/fleet/assignments/assignments.component.ts` did the same thing for its pending-assignment queue: one `orderService.itemsForOrder(order.id)` call per RETAIL-type order, to build the pickup/weight summary shown on each assignment card. (FLEET_SERVICE-type orders already call `logisticsBookingService.get(order.id)` once per booking — there is no batched equivalent for that lookup, so this part is unchanged; see Section 3.)

### 2.4 No indexes on the columns actually filtered/joined

Reading every relevant entity (`Retailer`, `FleetOwner`, `Driver`, `Vehicle`, `Order`, `OrderItem`, `Product`, `CustomerAddress`) and the repository methods that query them showed **no `@Table(indexes = ...)`** anywhere in S2, S3, S4 or S5, and no Flyway/SQL migration exists in any of them — the schema is whatever Hibernate's `ddl-auto=update` auto-generates, which only indexes primary keys and declared `@UniqueConstraint`s. Columns confirmed to be filtered or joined on without an index: `retailer.user_account_id/city_id/zone_id/retailer_status/business_name`, the same five on `fleet_owner`, `driver.fleet_owner_id`, `vehicle.fleet_owner_id`, `orders.customer_profile_id`, `orders.order_status` + `orders.updated_datetime` together, `order_item.order_id` and `order_item.retailer_id`, `products.category_id` and `products.status`, `customer_address.customer_profile_id`.

### 2.5 HikariCP left at implicit defaults across six services on one database

None of S1–S6's `application.properties` set any `spring.datasource.hikari.*` property — every service ran on Spring Boot's/HikariCP's built-in defaults (`maximum-pool-size=10`, `minimum-idle` defaulting to the same value as `maximum-pool-size`). Queried directly against the running PostgreSQL instance:

```text
select application_name, state, count(*) from pg_stat_activity group by application_name, state;

 PostgreSQL JDBC Driver | idle | 60
```

Six services × 10 minimum-idle connections each = 60 connections held open **at rest, with no user traffic**, against a server-side `max_connections` of 100 (confirmed with `show max_connections;`).

## 3. Root Cause

**Confirmed root causes** (each traced to the actual code/configuration):

- 2.1 — no "get my own profile" endpoint existed on either `RetailerController` or `FleetOwnerController`; the only reachable list endpoint (`GET /api/retailers` / `GET /api/fleet-owners`) returns every row via a plain `findAll()`.
- 2.2 / 2.3 — the retailer-orders and fleet-assignments components were written before (or without reusing) the batched `itemsForOrders(orderIds)` endpoint that the customer order list already uses; each simply looped over its own order list.
- 2.4 — no `@Table(indexes = ...)` was ever declared on these entities, and `ddl-auto=update` never adds one that is not declared in code.
- 2.5 — `spring.datasource.hikari.*` was never set in any of the six services, so each independently took the framework default without anyone having sized the pool for a *shared* six-service database.

**Architectural limitation or possible future concern (not fixed this iteration, and not claimed to be):**

- `S2-partner-verification`'s `/api/location-dashboard/**` endpoint is already paginated, already pushes its search/status/zone filters into one `Specification`-based query, and already batches its account/rating/verification-queue lookups per page rather than per row — but `SecurityConfig.java` restricts it to `hasRole("LOCATION_MANAGER")` only. That role's "zone" is resolved server-side from the caller's own JWT, so opening the same endpoint to `SUPER_ADMIN`/`OPERATIONS_MANAGER` is **not** a one-line role change — it would need the service layer to accept "all zones of a city" or "the whole platform" as a caller identity in addition to "my own zone," which is a real design change, not a smallest-safe-fix. This is why `GET /api/retailers`/`GET /api/fleet-owners` (the endpoints admin/ops end up using) remain unpaginated in this iteration; the `/me` fix in Section 4 addresses the specific, confirmed, high-frequency cost (every retailer/fleet-owner session resolving its own profile) without touching this larger, riskier change.
- `TripService.toDto()` (S4, backs `GET /api/trips*`) and `OrderItemService.toDto()`/`getAll()`/`getByOrderId()` (S4) both make per-row Feign calls — this is already self-documented in the source as an accepted trade-off ("getAll() now issues up to 3 extra Feign calls per row (N+1)... intentionally not fixed"). Neither backs the order list or the two components changed in this iteration, so they were left untouched.
- `GET /api/orders` and `OrderService.getAll()` (S4) use an unpaginated `findAll()` — confirmed in code, but the corresponding frontend method (`OrderService.listAll()`) has no caller anywhere in the built Angular application, so this endpoint is not contributing to any screen's reported slowness today. Left unpaginated; flagged here so it is paginated before any admin "view all orders" screen is built against it.
- `RetailerEnrichmentSupport.openRetailerIds()` (S3) is **deliberately** not cached — its own comment states that a stale "open" answer must never let a customer order from a closed store. This was read, understood, and left exactly as-is; it is a business-rule decision, not a performance oversight, and this CR does not weaken it.

## 4. Solution

### 4.1 "My profile" — direct lookup instead of list-and-filter

```text
Retailer logs in
        ↓
RetailerService.resolveMine()
        ↓
GET /api/retailers/me  (one row, looked up by the caller's own userAccountId)
        ↓
Cached in the existing per-session `myRetailer` signal, same as before
```

`GET /api/retailers/me` and `GET /api/fleet-owners/me` reuse the service methods (`getRetailerByUserAccountId` / `getFleetOwnerByUserAccountId`) that already existed and were already used by the internal, service-to-service controllers — nothing new was added to the service layer, only a browser-reachable controller method that calls the same method with the caller's own JWT-derived id.

### 4.2 Order-item lookups — batched, not per order

```text
Retailer/Fleet manager opens the orders/assignments screen
        ↓
Orders are fetched (unchanged)
        ↓
ONE GET /api/order-items/by-orders?ids=1,2,3,... for every order on the screen
        ↓
Line items are grouped back to their order in the browser (a Map keyed by orderId)
        ↓
Each row renders its own product summary from the grouped result
```

This is the exact pattern the customer's own order list (`order-list.component.ts`) already used; the retailer-orders and fleet-assignments components were changed to call the same existing `itemsForOrders()` method instead of looping `itemsForOrder()`.

### 4.3 Indexes — only on columns a real query filters or joins on

No new query was written to justify an index; every index added matches a `WHERE`, `JOIN`, or `ORDER BY` column already present in an existing repository method or `Specification`, found by reading the repository/specification code directly (see Section 5, "Database / Query Behavior"). Where a column was already covered by an existing unique constraint's leading column (`products.retailer_id`, covered by `uq_product_retailer_sku`), no duplicate index was added.

### 4.4 Connection pool — made explicit, not enlarged

```text
Before: spring.datasource.hikari.* unset on all 6 services
        → each takes the framework default (max=10, min-idle=10)
        → 6 × 10 = 60 connections held open at idle, out of 100 available

After:  maximum-pool-size explicitly set to 10 (same value - no evidence justified raising it)
        minimum-idle explicitly lowered to 2
        leak-detection-threshold added (diagnostic only)
        → an idle service now holds 2 connections instead of 10, freeing headroom,
          with the same peak capacity (10) available under load
```

## 5. Implementation Details

### Frontend

| File | What changed | Why | How it works |
| --- | --- | --- | --- |
| `frontend/src/app/core/services/retailer.service.ts` | `resolveMine()` now calls `GET /api/retailers/me` instead of `GET /api/retailers` + client-side `.find()` | The list-and-filter approach scales with the number of retailers on the whole platform; the new endpoint is a single indexed row lookup | A 404 (no profile yet) is caught and resolved to `null`, matching the old "not found in the list" behaviour exactly; the existing `myRetailer` signal cache is unchanged |
| `frontend/src/app/core/services/fleet-owner.service.ts` | Same change, mirrored for fleet owners | Same reasoning | Same 404-to-`null` handling; `myFleetOwner` signal unchanged |
| `frontend/src/app/features/retailer/orders/orders.component.ts` | Replaced the per-order `forkJoin(orders.map(o => itemsForOrder(o.id)))` with one `itemsForOrders(orderIds)` call, grouped by `orderId` in a `Map`; extracted a `toRow()` helper | N orders were producing N extra HTTP requests for data obtainable in one | Mirrors `order-list.component.ts`'s existing grouping pattern; the retailer never sees another retailer's items because `orderIds` still comes only from that retailer's own `mineForRetailer()` result |
| `frontend/src/app/features/fleet/assignments/assignments.component.ts` | The RETAIL-type per-order `itemsForOrder()` call was replaced with one `itemsForOrders()` call for all RETAIL orders on the queue; the FLEET_SERVICE-type per-order `logisticsBookingService.get()` call is unchanged (no batched equivalent exists) | Same N+1 pattern as 2.3, for the subset where a batched endpoint was actually available | Same grouping-by-`orderId` approach as the retailer-orders fix |
| `frontend/src/app/features/fleet/drivers/drivers.component.html` / `.ts` | Added `trackBy: trackByDriverId` to the driver table's `*ngFor` | The list had no `trackBy`, so Angular could not tell an unchanged row from a new one on re-render | `trackByDriverId` returns `driver.driverId`, the entity's own stable id |
| `frontend/src/app/features/fleet/vehicles/vehicles.component.html` / `.ts` | Same change for the vehicle table | Same reasoning | `trackByVehicleId` returns `vehicle.vehicleId` |

### Backend

| File | What changed | Why | How it works |
| --- | --- | --- | --- |
| `S2-partner-verification/.../controller/RetailerController.java` | Added `GET /api/retailers/me` | Gives the frontend a direct lookup instead of forcing it to list everyone | Resolves the caller's `userAccountId` from the JWT (`resolveAuthenticatedUserAccountId`, already used elsewhere in the same controller) and calls the existing `retailerService.getRetailerByUserAccountId(...)` |
| `S2-partner-verification/.../controller/FleetOwnerController.java` | Added `GET /api/fleet-owners/me`, same shape | Same reasoning, fleet owners | Calls the existing `service.getFleetOwnerByUserAccountId(...)` |

No new service-layer or repository methods were added — both new endpoints call service methods that already existed and were already exercised by the internal (`/internal/v1/...`) controllers used for service-to-service lookups. No route-authorization change was needed: `/api/retailers/**` and `/api/fleet-owners/**` were already open to the RETAILER/FLEET_MANAGER roles at the API Gateway, and that wildcard already covers the new `/me` path.

### Database / Query Behavior

No query logic changed. Pagination was already correct where it existed (`ProductDiscoveryServiceImpl.search()` already uses `Pageable` and a `JOIN FETCH`-based `Specification`; `AddressController.list()` already returns a `PageResponse`) — this iteration did not touch either. `GET /api/retailers`/`GET /api/fleet-owners` remain unpaginated `findAll()` calls (see Section 3's architectural-limitation note); they were not rewritten this iteration.

Indexes added (via `@Table(indexes = ...)` on the entity, applied automatically by each service's existing `spring.jpa.hibernate.ddl-auto=update` on restart, and confirmed created by querying `pg_indexes` directly against the running database):

| Table | Index | Column(s) | Matches |
| --- | --- | --- | --- |
| `retailer` | `idx_retailer_user_account_id` | `user_account_id` | `RetailerServiceImpl.getRetailerByUserAccountId` — now also `GET /api/retailers/me` |
| `retailer` | `idx_retailer_city_id`, `idx_retailer_zone_id`, `idx_retailer_status`, `idx_retailer_business_name` | as named | `findByCityId`, `findByZoneIdAndRetailerStatus`, `findByRetailerStatus`, `findByBusinessNameContainingIgnoreCase` |
| `fleet_owner` | `idx_fleet_owner_user_account_id`, `idx_fleet_owner_city_id`, `idx_fleet_owner_zone_id`, `idx_fleet_owner_owner_status`, `idx_fleet_owner_profile_status`, `idx_fleet_owner_business_name` | as named | The equivalent `FleetOwnerRepository`/`FleetOwnerServiceImpl` methods |
| `driver` | `idx_driver_fleet_owner_id` | `fleet_owner_id` | `DriverRepository.findByFleetOwnerId` |
| `vehicle` | `idx_vehicle_fleet_owner_id` | `fleet_owner_id` | `VehicleRepository.findByFleetOwnerId` |
| `orders` | `idx_orders_customer_profile_id` | `customer_profile_id` | `OrderRepository.findByCustomerProfileId` (backs `GET /api/orders/mine`) |
| `orders` | `idx_orders_status_updated_datetime` | `order_status, updated_datetime` (composite) | `findByOrderStatusAndUpdatedDatetimeBefore` (the 60-second `RetailerResponseTimeoutJob` scan) and, via the leading column, `findByOrderStatus`/`findByOrderStatusIn` |
| `order_item` | `idx_order_item_order_id` | `order_id` | Every `findByOrder_Id`/`findByOrder_IdIn` call, including `itemsForOrders()`'s backing query |
| `order_item` | `idx_order_item_retailer_id` | `retailer_id` | `findDistinctOrderIdsByRetailerId` (backs the retailer's own order list) |
| `products` | `idx_products_category_id`, `idx_products_status` | as named | `ProductSpecifications.categoryId`/`status`, filtered on every customer product search |
| `customer_address` | `idx_customer_address_customer_profile_id` | `customer_profile_id` | `CustomerAddressRepository.findByCustomerIdOrderByIdAsc` (backs the header address dropdown) |

`products.retailer_id` was **not** given a new index: it is already the leading column of the existing `uq_product_retailer_sku` unique constraint on `(retailer_id, sku)`, and a query that filters on that leading column alone can already use that index — adding a second, separate index on the same column would only add write overhead with no read benefit.

### Connection Pooling

Every one of S1–S6's `application.properties` set `spring.datasource.url`/`username`/`password`/`driver-class-name` but **no `spring.datasource.hikari.*` property at all** before this iteration — confirmed by reading all six files directly. That means every service ran on Spring Boot's HikariCP auto-configuration defaults: `maximum-pool-size=10`, and `minimum-idle` defaulting to the same value as `maximum-pool-size` (HikariCP's own default when `minimum-idle` is left unset).

Evidence gathered directly against the running PostgreSQL instance (query text and result, no credentials shown):

```text
show max_connections;               →  100
select count(*) from pg_stat_activity;                         →  73 total connections
select application_name, state, count(*) from pg_stat_activity
  group by application_name, state;  →  60 idle "PostgreSQL JDBC Driver" connections
```

60 of the server's 100 allowed connections were held open by the six services **while idle, with no user traffic** — leaving 40 of headroom for actual request bursts plus any other tool connected to the same database (e.g. pgAdmin). There was **no evidence of pool exhaustion or connection-wait errors** at the traffic levels exercised during this investigation, so `maximum-pool-size` was **not** raised — raising it without that evidence risks overloading PostgreSQL instead of helping, per this CR's own constraint against blind increases. What was changed:

```properties
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=2
spring.datasource.hikari.leak-detection-threshold=30000
```

added identically to all six services' `application.properties`, right after the existing `spring.datasource.driver-class-name` line. `maximum-pool-size` keeps the same value the default already provided (made explicit for future operability, not changed); `minimum-idle` is lowered so an idle service releases connections back to PostgreSQL instead of permanently holding ten; `leak-detection-threshold` is new and purely diagnostic (it only logs a warning if a connection is held far longer than any real query here should take — it changes no behaviour for correct code).

Measured after restarting all six services with the new settings:

```text
select application_name, state, count(*) from pg_stat_activity
  group by application_name, state;  →  15 idle "PostgreSQL JDBC Driver" connections
                                        (down from 60, with maximum-pool-size unchanged)
```

## 6. Caching Behavior and Another-PC Behavior

No new cache was introduced in this iteration — the change was to what the *existing* per-session profile signal is fed by, not to add a caching layer. For completeness, the existing behaviour of that signal is documented here since it is the cache most directly touched by Section 4.1:

| Cached Data | Cache Location | TTL | Scope | Invalidation | Browser Refresh | Another PC |
| --- | --- | --- | --- | --- | --- | --- |
| The caller's own retailer profile | `RetailerService.myRetailer` — an Angular `signal`, in a root-provided (singleton) service | None (holds the last value for the life of the browser tab) | One browser tab / application session | Overwritten whenever `register()`, `get()`, or `update()` resolves; **not** proactively invalidated if the row changes from another session | Reset to empty — a full page load creates a new service instance and an empty signal | Independent per browser/PC; a fresh session on another machine starts empty and calls `GET /api/retailers/me` itself |
| The caller's own fleet-owner profile | `FleetOwnerService.myFleetOwner` — identical shape | Same | Same | Same | Same | Same |

**A. Same browser/navigation.** The signal survives route navigation within the same tab because the service is `providedIn: 'root'` — Angular creates it once and every component that injects `RetailerService`/`FleetOwnerService` shares the same instance and the same signal value, so navigating between retailer screens does not re-trigger `GET /api/retailers/me` once it has resolved once.

**B. Browser refresh.** A full page reload destroys the whole Angular application and recreates every service, so the signal starts empty again and the next `resolveMine()` call makes a fresh request. This is expected, not a defect — there is no `localStorage`/`sessionStorage` backing for this signal.

**C. Another PC.** Because the signal is pure in-memory JavaScript state scoped to one browser tab, a session on a different computer (or even a different browser on the same computer) starts with its own empty signal and resolves its own profile independently via the same `GET /api/retailers/me` call, authenticated by that session's own JWT. Nothing about this mechanism depends on a machine-specific path, a hardcoded URL, or any state left behind by another machine.

**D. Multi-user safety.** `GET /api/retailers/me` and `GET /api/fleet-owners/me` both resolve the profile strictly from the caller's own JWT-derived `userAccountId` — there is no client-supplied id in the request, so one retailer's session can never resolve another retailer's profile, and the signal that caches the result is itself per-browser-tab, never shared between two logged-in sessions even on the same machine.

No server-side or shared/distributed cache exists anywhere in this iteration's changes — no Redis or equivalent was introduced, and none is claimed.

## 7. Execution Flow

**Retailer/Fleet-owner "my profile" resolution**

```text
1. Retailer/fleet-owner logs in and opens any screen that needs "my profile."
2. RetailerService.resolveMine() checks the in-memory `myRetailer` signal.
3. If empty (first call this session): GET /api/retailers/me.
4. Gateway routes /api/retailers/** to S2 (unchanged route).
5. RetailerController.getMyRetailer() resolves the authenticated userAccountId from the JWT
   and calls the existing retailerService.getRetailerByUserAccountId(...).
6. One indexed row lookup (idx_retailer_user_account_id) returns the profile, or 404 if none exists.
7. The frontend stores the result (or null, on 404) in the `myRetailer` signal for the rest of the session.
```

**Retailer's own orders page**

```text
1. Retailer opens "Orders."
2. resolveMine() resolves the retailer profile (as above).
3. GET /api/orders/mine?retailerId=... returns the retailer's own orders (unchanged endpoint).
4. ONE GET /api/order-items/by-orders?ids=... is issued for every order id returned in step 3.
5. Line items are grouped back to their order in the browser and rendered as a product summary per row.
```

**Fleet manager's delivery-assignment queue**

```text
1. Fleet manager opens "Delivery Requests" (assignments).
2. The pending-assignment order list is fetched (unchanged).
3. RETAIL-type orders: ONE batched GET /api/order-items/by-orders?ids=... for all of them.
4. FLEET_SERVICE-type orders: one GET per logistics booking (unchanged - no batch endpoint exists).
5. Each card renders its pickup/weight summary from whichever of steps 3/4 supplied its data.
```

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Backend S2 | `S2-partner-verification/.../controller/RetailerController.java` | Added `GET /api/retailers/me` |
| Backend S2 | `S2-partner-verification/.../controller/FleetOwnerController.java` | Added `GET /api/fleet-owners/me` |
| Backend S2 | `S2-partner-verification/.../entity/Retailer.java` | Added 5 indexes |
| Backend S2 | `S2-partner-verification/.../entity/FleetOwner.java` | Added 6 indexes |
| Backend S3 | `S3-commerce-customer/.../entity/Product.java` | Added 2 indexes |
| Backend S3 | `S3-commerce-customer/.../entity/CustomerAddress.java` | Added 1 index |
| Backend S4 | `S4-order-logistics/.../entity/Order.java` | Added 1 index + 1 composite index |
| Backend S4 | `S4-order-logistics/.../entity/OrderItem.java` | Added 2 indexes |
| Backend S5 | `S5-fleet-operations/.../entity/Driver.java` | Added 1 index |
| Backend S5 | `S5-fleet-operations/.../entity/Vehicle.java` | Added 1 index |
| Config | `S1-platform-territory/.../application.properties` (and the same file in S2–S6) | Explicit HikariCP `maximum-pool-size`/`minimum-idle`/`leak-detection-threshold` |
| Frontend | `frontend/src/app/core/services/retailer.service.ts` | `resolveMine()` uses `GET /api/retailers/me` |
| Frontend | `frontend/src/app/core/services/fleet-owner.service.ts` | `resolveMine()` uses `GET /api/fleet-owners/me` |
| Frontend | `frontend/src/app/features/retailer/orders/orders.component.ts` | Batched order-item fetch |
| Frontend | `frontend/src/app/features/fleet/assignments/assignments.component.ts` | Batched order-item fetch for RETAIL orders |
| Frontend | `frontend/src/app/features/fleet/drivers/drivers.component.html` / `.ts` | Added `trackBy` |
| Frontend | `frontend/src/app/features/fleet/vehicles/vehicles.component.html` / `.ts` | Added `trackBy` |
| Test | `S2-partner-verification/.../validation/BusinessIdentifierRulesTest.java` | Pre-existing test file re-run (unaffected by this iteration; listed here only because it was verified green after the entity change in the same module) |

## 9. Important Code Changes

### 9.1 New "my profile" endpoint — `S2-partner-verification/src/main/java/com/example/lbos/controller/RetailerController.java`

```java
@GetMapping("/me")
@Operation(summary = "Get my retailer profile", description = "Retrieves the retailer profile owned by the authenticated user")
@ApiResponse(responseCode = "200", description = "Successful operation")
@ApiResponse(responseCode = "404", description = "The authenticated user has no retailer profile")
public ResponseEntity<RetailerDTO> getMyRetailer(Authentication authentication) {
    UUID authenticatedUserAccountId = resolveAuthenticatedUserAccountId(authentication);
    return ResponseEntity.ok(retailerService.getRetailerByUserAccountId(authenticatedUserAccountId));
}
```

What it does: resolves the caller's own `userAccountId` from the JWT (the same helper the controller's existing ownership checks already use) and calls the service method that already existed for the internal, service-to-service lookup. How correctness is preserved: the id comes only from the caller's own token, never from a request parameter, so this can only ever return the caller's own profile.

### 9.2 Frontend switched from list-and-filter to direct lookup — `frontend/src/app/core/services/retailer.service.ts`

```ts
resolveMine(): Observable<Retailer | null> {
  const userAccountId = this.auth.userAccountId();
  if (this.myRetailer() && this.myRetailer()?.userAccountId === userAccountId) {
    return of(this.myRetailer());
  }
  return this.http.get<Retailer>('/api/retailers/me').pipe(
    tap((retailer) => this.myRetailer.set(retailer)),
    catchError((err) => (err?.status === 404 ? of(null) : throwError(() => err))),
  );
}
```

What it does: calls the new single-row endpoint instead of `GET /api/retailers` + `.find()`. Why it improves performance: the request no longer scales with the total number of retailers on the platform. How correctness is preserved: a 404 (no profile yet, e.g. straight after registration) resolves to `null`, exactly matching the old "not found in the array" outcome — every existing caller of `resolveMine()` sees the same `Retailer | null` contract as before.

### 9.3 Batched order-item fetch — `frontend/src/app/features/retailer/orders/orders.component.ts`

```ts
this.orderService.mineForRetailer(retailer.retailerId).pipe(
  switchMap((orders) => {
    if (orders.length === 0) return of([] as OrderRow[]);
    // ONE request for the items of every order (never one per order, per order-list.component.ts's pattern)
    return this.orderService.itemsForOrders(orders.map((order) => order.id)).pipe(
      map((allItems): OrderRow[] => {
        const itemsByOrder = new Map<number, OrderItem[]>();
        for (const item of allItems) itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
        return orders.map((order) => this.toRow(order, itemsByOrder.get(order.id) ?? []));
      }),
      catchError(() => of(orders.map((order): OrderRow => ({ ...order, productSummary: 'Could not load order items' })))),
    );
  }),
)
```

What it does: replaces a `forkJoin` of one `itemsForOrder()` call per order with a single `itemsForOrders()` call, grouping the combined result back to each order by `orderId`. Why it improves performance: N orders now cost 1 request instead of N. How correctness is preserved: `orderIds` is still derived only from `mineForRetailer(retailer.retailerId)`'s own result, so a retailer can never request another retailer's line items through this path.

### 9.4 Database indexes — representative examples

`S2-partner-verification/src/main/java/com/example/lbos/entity/Retailer.java`:

```java
@Entity
@Table(name = "retailer", indexes = {
        @Index(name = "idx_retailer_user_account_id", columnList = "user_account_id"),
        @Index(name = "idx_retailer_city_id", columnList = "city_id"),
        @Index(name = "idx_retailer_zone_id", columnList = "zone_id"),
        @Index(name = "idx_retailer_status", columnList = "retailer_status"),
        @Index(name = "idx_retailer_business_name", columnList = "business_name"),
})
public class Retailer {
```

`S4-order-logistics/src/main/java/com/cbg/lbos/entity/Order.java`:

```java
@Entity
@Table(name = "orders", indexes = {
        @Index(name = "idx_orders_customer_profile_id", columnList = "customer_profile_id"),
        @Index(name = "idx_orders_status_updated_datetime", columnList = "order_status, updated_datetime"),
})
public class Order {
```

The same `indexes = {...}` pattern was applied to `FleetOwner.java`, `Driver.java`, `Vehicle.java`, `OrderItem.java`, `Product.java`, and `CustomerAddress.java` — see the table in Section 5 ("Database / Query Behavior") for the full column-to-query mapping. Each index was created automatically by Hibernate's existing `spring.jpa.hibernate.ddl-auto=update` on the next service restart and confirmed present with `select tablename, indexname from pg_indexes where indexname like 'idx_%'` against the live database.

### 9.5 Explicit HikariCP configuration — `S1-platform-territory/src/main/resources/application.properties`

```properties
spring.datasource.driver-class-name=org.postgresql.Driver
# Explicit HikariCP tuning (previously left at the Spring Boot/Hikari defaults: maximum-pool-size=10,
# minimum-idle=maximum-pool-size). With 6 services sharing this Postgres instance, each holding its
# pool's minimum-idle connections open even at rest, the un-tuned defaults reserved 60 of Postgres's
# 100 max_connections permanently - confirmed via pg_stat_activity (60 idle "PostgreSQL JDBC Driver"
# connections with zero user traffic). maximum-pool-size stays at 10 - there is no evidence of
# pool-wait/exhaustion at current load, and raising it without that evidence risks overloading
# Postgres instead of helping; minimum-idle is lowered so an idle service releases connections back
# to Postgres rather than holding them, and leak-detection-threshold surfaces a connection that is
# held far longer than any real query here should take.
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=2
spring.datasource.hikari.leak-detection-threshold=30000
```

The identical three `spring.datasource.hikari.*` lines (with a shorter comment referring back to S1's) were added to S2–S6's `application.properties` in the same position, right after `spring.datasource.driver-class-name`.

### 9.6 `trackBy` for large repeated lists — `frontend/src/app/features/fleet/drivers/drivers.component.ts`

```ts
readonly trackByDriverId = (_: number, driver: Driver) => driver.driverId;
```

```html
<tr *ngFor="let d of drivers(); trackBy: trackByDriverId">
```

What it does: gives Angular a stable identity per row instead of comparing rows positionally. Why it improves performance: on a re-render (e.g. after adding one driver), Angular can now reuse the existing DOM rows for every unchanged driver instead of re-creating the whole table body. The identical change was made to `vehicles.component.ts`/`.html` with `trackByVehicleId`.

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| Retailer "my profile" | `GET /api/retailers` (every retailer) + client-side `.find()` | `GET /api/retailers/me` (one row, looked up by id) |
| Fleet-owner "my profile" | `GET /api/fleet-owners` (every fleet owner) + client-side `.find()` | `GET /api/fleet-owners/me` |
| Retailer orders page | One `GET /api/order-items/by-order/{id}` per order | One `GET /api/order-items/by-orders?ids=...` for every order on the page |
| Fleet assignments queue | One `GET /api/order-items/by-order/{id}` per RETAIL order | One `GET /api/order-items/by-orders?ids=...` for all RETAIL orders on the queue |
| Retailer/Fleet-owner/Order/Product/Address indexes | No `@Table(indexes = ...)` on any of these entities; only primary keys and the one existing unique constraint were indexed | 20 indexes added, each matching a column an existing query already filters, joins, or sorts on |
| Database connection pool | `spring.datasource.hikari.*` unset on all 6 services (framework default: max=10, min-idle=10); 60 idle connections measured against a 100-connection PostgreSQL limit | `maximum-pool-size=10` (unchanged, now explicit), `minimum-idle=2`, `leak-detection-threshold=30000` on all 6 services; 15 idle connections measured after restart |
| Driver/Vehicle list rendering | `*ngFor` with no `trackBy` | `*ngFor` with `trackBy` keyed on the entity's own id |

## 11. Testing

**Actually executed in this iteration:**

| # | Scenario | Result |
| --- | --- | --- |
| 1 | Full backend test suite, all 6 services, after every entity/controller change | S1: 189, S2: 150, S3: 144, S4: 156, S5: 82, S6: 148 — all passing, 0 failures |
| 2 | Frontend production build (`ng build`) after every component/service change | Succeeded, no compile errors |
| 3 | `GET /api/retailers/me` / `GET /api/fleet-owners/me` called live through the Gateway with a real retailer/fleet-manager login | `200 OK`, single-row profile body returned |
| 4 | Retailer orders page opened live in the browser with 5 real orders | Network trace showed exactly one `GET /api/order-items/by-orders?ids=1,6,15,25,27` request; every row's product summary rendered correctly |
| 5 | Fleet assignments queue opened live in the browser with 2 RETAIL + 1 FLEET_SERVICE pending order | Network trace showed exactly one `GET /api/order-items/by-orders?ids=...` request for the 2 RETAIL orders, plus the unchanged one logistics-booking request for the FLEET_SERVICE order |
| 6 | `select tablename, indexname from pg_indexes where indexname like 'idx_%'` against the live database, after restarting all services | All 20 declared indexes present |
| 7 | `pg_stat_activity` idle-connection count, before and after the Hikari change, with all 6 services restarted | 60 → 15 idle "PostgreSQL JDBC Driver" connections |

**Recommended manual tests (not executed live in this session, but directly applicable — same pattern as Section 11's test cases in the CR template):**

| # | Scenario | Expected |
| --- | --- | --- |
| 8 | Log in as Retailer A, open the orders page; log in as Retailer B, open the orders page | Retailer B never sees Retailer A's order rows or line items (`orderIds` for the batched call always comes from that retailer's own `mineForRetailer()` result) |
| 9 | Register a brand-new retailer account with no retailer profile yet, then load a screen that calls `resolveMine()` | `GET /api/retailers/me` returns 404; the screen behaves as it did before (treats it as "no profile yet"), not as an error |
| 10 | Refresh the browser on a retailer screen, then reopen it | `myRetailer` signal is empty again; exactly one fresh `GET /api/retailers/me` is issued |
| 11 | Open the same retailer session on a second machine/browser | Starts with an empty `myRetailer` signal and independently resolves its own profile; no state from the first machine is visible |
| 12 | Exercise normal login/list/detail flows across all 6 services after the Hikari change | No connection-timeout or connection-leak log entries; normal authentication/authorization behaviour unchanged |

## 12. Performance Evidence and Limitations

**What was measured, directly against the live application/database:**

- PostgreSQL `pg_stat_activity` connection counts, before and after the HikariCP change (Section 5, "Connection Pooling").
- PostgreSQL `pg_indexes`, confirming every declared index was actually created (Section 9.4).
- Browser network-request traces for the retailer-orders and fleet-assignments pages, confirming the batched-request count directly (Section 11, tests 4–5).
- The full backend test suite (869 tests across 6 services) and the frontend production build, both green after every change (Section 11, tests 1–2).

**What was not measured, and why:**

- No Hibernate/JPA SQL-level query-count logging (`spring.jpa.show-sql`/`org.hibernate.SQL` at DEBUG) was captured for this iteration, so no "N queries became 1 query" claim is made at the SQL level — the evidence here is at the HTTP-request level (Section 11) and the entity/repository source code (Section 2), not a captured query log.
- No `EXPLAIN ANALYZE` was run against PostgreSQL for any of the queries the new indexes support. The indexes were added because the filtered/joined column was confirmed to have no index at all (Section 2.4), not because a slow query plan was observed and compared.
- No response-time (millisecond) or percentage improvement is claimed anywhere in this document. The development seed dataset (a handful of retailers, fleet owners, and orders) is far too small for a timing comparison to mean anything at production scale; the evidence used instead is **counts** that are meaningful regardless of data volume — number of HTTP requests per page load, number of idle database connections, and number of existing indexes.

**Genuine remaining limitations:**

- `GET /api/retailers` and `GET /api/fleet-owners` themselves are still unpaginated `findAll()` calls, still used by the admin/ops-facing screens that call them directly (not through `resolveMine()`) and by `/city/{cityId}`, `/status/{status}`, and `/search`. They were not rewritten this iteration (see Section 3's architectural-limitation note on `/api/location-dashboard/**`'s role restriction).
- `TripService.toDto()` and `OrderItemService.toDto()`'s per-row Feign calls (S4) remain as they were — self-documented, accepted trade-offs not touched by this iteration.
- The fleet-assignments queue's FLEET_SERVICE-type orders still make one `logisticsBookingService.get()` call per booking; no batched lookup endpoint exists for that data yet.
- `RetailerEnrichmentSupport.openRetailerIds()` (S3) remains deliberately uncached, by design, for order-safety reasons — this is documented as a conscious trade-off, not something left broken.
- Real-world performance still depends on the production PostgreSQL server's own configuration (its own `max_connections`, hardware, and network latency to it), which this iteration's development-machine measurements cannot speak to directly.

## 13. Final Result

After this iteration:

- The retailer and fleet-owner "my own profile" lookup no longer scales with the total number of retailers/fleet owners on the platform — it is a single, indexed lookup by the caller's own account id.
- The retailer's own orders page and the fleet manager's assignment queue no longer issue one HTTP request per order for line-item data — both now use the same batched endpoint the customer order list already relied on.
- 20 database indexes were added, each matching a column an existing, real query already filters, joins, or sorts on — none were added speculatively, and none duplicate an index that already existed.
- HikariCP connection-pool sizing is now explicit and documented for all 6 services instead of relying on an undocumented framework default; the change was evidence-based (measured idle-connection counts) and did not raise the maximum pool size, since no exhaustion was observed.
- No authorization rule, business rule, response shape, or UUID-exposure boundary was changed. All 869 backend tests across the 6 services and the frontend production build remain green.
- No performance percentage, timing figure, or cache-hit-rate is claimed anywhere in this document — every number given is a directly measured count (connections, requests, indexes, or test results).

---

## Iteration 3 - order flow, address list, lazy order history and duplicate requests

Measured with live network traces on the running application (development data set). These are request counts and step timings on one machine, not load tests.

| Area | What was found | Change |
| --- | --- | --- |
| Checkout `prepare` | S4 read every cart product from S3 one call at a time | S3 `GET /api/v1/products/by-ids` (`ProductDiscoveryServiceImpl.getByIds`) and one batched read in S4 `InternalOrderLogisticsController` |
| Address list | one zone lookup call per distinct city among the addresses | S1 `GET /internal/v1/territories/zones/by-cities`, used by S3 `AddressServiceImpl` - one call for all cities |
| Place order | one `POST /api/order-items` per cart line at the same time; each recalculated the order totals and each response added three extra service calls that checkout ignores | S4 `POST /api/order-items/batch` (`OrderItemService.createBatch`): one transaction, products read once, stock given back if a later line fails, totals recalculated once, light response; checkout uses `OrderService.addItems`. Same 2-shop / 4-line COD cart: item step 1.73 s -> 0.45 s, whole place-order about 3.2 s -> 1.6 s |
| "View all orders" | every order and its item summary fetched and drawn at once | S4 `GET /api/orders/mine/page` + index `idx_orders_customer_profile_id_order_date`; `OrderListComponent` loads 10 orders at a time when the end of the list scrolls into view |
| Indexes | more filter columns without an index | S1, S2, S4 and S6 entities (`@Table(indexes)`), all confirmed in `pg_indexes` |
| Duplicate requests | the same GET fired several times on one page load | in-flight sharing (`shareReplay`, no time caching) in `WishlistStateService`, `CartService.get`, `AddressService.getDefault`, `RetailerService.resolveMine`, `FleetOwnerService.resolveMine` |
| Product list cache | - | verified: four visits to Home and Products produced one product request and no image requests (30 s listing cache, 5 min image cache, cleared on stock changes) |

Still open (needs a design decision, not changed): the in-transaction notification call when an order is submitted (about 150-450 ms), the two tax calls per retailer in checkout `prepare`, and the one-request-per-product-card image loading.

---

## Iteration 4 - fleet owner and driver screens

Found by walking a full fleet-owner and driver lifecycle in the browser (dispatch an order, driver pickup and delivery, driver expense, reimbursement) and reading the request timings of every fleet and driver screen.

| What was measured | Cause | Change |
| --- | --- | --- |
| Every service-to-service call cost about 90 ms (internal endpoint with the service credentials 95 ms, without credentials 4 ms) | The receiving service verified the shared service password with BCrypt on **every** internal request | `ServiceSecretCachingPasswordEncoder` (one copy in each of S1-S6, wired in each `SecurityConfig`): the correct service secret is verified with BCrypt once and remembered as a SHA-256 digest compared in constant time. Wrong secrets, unknown accounts and user passwords always take the normal BCrypt path, so guessing is not made faster |
| `GET /api/trips/mine` for 8 trips: about 3.1 s | 3 lookups (driver, vehicle, fleet owner) per trip, one after another, each paying the 90 ms above | The BCrypt fix, plus `TripService.SummaryLookups`: a list looks each distinct driver / vehicle / fleet owner up once per request (24 calls for 8 trips became 7) |
| `GET /api/drivers/mine` for 3 drivers: about 300 ms | one internal call per driver, each paying the 90 ms | the BCrypt fix |
| Driver dashboard: `GET /api/logistics-bookings/{orderId}` answered 404 for every retail order, on every load | the pickup / drop addresses were fetched separately although the trip already carries them | the dashboard uses `pickupAddress` / `dropAddress` of the trip; the request is gone |

Measured on the running stack after the change (development data): internal call with the correct secret 95 ms -> 9 ms (wrong secret still about 100 ms); `trips/mine` 3.1 s -> 0.13 s; `drivers/mine` 300 ms -> about 55 ms; `pending-fleet-assignment` 354 ms -> 75 ms; dispatching a trip (`POST /api/trips`) 356 ms -> 110 ms; completing a trip 776 ms -> 84 ms. Every fleet and driver screen now loads with no duplicate request and every call under about 120 ms.

Caching seen on those screens: cities / zones and the fleet owner's own record are not requested again when moving between pages; drivers, trips, expenses, dashboard figures and notifications are requested again on every visit on purpose, because other people change them (verification, assignments, driver-recorded expenses). Not cached, not changed.

---

## Test Files Created for This CR

These are the backend test files that belong to this change request (paths from the project root):

| Test file | What it checks |
| --- | --- |
| `S3-commerce-customer/src/test/java/com/lbos/commercecustomer/service/AddressTerritoryNameCacheTest.java` | Address list: city/zone names are read once and reused; a customer with addresses in several cities costs ONE zone lookup call. |
| `S3-commerce-customer/src/test/java/com/lbos/commercecustomer/service/ProductDiscoveryServiceBatchTest.java` | Many products read in one query (`getByIds`), only products of open shops returned. |
| `S3-commerce-customer/src/test/java/com/lbos/commercecustomer/service/comprehensive/CartServiceComprehensiveTest.java` | Cart reads with the fetch-join query (iteration 1). |
| `S3-commerce-customer/src/test/java/com/lbos/commercecustomer/controller/InternalRetailerReviewControllerTest.java` | Ratings for many retailers come from one grouped query (dashboard / verification screens). |
| `S4-order-logistics/src/test/java/com/cbg/lbos/controller/InternalOrderLogisticsControllerTest.java` | The checkout serviceability check reads all cart products with ONE call to S3. |
| `S4-order-logistics/src/test/java/com/cbg/lbos/service/OrderItemServiceBatchTest.java` | Batch order-item creation: products read once, totals recalculated once, stock given back when a later line fails, mixed orders / empty batch rejected. |
| `S4-order-logistics/src/test/java/com/cbg/lbos/service/OrderServiceMinePagedTest.java` | Customer order history read one page at a time, newest first. |
| `S1-platform-territory/src/test/java/com/cbg/lbos/controller/InternalTerritoryControllerZonesByCitiesTest.java` | Zones of several cities from one repository query; empty / oversized city lists rejected. |
| `S2-partner-verification/src/test/java/com/example/lbos/controller/PartnerMeEndpointsTest.java` | `/api/retailers/me` and `/api/fleet-owners/me` resolve the caller from the token in one lookup. |
| `S1-platform-territory/src/test/java/com/cbg/lbos/config/ServiceSecretCachingPasswordEncoderTest.java` (and the same file in S2 `com/example/lbos/config`, S3 `com/lbos/commercecustomer/config`, S4 `com/cbg/lbos/config`, S5 `com/cbg/lbos/config`, S6 `com/lbos/finance/config`) | The correct service secret is BCrypt-verified once and then answered from memory; a wrong secret is always checked and never accepted; user passwords are never remembered (iteration 4). |
| `S4-order-logistics/src/test/java/com/cbg/lbos/service/TripServiceTest.java` | A list of trips looks each distinct driver / vehicle / fleet owner up once, and a failed lookup is not retried per row (iteration 4). |

The database indexes and the connection-pool sizes cannot be unit tested; they were checked against the running PostgreSQL (`pg_indexes`, `pg_stat_activity`). The front-end duplicate-request fixes were checked with live network traces (request counts before and after).

---

## Main Code Location

| Item | Location |
| --- | --- |
| File | `frontend/src/app/core/api/ttl-cache.ts` |
| Place | class `TtlCache` (`get()` / `clear()`) |
| Why this is the main place | The shared cache and in-flight request sharing the performance work is built on (product listings, image lists, cities / zones, addresses, user accounts). |

A banner comment `CR_CHG0030033_Performance_Optimization_3232575_3235381` marks this place in the source code.
