# CHG0030046 — Enhanced Location Manager Dashboard and Zone User Management

## 1. CR Overview

| Item | Detail |
| --- | --- |
| CR number | CHG0030046 |
| Title | Enhanced Location Manager Dashboard and Zone User Management |
| Purpose | Give a Location Manager one dashboard for their assigned zone: KPIs, charts, and a searchable list of the retailers and fleet owners in that zone with their status, pending action, reviews, drivers and vehicles |
| Main affected area | S2 partner-verification (new dashboard service/controller and zone security), small read endpoints in S1, S3, S4, S5, the API gateway, and a new Angular page `/location/dashboard` |

## 2. Understanding the CR

**What was requested**

A dedicated dashboard for the Location Manager showing, for **their zone only**:

- Fleet Owners and Retailers with user details, onboarding status, verification status, activation status and pending actions.
- KPIs and charts: total retailers, total fleet owners, pending verifications, completed verifications, rejected requests, active orders, completed orders, onboarding trends, workload distribution.
- Search, filtering, sorting and a date range.

**Why it was required**

The Location Manager's only screen was the verification queue. There was no overview of the zone, no way to see who is onboarded, who is waiting on what, or how much work is pending.

**What the system now does**

```text
Location Manager logs in → /location/dashboard
   KPI cards → charts → search/filters/sort → paged Retailers / Fleet Owners
   → expand a row: reviews (retailer) or drivers + vehicles (fleet owner)
```

## 3. Existing Problem

- After login the Location Manager landed on the verification queue only.
- No KPIs, charts, retailer/fleet-owner list, reviews, drivers or vehicles for the zone.
- Zone isolation was **client-side only**: `queue-list.component.ts` passed `zoneId` as a query parameter, and the S2 controller trusted it (or returned everything when it was omitted). The retailer, fleet-owner, verification-queue and document GET endpoints in S2 only required a logged-in user (S2 `SecurityConfig` `authenticated()`) and the gateway allowed a Location Manager through, with no zone check, so a Location Manager could read another zone's data by calling the API directly.

## 4. Root Cause

- There was no aggregating backend for zone data: the data lives in different services (retailers, fleet owners and queues in S2; reviews in S3; orders in S4; drivers and vehicles in S5; accounts in S1).
- Zone scope was a request parameter chosen by the browser, not something the server derived from the logged-in user.

## 5. Solution

The dashboard backend lives in **S2** because S2 owns retailers, fleet owners and verification queues. S2 asks the other services only for the pieces it does not own, and always after the zone has been resolved on the server.

```text
Location Manager opens /location/dashboard
    ↓
Frontend (dashboard.component) → /api/location-dashboard/summary | users | retailers/{id}/reviews | fleet-owners/{id}/assets
    ↓
API Gateway (new route + rule: LOCATION_MANAGER only) → S2
    ↓
LocationDashboardController → LocationDashboardService
    ↓
ZoneScope.assignment() → S1 /internal/v1/location-managers/by-user/{account}   (zone from the JWT account, never from the request)
    ↓
S2 repositories (counts, specifications, paging)  +  S1 (names/contacts, batch)  +  S3 (ratings, reviews)  +  S4 (order counts)  +  S5 (drivers, vehicles)
    ↓
JSON → KPI cards, charts, paged table, expandable details
```

## 6. Implementation Details

### 6.1 Zone security (S2)

- **`security/ZoneScope.java`** (new). For a `LOCATION_MANAGER` caller it reads the **active assignment from S1 on every call** (no cache, so a transfer takes effect immediately) and **fails closed** (403) if S1 cannot be reached or the assignment is not active. Other roles are untouched: `ZoneScope.isLocationManager()` is false for them.
- The existing S2 endpoints now apply it **only for Location Managers**:
  - `VerificationQueueController`: list, list-by-status, get-by-id and `process-result`;
  - `VerificationDocumentController`: get, decision, file, list-by-queue and history;
  - `RetailerController` and `FleetOwnerController`: get-by-id (must be in the caller's zone) and the list/search endpoints (filtered to the caller's zone).
- `SecurityConfig`: `/api/location-dashboard/**` → `hasRole("LOCATION_MANAGER")`.
- Gateway: new route `s2-location-dashboard` and rule `/api/location-dashboard/**` for `LOCATION_MANAGER` only.
- The Location Manager's queue now shows requests in the zone **or assigned to them** (`findVisibleToReviewer`), which is also what makes transferred work (CHG0030050) appear.

### 6.2 API (`LocationDashboardController`)

| Endpoint | Purpose |
| --- | --- |
| `GET /api/location-dashboard/summary?from&to` | KPIs, charts data |
| `GET /api/location-dashboard/users?type&search&onboardingStatus&verificationStatus&activation&pendingAction&sort&direction&page&size` | Paged retailers or fleet owners of the zone |
| `GET /api/location-dashboard/retailers/{id}/reviews?page&size` | Customer reviews of one retailer of the zone |
| `GET /api/location-dashboard/fleet-owners/{id}/assets` | Drivers and vehicles of one fleet owner of the zone |

There is **no zone parameter**. Dates default to the last 30 days; the range is limited to 366 days and an inverted range returns 400.

### 6.3 KPIs and definitions (`summary`)

| KPI | Definition (from the code) | Affected by date range? |
| --- | --- | --- |
| Total Retailers / Total Fleet Owners | Rows with `zone_id` = the zone; "active" = retailer `VERIFIED`, fleet owner `ownerStatus = ACTIVE` | No (current state) |
| Pending Verifications | Open requests in `SENT_TO_LOCATION_MANAGER` or `RESUBMISSION_REQUIRED` that are assigned to the caller or unassigned in the zone (`VerificationWork`) | No (current state) |
| Completed Verifications | Zone requests `APPROVED` with `updated_at` in the range | Yes |
| Rejected Requests | Zone requests `REJECTED` with `updated_at` in the range | Yes |
| Active Orders | S4: orders of the zone's retailers whose status is **not** one of `DELIVERED, CANCELLED, RETAILER_REJECTED, SHOP_UNAVAILABLE` (S4's own `TERMINAL_ORDER_STATUSES`) | No (current state) |
| Completed Orders | S4: orders of the zone's retailers `DELIVERED` with `updated_datetime` in the range | Yes |

If S4 is unreachable the two order figures are `null` and the page says they are temporarily unavailable; the rest of the dashboard still loads.

### 6.4 Charts

Drawn with CSS/HTML (the project has no chart library and none was added):

- **Onboarding trends** — new applications for retailers and fleet owners per day (per week when the range is longer than 62 days). Built from verification-queue rows created in the range; each partner counts once per bucket (`findOnboardingStarts`, bucketed in Java).
- **Verification analytics** — per partner type: pending / approved / rejected (stacked bar).
- **Order analytics** — active vs completed.
- **Workload distribution** — the caller's pending work grouped by kind ("Awaiting review", "Re-upload required") and partner type.

### 6.5 Partner list — search, filter, sort, paging

Done **in the database** with JPA `Specification`s (repositories now extend `JpaSpecificationExecutor`), so nothing is loaded into Angular to be filtered there. Type is `RETAILER` or `FLEET_OWNER` (tabs).

| Control | Implementation |
| --- | --- |
| Search | Business name `LIKE`, **or** the account matches name/email/phone — S2 asks S1 (`/internal/v1/user-accounts/search-ids`) for matching account ids (only when a search text is given) |
| Onboarding status | The entity's own status (`retailerStatus` / `profileStatus`) |
| Verification status | Status of the partner's **most recent** verification request (or `NOT_SUBMITTED`), via a correlated sub-query |
| Activation | Active/Inactive using the definitions above |
| Pending action | `REVIEW_DOCUMENTS` (awaiting review), `AWAITING_REUPLOAD`, `AWAITING_SUBMISSION`, or `NONE`, mapped from the latest request status |
| Sort | Name, onboarding status, activation status (ascending/descending, name as tie-breaker) |
| Paging | Server-side, page size ≤ 50 |

No city/zone filter is offered: a Location Manager has exactly one zone, which belongs to one city.

### 6.6 Avoiding N+1

For one page of partners the backend makes a **fixed number of calls**: one accounts batch (S1 `POST /internal/v1/user-accounts/batch`), one queue query for all their requests (`findBySubjectIdIn`), and one rating batch (S3). Row details (reviews, drivers/vehicles) are loaded only when a row is expanded.

### 6.7 Supporting endpoints in other services

| Service | Addition |
| --- | --- |
| S1 | `GET /internal/v1/location-managers/by-user/{id}` (zone of a Location Manager); `POST /internal/v1/user-accounts/batch`; `GET /internal/v1/user-accounts/search-ids` |
| S3 | `InternalRetailerReviewController`: `POST /api/v1/internal/retailers/rating-summaries` (one grouped query) and `GET /api/v1/internal/retailers/{id}/reviews` (paged, newest first, no customer identity) — reads the **existing** `customer_review` data |
| S4 | `POST /api/v1/internal/orders/stats` (active / delivered counts for a list of retailer ids) |
| S5 | `GET /internal/v1/fleet-owners/{id}/drivers` and `/vehicles` (existing `getByFleetOwner` services) |

### 6.8 Frontend

- **`features/location/dashboard/dashboard.component.ts/.html`** (new): zone header, date-range presets (Today / Last 7 days / Last 30 days / Custom + Apply), refresh button, seven KPI cards, four charts, search + four filters + sortable headers + pager, and an expandable row with **details → onboarding → verification → activation → pending action → reviews / drivers / vehicles**.
- **Interactions**: KPI cards link to the existing queue (`/location/queue?status=…`, which now reads the `status` query parameter) or switch the list to Retailers / Fleet Owners; a "pending action" link opens the queue entry.
- **Refresh**: no polling. Changing the date range reloads only the summary; changing filters reloads only the list; details are fetched on expand and kept.
- **`core/services/location-dashboard.service.ts`, `core/models/location-dashboard.model.ts`**: API calls and types.
- **Routing/navigation**: `app.routes.ts` (`location/dashboard`, default child), `role-landing.ts` (Location Manager lands on the dashboard), `location-shell` menu (Dashboard, Notifications).

### 6.9 Ratings — what exists and what does not

Retailer ratings and reviews come from the existing customer-review data. **The platform has no customer rating for fleet owners or drivers**, and none was invented: the rating column shows *Not rated*, and the fleet-owner detail states that ratings are not collected yet (`ratingsAvailable = false`).

## 7. Execution Flow

1. Location Manager logs in and lands on `/location/dashboard`.
2. The page requests `summary` (last 30 days) and `users` (Retailers, page 1) in parallel.
3. `ZoneScope` resolves the zone from S1; counts and charts are computed for that zone only.
4. The Location Manager changes the range to *Last 7 days* → only `summary` reloads.
5. Types "fresh" in search → after 350 ms the list reloads with `search=fresh`; S1 is asked for matching accounts.
6. Filters *Verification: Awaiting review* → list shows partners whose latest request is awaiting review.
7. Clicks **Details** on a retailer → reviews are loaded (5 per page).
8. Switches to **Fleet Owners** → expands a fleet owner → drivers and vehicles are loaded.
9. Clicks **Review documents** in *Pending action* → opens that verification request.

**Alternate flows**

| Situation | Result |
| --- | --- |
| Location Manager calls the API for another zone's retailer or queue | 403 *"This record is outside your zone"* |
| Another role calls `/api/location-dashboard/**` | 403 (gateway and S2) |
| Assignment inactive or S1 unreachable | 403 (fails closed) |
| S4 down | Order KPIs show `-` with a notice; everything else works |
| S3 or S1 down | Ratings/contacts missing; list still loads |
| Date range inverted or over 366 days | 400 with a message |
| No partners / no match | Empty-state message in the table |

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Controller (S2) | `controller/LocationDashboardController.java` | New dashboard endpoints |
| Service (S2) | `service/LocationDashboardService.java` | KPIs, trend, workload, partner list, details |
| DTO (S2) | `dto/LocationDashboardDTOs.java` | Response records |
| Security (S2) | `security/ZoneScope.java` | Server-side zone scope for Location Managers |
| Controller (S2) | `VerificationQueueController`, `VerificationDocumentController`, `RetailerController`, `FleetOwnerController` | Zone checks for Location Managers |
| Repository (S2) | `VerificationQueueRepository`, `RetailerRepository`, `FleetOwnerRepository` | Aggregation queries, `JpaSpecificationExecutor` |
| Client (S2) | `S3CommerceClient`, `S4OrderClient`, `S5FleetClient`, `LocationManagerClient`, `AccountLookupClient` | Calls to the other services |
| Config (S2) | `config/SecurityConfig.java` | Dashboard role rule |
| Gateway | `RouteAuthorizationRules.java`, `application.yml` | New route and rule |
| Backend S1 | `InternalLocationManagerController`, `InternalUserAccountController`, `UserAccountService`, `UserAccountRepository` | by-user, batch, search |
| Backend S3 | `InternalRetailerReviewController`, `CustomerReviewRepository` | Ratings and reviews per retailer |
| Backend S4 | `InternalOrderLogisticsController`, `OrderRepository`, `OrderService` | Order counts |
| Backend S5 | `InternalFleetController` | Drivers/vehicles of a fleet owner |
| Frontend | `features/location/dashboard/*` | New dashboard |
| Frontend | `location-dashboard.service.ts`, `location-dashboard.model.ts` | API and types |
| Frontend | `app.routes.ts`, `role-landing.ts`, `location-shell.component.ts`, `queue-list.component.ts` | Route, landing page, menu, status preset |
| Tests | `InternalRetailerReviewControllerTest`, `VerificationWorkTransferTest` | Reviews API, zone visibility rule |

## 9. Important Code Changes

### 9.1 Zone comes from the server — `S2-partner-verification/.../security/ZoneScope.java`

```java
public static boolean isLocationManager() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    return authentication != null && authentication.getAuthorities().stream()
            .anyMatch(authority -> "ROLE_LOCATION_MANAGER".equals(authority.getAuthority()));
}

/** The caller's ACTIVE Location Manager assignment (zone, city, ...). */
public LocationManagerSummary assignment() {
    UUID account = callerAccountId();
    LocationManagerSummary summary;
    try {
        summary = account == null ? null : locationManagerClient.getByUser(account);
    } catch (Exception lookupFailure) {
        throw new ForbiddenActionException("Your zone assignment could not be confirmed. Please try again.");
    }
    if (summary == null || !summary.isActive() || summary.zoneId() == null) {
        throw new ForbiddenActionException("You do not have an active Location Manager assignment");
    }
    return summary;
}

/** For retailer / fleet-owner records: they must be registered in the caller's zone. */
public void requireZone(UUID recordZoneId) {
    if (recordZoneId == null || !recordZoneId.equals(assignment().zoneId())) {
        throw new ForbiddenActionException("This record is outside your zone");
    }
}
```

### 9.2 Applying it to existing endpoints — `.../controller/RetailerController.java`

```java
public ResponseEntity<RetailerDTO> getRetailerById(@PathVariable UUID retailerId) {
    RetailerDTO retailer = retailerService.getRetailerById(retailerId);
    if (com.example.lbos.security.ZoneScope.isLocationManager()) {
        zoneScope.requireZone(retailer.getZoneId());
    }
    return ResponseEntity.ok(retailer);
}
```

```java
/** A Location Manager only ever gets the retailers registered in their own zone; every other role gets the list unchanged. */
private List<RetailerDTO> inMyZone(List<RetailerDTO> retailers) {
    if (!com.example.lbos.security.ZoneScope.isLocationManager()) {
        return retailers;
    }
    java.util.UUID zone = zoneScope.zoneId();
    return retailers.stream().filter(retailer -> zone.equals(retailer.getZoneId())).toList();
}
```

`.../controller/VerificationQueueController.java`:

```java
if (com.example.lbos.security.ZoneScope.isLocationManager()) {
    return ResponseEntity.ok(service.getVerificationQueuesForReviewer(
            com.example.lbos.security.ZoneScope.callerAccountId(), zoneScope.zoneId(), status));
}
```

### 9.3 Security rule — `.../config/SecurityConfig.java`

```java
/* The Location Manager's own zone dashboard - the zone itself is resolved server-side from the JWT. */
.requestMatchers("/api/location-dashboard/**")
.hasRole("LOCATION_MANAGER")
```

Gateway: `new RouteAuthorizationRule("/api/location-dashboard/**", Set.of("LOCATION_MANAGER")),` and in `application.yml`:

```yaml
- id: s2-location-dashboard
  uri: lb://lbos-partner
  predicates:
    - Path=/api/location-dashboard/**
```

### 9.4 Summary and KPIs — `.../service/LocationDashboardService.java`

```java
LocationManagerSummary lm = zoneScope.assignment();
UUID zone = lm.zoneId();
UUID me = ZoneScope.callerAccountId();
...
// Verification: pending is "right now"; approved / rejected are decisions made inside the range.
for (StatusCountRow row : queues.countPendingByType(me, zone, VerificationWork.PENDING_STATUSES)) {
    pending += row.getTotal();
    bySubject.computeIfAbsent(row.getSubjectType(), k -> new Long[] {0L, 0L, 0L})[0] += row.getTotal();
    workload.add(new WorkloadItem("SENT_TO_LOCATION_MANAGER".equals(row.getStatus()) ? "Awaiting review" : "Re-upload required",
            row.getSubjectType(), row.getTotal()));
}
...
for (StatusCountRow row : queues.countDecidedByZone(zone, start, end)) {
    boolean isApproved = "APPROVED".equals(row.getStatus());
    if (isApproved) approved += row.getTotal(); else rejected += row.getTotal();
    bySubject.computeIfAbsent(row.getSubjectType(), k -> new Long[] {0L, 0L, 0L})[isApproved ? 1 : 2] += row.getTotal();
}
```

```java
return new Summary(lm.zoneName(), lm.cityName(), from, to,
        retailers.countByZoneId(zone), retailers.countByZoneIdAndRetailerStatus(zone, "VERIFIED"),
        fleetOwners.countByZoneId(zone), fleetOwners.countByZoneIdAndOwnerStatus(zone, "ACTIVE"),
        pending, activeOrders, approved, rejected, completedOrders,
        onboardingTrend(zone, from, to, start, end), workload, verification);
```

### 9.5 Aggregation queries — `.../repository/VerificationQueueRepository.java`

```java
/** Dashboard: decided requests of a zone, grouped, inside a time window. */
@org.springframework.data.jpa.repository.Query("select q.subjectType as subjectType, q.verificationStatus as status, count(q) as total from VerificationQueue q "
        + "where q.zoneId = :zoneId and q.verificationStatus in ('APPROVED','REJECTED') and q.updatedAt >= :from and q.updatedAt < :to "
        + "group by q.subjectType, q.verificationStatus")
List<StatusCountRow> countDecidedByZone(@org.springframework.data.repository.query.Param("zoneId") UUID zoneId,
        @org.springframework.data.repository.query.Param("from") java.time.OffsetDateTime from,
        @org.springframework.data.repository.query.Param("to") java.time.OffsetDateTime to);

/** Dashboard: retailer / fleet-owner onboarding applications started in a window (grouped in Java by day). */
@org.springframework.data.jpa.repository.Query("select q.subjectType as subjectType, q.subjectId as subjectId, q.createdAt as createdAt from VerificationQueue q "
        + "where q.zoneId = :zoneId and q.subjectType in ('RETAILER','FLEET_OWNER') and q.createdAt >= :from and q.createdAt < :to")
List<OnboardingRow> findOnboardingStarts(@org.springframework.data.repository.query.Param("zoneId") UUID zoneId,
        @org.springframework.data.repository.query.Param("from") java.time.OffsetDateTime from,
        @org.springframework.data.repository.query.Param("to") java.time.OffsetDateTime to);

/** Every queue row of the given subjects - lets a whole page of partners get its latest status with one query. */
List<VerificationQueue> findBySubjectIdIn(Collection<UUID> subjectIds);
```

### 9.6 Onboarding trend buckets — `.../service/LocationDashboardService.java`

```java
boolean daily = ChronoUnit.DAYS.between(from, to) <= DAILY_BUCKET_LIMIT_DAYS;
Function<LocalDate, LocalDate> bucket = day -> daily ? day : day.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
...
for (VerificationQueueRepository.OnboardingRow row : queues.findOnboardingStarts(zone, start, end)) {
    LocalDate key = bucket.apply(row.getCreatedAt().atZoneSameInstant(clock).toLocalDate());
    ("RETAILER".equals(row.getSubjectType()) ? retailerBuckets : ownerBuckets)
            .computeIfAbsent(key, k -> new HashSet<>()).add(row.getSubjectId());
}
```

### 9.7 Search, filters, sort and paging in the database — same file

```java
Specification<Retailer> spec = partnerSpec(zone, query, matchingAccounts, "retailerId", "retailerStatus", "retailerStatus", "VERIFIED");
Page<Retailer> result = retailers.findAll(spec, PageRequest.of(page, size, sortFor(query, "retailerStatus", "retailerStatus")));
List<UserRow> rows = rowsFor("RETAILER", result.getContent(), Retailer::getRetailerId, Retailer::getUserAccountId,
        Retailer::getBusinessName, Retailer::getRetailerStatus, retailer -> "VERIFIED".equalsIgnoreCase(retailer.getRetailerStatus()));
return new UserPage(rows, result.getTotalElements(), page, size);
```

```java
return (Root<T> root, CriteriaQuery<?> cq, CriteriaBuilder cb) -> {
    List<Predicate> all = new ArrayList<>();
    all.add(cb.equal(root.get("zoneId"), zone));
    if (hasText(query.onboardingStatus())) {
        all.add(cb.equal(root.get(onboardingAttr), query.onboardingStatus().toUpperCase()));
    }
    if (hasText(query.activation())) {
        Predicate active = cb.equal(root.get(activationAttr), activeValue);
        all.add("ACTIVE".equalsIgnoreCase(query.activation()) ? active : cb.not(active));
    }
    if (hasText(query.verificationStatus())) {
        all.add(latestQueueStatus(root, cq, cb, idAttr, query.verificationStatus().toUpperCase()));
    }
    if (hasText(query.pendingAction())) {
        all.add(pendingActionPredicate(root, cq, cb, idAttr, query.pendingAction().toUpperCase()));
    }
    if (hasText(query.search())) {
        String pattern = "%" + query.search().trim().toLowerCase() + "%";
        Predicate byName = cb.like(cb.lower(root.get("businessName")), pattern);
        all.add(matchingAccounts.isEmpty() ? byName : cb.or(byName, root.get("userAccountId").in(matchingAccounts)));
    }
    return cb.and(all.toArray(new Predicate[0]));
};
```

```java
/** True when the partner's most recent verification request has one of the statuses. */
private <T> Predicate latestQueueStatuses(Root<T> root, CriteriaQuery<?> cq, CriteriaBuilder cb, String idAttr, Collection<String> statuses) {
    Subquery<Integer> exists = cq.subquery(Integer.class);
    Root<VerificationQueue> q = exists.from(VerificationQueue.class);
    Subquery<OffsetDateTime> latest = exists.subquery(OffsetDateTime.class);
    Root<VerificationQueue> q2 = latest.from(VerificationQueue.class);
    latest.select(cb.greatest(q2.<OffsetDateTime>get("createdAt"))).where(cb.equal(q2.get("subjectId"), root.get(idAttr)));
    exists.select(cb.literal(1)).where(
            cb.equal(q.get("subjectId"), root.get(idAttr)),
            cb.equal(q.<OffsetDateTime>get("createdAt"), latest),
            q.get("verificationStatus").in(statuses));
    return cb.exists(exists);
}
```

```java
private static String pendingAction(String verificationStatus) {
    return switch (verificationStatus) {
        case "SENT_TO_LOCATION_MANAGER" -> "REVIEW_DOCUMENTS";
        case "RESUBMISSION_REQUIRED" -> "AWAITING_REUPLOAD";
        case "DOCUMENTS_SUBMITTED" -> "AWAITING_SUBMISSION";
        default -> "NONE";
    };
}
```

### 9.8 One batch per page — same file (`rowsFor`)

```java
List<UUID> ids = entities.stream().map(id).toList();
Map<UUID, AccountSummary> accountById = accountsById(entities.stream().map(accountId).distinct().toList());
Map<UUID, List<VerificationQueue>> queuesBySubject = queues.findBySubjectIdIn(ids).stream()
        .collect(Collectors.groupingBy(VerificationQueue::getSubjectId));
Map<UUID, S3CommerceClient.RetailerRating> ratings = "RETAILER".equals(type) ? ratingsById(ids) : Map.of();
```

### 9.9 Fleet owner drivers and vehicles — same file

```java
FleetOwner owner = fleetOwners.findById(fleetOwnerId)
        .orElseThrow(() -> new FleetOwnerNotFoundException("FleetOwner not found with id: " + fleetOwnerId));
zoneScope.requireZone(owner.getZoneId());
...
drivers = fleet.driversOf(fleetOwnerId).stream().map(d -> new DriverRow(driverName(d), d.driverStatus(), null)).toList();
...
return new FleetAssets(drivers, vehicles, false);
```

### 9.10 Retailer ratings from existing reviews — `S3-commerce-customer/.../repository/CustomerReviewRepository.java`

```java
@Query("select r.product.retailerId as retailerId, avg(r.rating) as average, count(r) as total from CustomerReview r where r.product.retailerId in :ids group by r.product.retailerId")
List<RetailerRatingRow> ratingsByRetailerIds(@Param("ids") Collection<UUID> ids);
```

`.../controller/InternalRetailerReviewController.java`:

```java
@RequestMapping("/api/v1/internal/retailers")
...
@PostMapping("/rating-summaries")
public List<RetailerRating> ratingSummaries(@RequestBody RatingSummariesRequest request) {
...
@GetMapping("/{retailerId}/reviews")
public RetailerReviewPage reviewsOf(@PathVariable UUID retailerId,
        @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
```

### 9.11 Order counts — `S4-order-logistics/.../repository/OrderRepository.java`

```java
/** Orders of the given retailers that are still in progress - i.e. whose status is not one of the terminal ones. */
@org.springframework.data.jpa.repository.Query("select count(o) from Order o where o.orderStatus not in :terminalStatuses and exists "
        + "(select 1 from OrderItem i where i.order = o and i.retailerId in :retailerIds)")
long countInProgressForRetailers(@org.springframework.data.repository.query.Param("retailerIds") java.util.Collection<java.util.UUID> retailerIds,
        @org.springframework.data.repository.query.Param("terminalStatuses") java.util.Collection<String> terminalStatuses);

/** Orders of the given retailers delivered within [from, to). */
@org.springframework.data.jpa.repository.Query("select count(o) from Order o where o.orderStatus = 'DELIVERED' "
        + "and o.updatedDatetime >= :from and o.updatedDatetime < :to and exists "
        + "(select 1 from OrderItem i where i.order = o and i.retailerId in :retailerIds)")
long countDeliveredForRetailers(@org.springframework.data.repository.query.Param("retailerIds") java.util.Collection<java.util.UUID> retailerIds,
        @org.springframework.data.repository.query.Param("from") LocalDateTime from,
        @org.springframework.data.repository.query.Param("to") LocalDateTime to);
```

### 9.12 Frontend — date range, list loading, expandable details — `frontend/.../features/location/dashboard/dashboard.component.ts`

```ts
setPreset(preset: RangePreset): void {
  this.preset.set(preset);
  if (preset !== 'custom') this.loadSummary();
}

/** The range only changes the time-based figures, so only the summary reloads - never the partner list. */
loadSummary(): void {
  const { from, to } = this.range();
  if (!from || !to || from > to) return;
  this.summaryLoading.set(true);
  this.summaryError.set(null);
  this.dashboard.summary(from, to).subscribe({
    next: (summary) => { this.summary.set(summary); this.summaryLoading.set(false); },
    error: (err) => { this.summaryError.set(extractErrorMessage(err, 'Could not load the dashboard.')); this.summaryLoading.set(false); },
  });
}
```

```ts
ngOnInit(): void {
  this.searchControl.valueChanges.pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
    this.page.set(0);
    this.loadUsers();
  });
  this.loadSummary();
  this.loadUsers();
}
```

```ts
toggle(row: ZoneUserRow): void {
  if (this.expandedId() === row.id) { this.expandedId.set(null); return; }
  this.expandedId.set(row.id);
  this.detailError.set(null);
  if (row.userType === 'RETAILER' && !this.reviews()[row.id]) this.loadReviews(row, 0);
  if (row.userType === 'FLEET_OWNER' && !this.assets()[row.id]) this.loadAssets(row);
}
```

### 9.13 Frontend — API service — `frontend/.../core/services/location-dashboard.service.ts`

```ts
summary(from: string, to: string): Observable<DashboardSummary> {
  return this.http.get<DashboardSummary>('/api/location-dashboard/summary', { params: new HttpParams().set('from', from).set('to', to) });
}

users(query: ZoneUserQuery): Observable<ZoneUserPage> {
  let params = new HttpParams().set('type', query.type).set('page', query.page).set('size', query.size);
  for (const key of ['search', 'onboardingStatus', 'verificationStatus', 'activation', 'pendingAction', 'sort', 'direction'] as const) {
    const value = query[key];
    if (value) params = params.set(key, value);
  }
  return this.http.get<ZoneUserPage>('/api/location-dashboard/users', { params });
}
```

### 9.14 Frontend — KPI card and chart markup — `dashboard.component.html`

```html
<a routerLink="/location/queue" [queryParams]="{ status: 'SENT_TO_LOCATION_MANAGER' }" class="card card-hover flex items-center gap-4">
  ...
  <p class="text-2xl font-extrabold text-slate-900">{{ s.pendingVerifications }}</p>
  <p class="text-sm text-slate-500">Pending Verifications</p>
  <p class="text-xs text-slate-400">awaiting review or re-upload</p>
```

```html
@for (point of trend(); track point.date) {
  <div class="flex h-full min-w-0 flex-1 items-end justify-center gap-px" [title]="trendLabel(point.date) + ': ' + point.retailers + ' retailers, ' + point.fleetOwners + ' fleet owners'">
    <div class="w-1/2 rounded-t-sm bg-violet-500" [style.height.%]="point.retailerPct"></div>
    <div class="w-1/2 rounded-t-sm bg-amber-400" [style.height.%]="point.ownerPct"></div>
  </div>
}
```

### 9.15 Routing and landing — `frontend/src/app/core/auth/role-landing.ts` and `app.routes.ts`

```ts
case 'LOCATION_MANAGER':
  return ['/location/dashboard'];
```

```ts
{
  path: 'dashboard',
  loadComponent: () =>
    import('./features/location/dashboard/dashboard.component').then((m) => m.LocationDashboardComponent),
},
```

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| Landing page | Verification queue | Dashboard |
| KPIs / charts | None | 7 KPIs; onboarding trend, verification, orders, workload |
| Partner visibility | None in the Location Manager UI | Paged Retailer / Fleet Owner list with onboarding, verification, activation, pending action |
| Reviews | Not available | Retailer reviews (existing data); drivers and vehicles of a fleet owner |
| Search / filter / sort | Not available | Server-side, with paging |
| Date range | None | Today / 7 / 30 days / custom |
| Zone security | Browser-supplied `zoneId`; other endpoints open to any authenticated user | Server derives the zone from the JWT account; endpoints enforce it for Location Managers |
| Performance | — | Aggregation queries; one batch per page; details loaded on demand; no polling |

## 11. Testing

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Log in as a Location Manager | Lands on the dashboard; header shows their zone and city |
| 2 | KPI numbers | Match the database counts for that zone |
| 3 | Switch to *Last 7 days* | Only time-based KPIs and charts change; totals and pending stay the same |
| 4 | Custom range with start after end | Apply is disabled (API would return 400) |
| 5 | Search a business name / email / phone fragment | Matching partners only; results are paged |
| 6 | Filter Verification = *Awaiting review* | Partners whose latest request is awaiting review |
| 7 | Filter Pending action = *None* | Partners with no request or a decided latest request |
| 8 | Sort by Name descending | Reverse alphabetical across all pages |
| 9 | Expand a retailer | Reviews with stars, comment, date; pager if more than 5 |
| 10 | Expand a fleet owner | Drivers (rating shown as *Not rated*) and vehicles; note that ratings are not collected |
| 11 | As Location Manager of zone A call `GET /api/retailers/{id}` of a zone-B retailer | 403 |
| 12 | Call `/api/location-dashboard/summary` as an Operations Manager | 403 |
| 13 | Stop S4 | Order cards show `-` with a notice; rest loads |
| 14 | KPI card *Completed Verifications* | Opens the queue filtered to Approved |

## 12. Final Result

Location Managers now have one screen for their zone: current workload, decisions and onboarding over a chosen period, orders, and a searchable list of every retailer and fleet owner with their reviews, drivers and vehicles. Every read is limited to the caller's own zone by the server, not by the browser.
