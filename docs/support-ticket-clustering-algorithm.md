# Support Ticket Clustering — zone-level incident detection

## The problem

A single support ticket is judged on its own. A customer reports "my delivery was late", the
ticket is created LOW priority, and the SLA sweep (`SupportTicketSlaScheduler`, every 15 min)
leaves it alone for 72 hours before touching it. That is correct behaviour for one late delivery.

It is the wrong behaviour when **five different people in the same zone report the same thing
inside the same afternoon**. Individually every one of those tickets still looks low priority;
collectively they are an operational incident — a rider shortage, a hub problem, a broken
retailer — and nobody sees it, because nothing in the system ever related one ticket to another.

Before this change, a repo-wide search for any clustering/trend/duplicate/aggregation logic over
tickets returned nothing, and `docs/ui-api-mapping.md` recorded "Operations insights (incidents,
zone analysis…)" as an outright GAP.

This feature detects that pattern, escalates the affected tickets automatically, and records the
incident so Support Staff, Super Admins and Operations Managers can see and act on it.

## How a ticket gets a zone

`SupportTicket` has **no zone or city column**, and nothing that cheaply resolves one:

- S4's internal order response (`/api/v1/internal/orders/{id}` → `OrderResponse`) exposes no
  zone or city at all — only a formatted `deliveryAddress` string lives on S4's `Order` entity,
  and it is not in the S6-facing projection.
- `CustomerProfileResponse`, `UserAccountResponse` and `TripResponse` carry no territory either.

The one place a real zone exists is S3's `customer_address` table (`city_id`, `zone_id`). So
territory is resolved **through the raising customer**, with one small extension to S3's existing
internal customer API:

```
GET /api/v1/internal/customers/{customerProfileId}/service-area   (S3, HTTP Basic service auth)
    -> { customerProfileId, cityId, zoneId }
```

It returns the customer's **default** saved address, falling back to their oldest saved address,
and returns null ids (not a 404) when the customer has no usable address.

S6 calls it from `CustomerServiceClient.getCustomerServiceArea(...)`, memoised per sweep so a
zone with twenty complaining customers costs at most twenty calls, not one per ticket.

The territory key is `ZONE:<uuid>`, or `CITY:<uuid>` when an address has a city but no assigned
zone. Zone is preferred because it is the tighter, more actionable unit.

### Known limitations (deliberate)

- **Only customer-raised tickets cluster.** A ticket raised by a driver, retailer or fleet owner
  has no `customerProfileId`, therefore no resolvable territory, and is skipped. Forcing a
  lookup chain through S4/S5 for those would mean new cross-service plumbing that does not exist
  and would still be fragile.
- **A customer with no saved address is skipped**, as is one whose address predates zone
  assignment (city-level clustering still works there).
- **The zone is the customer's home zone, not the order's delivery zone.** They are the same in
  the overwhelmingly common case; a ticket about an order delivered somewhere else is attributed
  to the customer's own zone. Closing that gap needs a zone on S4's internal order response.
- Tickets that cannot be located are **excluded**, never bucketed into an "unknown" group —
  grouping unlocatable tickets together would manufacture incidents out of unrelated complaints.

## The grouping and threshold rules

`TicketClusterAnalyzer` (pure, no I/O, unit tested) groups tickets by:

```
(ticketCategory, ticketSubCategory, territoryKey)
```

over the tickets fed to it by `TicketClusterServiceImpl`, which selects:

- **status** `OPEN` or `IN_PROGRESS` — resolved/closed tickets are history, not a live incident;
- **raised within a rolling 48-hour window**.

A group becomes a cluster when it has **at least 3 DISTINCT raising accounts**.

Why these numbers:

- **3 raisers, not 3 tickets.** One frustrated customer filing the same complaint three times is
  a duplicate-ticket problem, not a zone-wide outage. The threshold is applied to distinct
  `raisedByAccountId` values precisely so that case cannot trip an incident.
- **3, not 2.** On a platform where any two neighbours can independently have a bad delivery day,
  two is noise. Three independent people reporting the same sub-category in the same zone inside
  two days is a pattern that one ticket's priority genuinely cannot express.
- **48 hours.** One full day short of the 72-hour LOW-priority SLA threshold, so a cluster of LOW
  tickets is caught and escalated *before* any of them would have breached SLA on its own — which
  is the entire point. It is also short enough that a problem fixed yesterday stops counting
  toward today's incident.
- **Category *and* sub-category must match.** "Late delivery" and "damaged item" in the same zone
  are two different operational problems and must not be merged into one incident.

## What happens when a cluster is detected

`TicketClusterScheduler` runs `TicketClusterService.detectClusters()` every **30 minutes** (the
SLA sweep's 15 is unnecessary here — a cluster is a property of a 48-hour window — and each pass
costs Feign lookups worth halving). Per detected cluster:

1. **An incident record is persisted** — `TicketClusterIncident` (table
   `ticket_cluster_incident`): category, sub-category, territory key + city/zone ids, ticket
   count, distinct-raiser count, first-seen / last-seen (earliest and latest `raisedAt`),
   detected-at, last-evaluated-at, status `ACTIVE`/`RESOLVED`. A re-detected cluster **updates**
   the existing ACTIVE record rather than creating a duplicate every 30 minutes.
2. **Tickets are linked** to it via the new nullable `SupportTicket.clusterIncidentId` column, so
   an incident's tickets can be listed without re-running detection.
3. **Priority is bumped one tier** (LOW→MEDIUM, MEDIUM→HIGH) for each ticket *the first time it
   joins the incident*, and `dueBy` is recomputed from the new tier's SLA (72h/24h/4h). Already
   linked tickets are left untouched — this is what stops a half-hourly sweep from walking the
   same ticket up to HIGH tier by tier. HIGH tickets are already at the top and are only linked.
4. **A staff-only internal note** is left on each bumped ticket explaining *why* its priority
   changed ("one of N tickets reporting X/Y in ZONE:… within the last 48h, incident <id>"), so
   the change is never a silent mutation.
5. **Incidents that stop appearing** in a pass (tickets resolved, or aged out of the window) are
   auto-marked `RESOLVED` with a `resolvedAt` timestamp.

Note that priority tier / SLA-hour constants are re-stated in `TicketClusterServiceImpl` rather
than shared with `SupportTicketServiceImpl`'s SLA sweep: the two escalation reasons (time
elapsed vs. many-people-same-place) are independent policies that should be free to diverge.
They currently agree.

## Endpoints, and how each role uses them

Mounted under `/api/support-insights` — deliberately *not* nested under `/api/support-tickets`,
whose security matchers include a broad `GET /api/support-tickets/*` that any authenticated user
(including a customer, for their own ticket) can satisfy.

| Method | Path | Roles |
|---|---|---|
| GET | `/api/support-insights/cluster-incidents` | SUPPORT_STAFF, SUPER_ADMIN, OPERATIONS_MANAGER |
| GET | `/api/support-insights/cluster-incidents/{id}` | SUPPORT_STAFF, SUPER_ADMIN, OPERATIONS_MANAGER |
| POST | `/api/support-insights/cluster-incidents/detect` | SUPPORT_STAFF, SUPER_ADMIN, OPERATIONS_MANAGER |

Each incident returns: category, sub-category, territory key, city/zone ids, ticket count,
distinct-raiser count, first-seen, last-seen, detected-at, last-evaluated-at, status, and the
linked tickets' ids and ticket numbers.

**Support Staff.** Opens the active list at the start of a shift. Instead of working five
identical "late delivery" tickets one at a time and re-diagnosing each, they see one incident
with five linked ticket numbers, investigate once, and reply to all five with the same finding —
and they see those tickets are already MEDIUM/HIGH rather than sitting at the bottom of the LOW
queue. Where the incident is beyond first-line (a zone-wide dispatch failure), they escalate one
ticket to OPERATIONS_MANAGER with the incident id in the reason, rather than escalating five.

**Operations Manager.** Reads the same list filtered by their own zones/city, as the "which of my
zones is on fire right now" board. `distinctRaiserCount` plus `firstSeenAt`/`lastSeenAt` tell
them whether it is growing or already tailing off. The plausible action is operational, not
ticket-level: reassign riders to that zone, call the hub, suspend a misbehaving retailer. After
acting, they can `POST .../detect` to refresh rather than waiting up to 30 minutes.

**Super Admin.** Uses the unfiltered list as the platform-wide view — how many zones have active
incidents, whether one category dominates, whether the same zone keeps reappearing (each cycle
leaves a RESOLVED record behind, so repeat offenders are visible over time). The action is
structural: capacity in a chronically failing zone, or a partner review.

## Files

| File | Role |
|---|---|
| `S6-finance-support/.../support/TicketClusterAnalyzer.java` | Pure grouping + threshold decision |
| `S6-finance-support/.../service/TicketClusterService.java` / `TicketClusterServiceImpl.java` | Sweep, zone resolution, incident persistence, priority bump |
| `S6-finance-support/.../support/TicketClusterScheduler.java` | `@Scheduled` 30-minute driver |
| `S6-finance-support/.../entity/TicketClusterIncident.java` | Incident record |
| `S6-finance-support/.../repository/TicketClusterIncidentRepository.java` | Incident lookups |
| `S6-finance-support/.../controller/TicketClusterIncidentController.java` | Insight endpoints |
| `S6-finance-support/.../dto/TicketClusterIncidentView.java`, `TicketClusterSweepSummary.java` | Response shapes |
| `S3-commerce-customer/.../controller/InternalCustomerController.java` | `…/service-area` zone lookup |
| `database.sql` § 32b | `ticket_cluster_incident` DDL |

Tests: `TicketClusterAnalyzerTest` (grouping/threshold: 3-distinct-raiser rule, single-raiser
duplicates, zone split, sub-category split, unlocatable tickets, territory-key precedence) and
`TicketClusterServiceImplTest` (bump-once-on-link, no double bump on re-run, tickets without a
customer profile excluded). The Feign zone-resolution plumbing is not unit tested — a mock-heavy
test there would assert the mocks, not the behaviour.
