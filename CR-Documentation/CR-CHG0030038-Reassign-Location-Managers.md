# CHG0030038 — Reassign Location Managers Across Locations

## 1. CR Overview

| Item | Detail |
| --- | --- |
| CR number | CHG0030038 |
| Title | Reassign Location Managers Across Locations |
| Purpose | Let an Operations Manager move a Location Manager from one zone to another, keep the officer's mappings consistent after the move, and keep a history of previous assignments |
| Main affected area | S1 platform service (Location Manager assignment), the Operations **Location managers** screen; S2 provides the pending-work check |

> This CR covers **moving the officer** between locations. The handling of the officer's open verification work and the controlled deactivation are documented in **CHG0030050**; the two are linked because an officer cannot be moved while work is still pending.

## 2. Understanding the CR

**What was requested**

- As an Operations Manager, transfer a Location Manager from one location to another when business needs change.
- Update all related mappings, permissions, responsibilities, zone access and location ownership.
- Keep historical audit information about previous assignments and the reassignment.

**Why it was required**

A Location Manager's authority is tied to one zone. When the business changes, the officer must be re-pointed to another zone without leaving the old relationships behind and without losing the record of where they were.

**What the system now does**

```text
Operations Manager → Location managers → Transfer
   → choose a free zone in the same city
   → pending work check (blocked until handed over — see CHG0030050)
   → officer's zone/supervisor updated, previous location recorded
   → officer's next request already resolves to the new zone
```

## 3. Existing Problem

- A backend endpoint `PUT /api/v1/location-managers/{id}/transfer` existed, but:
  - **no screen used it** — the Operations Manager could only *Activate/Deactivate* an officer;
  - it **overwrote** the officer's zone and supervisor in place, so the **previous location was lost** (the `location_manager` row holds only the current assignment, one row per account);
  - it did **not check pending verification work**, so an officer could be moved while requests were still waiting on them.
- No history existed to answer "where was this officer before?".

## 4. Root Cause

- The assignment is a single row (`location_manager`: user account, zone, supervising operations manager, status, `assigned_at`). Updating it in place erases the earlier values, and nothing recorded them.
- The transfer method validated the target zone and supervisor but had no rule tying the move to the officer's outstanding work, and there was no UI.

## 5. Solution

Keep the existing assignment model and add three things around it: a **guard**, a **history record**, and a **screen**.

```text
Operations Manager clicks "Transfer" on an officer
    ↓
Officers page (officers.component) → picks a free zone
    ↓
guarded(): GET /api/verification-queues/pending-work/{officerAccount}
    ├── pending work exists → Work Transfer popup (CHG0030050) → runs only when 0 remain
    └── none → continue
    ↓
PUT /api/v1/location-managers/{id}/transfer   { userAccountId, zoneId, operationsManagerId }
    ↓
LocationManagerController.transfer → LocationManagerServiceImpl.transferLocationManager
    ↓  validate zone active · zone free · supervisor active · same city · pending work = 0
    ↓  recordTransfer → location_manager_assignment_history
    ↓  update location_manager (zone, supervisor, ACTIVE, assigned_at)
    ↓
Officers list shows the new zone and "Previously <zone>, <city> · moved <date>"
```

## 6. Implementation Details

### 6.1 Which mappings change — from the code

| Item in the CR | What actually represents it | On transfer |
| --- | --- | --- |
| Location / zone assignment, location ownership | `location_manager.zone_id` | Updated to the new zone |
| Responsibilities / supervisor | `location_manager.operations_manager_id` | Updated (must be an active Operations Manager in the **same city** as the new zone) |
| Assignment date | `location_manager.assigned_at` | Reset to now |
| Status | `assignment_status` | Set to `ACTIVE` |
| Permissions | Role-based (`LOCATION_MANAGER` role in the JWT); there is **no per-zone permission table** | Unchanged — the role stays the same |
| Zone access | Derived at request time. S2 `ZoneScope` reads the officer's current assignment from S1 on **every call** (no cache) | Takes effect immediately with the new zone |
| Verification requests owned by the old zone | Requests are zone-scoped or explicitly assigned to the officer | Must be transferred first (CHG0030050); the move is refused while any remain |
| Previous assignment | **New** `location_manager_assignment_history` row | Written on every zone change |

### 6.2 Backend — S1

- **`entity/LocationManagerAssignmentHistory.java`** (new, table `location_manager_assignment_history`): location manager id, from zone (id + name), from city name, from supervisor, from-assigned-at, to zone (id + name), to city name, to supervisor, `changed_at`. Zone and city **names are copied** so the history stays readable if territory records are renamed.
- **`repository/LocationManagerAssignmentHistoryRepository.java`** (new): newest-first lookups, including one query for a whole list of officers.
- **`service/LocationManagerServiceImpl.transferLocationManager`**: adds the pending-work guard (only when the zone actually changes and the officer is `ACTIVE`), then records the history row before changing the assignment. The existing validations are kept: active zone/city, zone not already held by another active officer, active supervisor, supervisor and zone in the same city.
- **`validateNoPendingReviews`**: asks S2 for the officer's pending work count (`S2PartnerClient.getPendingReviewCount(account, zone)`). It **fails closed** — if S2 cannot be reached the move is blocked.
- **`dto/LocationManagerDto`**: new read-only `stateId`, `previousZoneName`, `previousCityName`, `lastTransferredAt`.
- **List responses** attach the latest history entry to every officer with **one** history query for the page (no N+1).

### 6.3 Frontend — Operations "Location managers" page

- **`officers.component.html/.ts`**: new **Transfer** button next to Deactivate. It opens a card with the zones the officer can move to — same city, no active Location Manager yet, and not the current zone. Confirming runs the same pending-work guard used by Deactivate, then calls the transfer API. Each officer row shows *"Previously <zone>, <city> · moved <date>"* when a transfer happened.
- **`location-manager-assignment.service.ts`**: `transfer(assignment, zoneId)` sends `userAccountId`, `zoneId` and the existing `operationsManagerId`.
- **`audit-events.ts`**: `PUT location-managers/transfer` is added to the audit whitelist as **"Transfer Location Manager"** (internal role + meaningful business action, per the audit rules of CHG0030033).

### 6.4 Validation summary

| Rule | Result if violated |
| --- | --- |
| Target zone must exist and be active (with an active city) | `InvalidAssignmentException` |
| Zone must not already have another **active** Location Manager | `DuplicateResourceException` — "Zone already has an active Location Manager" |
| Supervisor must be an active Operations Manager | `InvalidAssignmentException` |
| Supervisor and zone must be in the same city | `InvalidAssignmentException` |
| Officer must have no pending work | `InvalidAssignmentException` — "Location Manager has N pending verification review(s) assigned; transfer their work before continuing" |
| S2 unreachable | Blocked ("Unable to verify pending reviews…") |

## 7. Execution Flow

1. Operations Manager opens **Location managers** and clicks **Transfer** on an officer in *North Zone, Chennai*.
2. The page lists free zones in Chennai (zones with no active officer, excluding the current one) and the OM selects *South Zone*.
3. The OM clicks **Transfer**. The page asks S2 for the officer's pending work.
4. **No pending work** → `PUT …/transfer` is sent.
5. S1 validates, writes a history row *(North Zone, Chennai → South Zone, Chennai, timestamp)*, and updates the assignment.
6. The list refreshes: the officer shows *South Zone* and *Previously North Zone, Chennai · moved <date>*.
7. The officer's next request (dashboard, queue) resolves to *South Zone*, because the zone is read from the assignment each time.

**Alternate flows**

| Situation | Result |
| --- | --- |
| Pending work exists | Work Transfer popup opens; the move happens only after all work is handed over (CHG0030050) |
| Pending work exists but the popup is cancelled | Nothing changes |
| Chosen zone already has an active officer | Refused (the page does not offer such zones; the API also refuses) |
| Supervisor is in a different city | Refused |
| Officer is inactive | Move allowed without the pending-work check; the assignment becomes `ACTIVE` in the new zone |
| Only the supervisor changes (same zone) | No history row, no pending-work check |
| Zone list is empty | Message "No free zone in this city…" |

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Entity (S1) | `entity/LocationManagerAssignmentHistory.java` | New history table |
| Repository (S1) | `repository/LocationManagerAssignmentHistoryRepository.java` | New |
| Service (S1) | `service/LocationManagerServiceImpl.java` | Pending-work guard, history record, previous-location enrichment |
| Service (S1) | `service/LocationManagerService.java` | New methods in the interface |
| DTO (S1) | `dto/LocationManagerDto.java` | `stateId`, previous-location fields |
| Client (S1) | `client/S2PartnerClient.java` | Pending count now takes the zone |
| Frontend | `features/operations/officers/officers.component.ts/.html` | Transfer button, zone picker, history line |
| Frontend | `core/services/location-manager-assignment.service.ts`, `core/models/location-manager-assignment.model.ts` | `transfer(...)`, history fields |
| Frontend | `core/api/audit-events.ts` | Audit action "Transfer Location Manager" |
| Tests | `LocationManagerServiceImplTest` | Blocked while work pending; history saved on zone move |

## 9. Important Code Changes

### 9.1 Transfer with guard and history — `S1-platform-territory/.../service/LocationManagerServiceImpl.java`

```java
public LocationManagerDto transferLocationManager(UUID locationManagerId, LocationManagerDto request) {
    LocationManager locationManager = findLocationManager(locationManagerId);
    Zone zone = findActiveZone(request.getZoneId());
    boolean zoneChanges = !locationManager.getZone().getId().equals(zone.getId());
    // Moving an officer out of a zone leaves their verification requests behind: every one of them must
    // have been handed to someone else first, and nothing below is written until that is true.
    if (zoneChanges && locationManager.getAssignmentStatus() == AssignmentStatus.ACTIVE) {
        validateNoPendingReviews(locationManager);
    }
    validateZoneAvailability(zone.getId(), locationManagerId);
    OperationsManager operationsManager = findActiveOperationsManager(request.getOperationsManagerId());
    validateSameCity(operationsManager, zone);
    if (zoneChanges) {
        recordTransfer(locationManager, zone, operationsManager);
    }
    locationManager.setZone(zone);
    locationManager.setOperationsManager(operationsManager);
    locationManager.setAssignmentStatus(AssignmentStatus.ACTIVE);
    locationManager.setAssignedAt(OffsetDateTime.now());
    return withLastTransfer(toDto(locationManagerRepository.save(locationManager)));
}
```

Explanation: every check runs before anything is written; the class is `@Transactional`, so the history row and the assignment change succeed or fail together.

### 9.2 History record — same file

```java
/** Keeps the officer's previous location (the LocationManager row only ever holds the current one). */
private void recordTransfer(LocationManager current, Zone newZone, OperationsManager newOperationsManager) {
    LocationManagerAssignmentHistory entry = new LocationManagerAssignmentHistory();
    entry.setLocationManagerId(current.getId());
    entry.setFromZoneId(current.getZone().getId());
    entry.setFromZoneName(current.getZone().getZoneName());
    entry.setFromCityName(current.getZone().getCity().getCityName());
    entry.setFromOperationsManagerId(current.getOperationsManager().getId());
    entry.setFromAssignedAt(current.getAssignedAt());
    entry.setToZoneId(newZone.getId());
    entry.setToZoneName(newZone.getZoneName());
    entry.setToCityName(newZone.getCity().getCityName());
    entry.setToOperationsManagerId(newOperationsManager.getId());
    entry.setChangedAt(OffsetDateTime.now());
    historyRepository.save(entry);
}
```

### 9.3 History table — `.../entity/LocationManagerAssignmentHistory.java`

```java
@Entity
@Table(name = "location_manager_assignment_history")
public class LocationManagerAssignmentHistory {
    ...
    @Column(name = "location_manager_id", nullable = false)
    private UUID locationManagerId;

    @Column(name = "from_zone_id")
    private UUID fromZoneId;
    @Column(name = "from_zone_name", length = 200)
    private String fromZoneName;
    @Column(name = "from_city_name", length = 200)
    private String fromCityName;
    ...
    @Column(name = "changed_at", nullable = false)
    private OffsetDateTime changedAt;
```

### 9.4 Pending-work guard, fails closed — same service

```java
private void validateNoPendingReviews(LocationManager locationManager) {
    S2PartnerClient.PendingReviewCountResponse response;
    try {
        response = s2PartnerClient.getPendingReviewCount(
                locationManager.getUserAccount().getId(), locationManager.getZone().getId());
    } catch (FeignException e) {
        // Fail closed: if S2 can't be reached or errors, we cannot confirm the manager has
        // no pending reviews, so we deliberately block deactivation rather than risk pulling
        // a reviewer out of rotation while items are still assigned to them.
        throw new InvalidAssignmentException(
                "Unable to verify pending reviews for this Location Manager; deactivation blocked");
    }
    if (response.pendingCount() > 0) {
        throw new InvalidAssignmentException("Location Manager has " + response.pendingCount()
                + " pending verification review(s) assigned; transfer their work before continuing");
    }
}
```

### 9.5 Latest history per officer with one query — same service

```java
private void applyLastTransfers(java.util.List<LocationManagerDto> dtos) {
    ...
    java.util.Map<UUID, LocationManagerAssignmentHistory> latest = new java.util.HashMap<>();
    for (LocationManagerAssignmentHistory entry : historyRepository.findByLocationManagerIdInOrderByChangedAtDesc(
            dtos.stream().map(LocationManagerDto::getLocationManagerId).toList())) {
        latest.putIfAbsent(entry.getLocationManagerId(), entry);
    }
    for (LocationManagerDto dto : dtos) {
        LocationManagerAssignmentHistory entry = latest.get(dto.getLocationManagerId());
        if (entry != null) {
            dto.setPreviousZoneName(entry.getFromZoneName());
            dto.setPreviousCityName(entry.getFromCityName());
            dto.setLastTransferredAt(entry.getChangedAt());
        }
    }
}
```

### 9.6 Pending count is zone-aware — `S1-platform-territory/.../client/S2PartnerClient.java`

```java
@GetMapping("/internal/v1/verification-queues/reviewer/{reviewerAccountId}/pending-count")
PendingReviewCountResponse getPendingReviewCount(@PathVariable("reviewerAccountId") UUID reviewerAccountId,
        @org.springframework.web.bind.annotation.RequestParam("zoneId") UUID zoneId);
```

### 9.7 Zone access follows the assignment — `S2-partner-verification/.../security/ZoneScope.java`

```java
/** The caller's ACTIVE Location Manager assignment (zone, city, ...). */
public LocationManagerSummary assignment() {
    UUID account = callerAccountId();
    LocationManagerSummary summary;
    try {
        summary = account == null ? null : locationManagerClient.getByUser(account);
    } catch (Exception lookupFailure) {
        throw new ForbiddenActionException("Your zone assignment could not be confirmed. Please try again.");
    }
    ...
}
```

Explanation: nothing about the officer's zone is cached or copied into their session, so the moment the assignment changes, every zone-scoped call uses the new zone.

### 9.8 Officer screen — `frontend/.../features/operations/officers/officers.component.ts`

```ts
/** Zones an officer can move to: same city, no active Location Manager yet, and not where they already are. */
moveZones(assignment: LocationManagerAssignment): Zone[] {
  const occupied = new Set(this.assignments().filter((a) => a.assignmentStatus === 'ACTIVE').map((a) => a.zoneId));
  return this.zones().filter((z) => z.cityId === assignment.cityId && !occupied.has(z.zoneId) && z.zoneId !== assignment.zoneId);
}

confirmMove(): void {
  const assignment = this.moveFor();
  const zoneId = this.moveZoneId();
  if (!assignment || !zoneId) {
    this.moveError.set('Choose the zone to move this Location Manager to.');
    return;
  }
  this.moveError.set(null);
  this.guarded(assignment, 'moved to another zone', () => {
    this.service.transfer(assignment, zoneId).subscribe({
      next: () => { this.moveFor.set(null); this.snackBar.open('Location Manager moved to the new zone.', 'Dismiss', { duration: 3000 }); this.load(); },
      error: (err) => this.moveError.set(extractErrorMessage(err, 'Could not move this Location Manager.')),
    });
  });
}
```

`officers.component.html`:

```html
@if (a.previousZoneName) {
  <p class="text-xs text-slate-400">Previously {{ a.previousZoneName }}, {{ a.previousCityName }}@if (a.lastTransferredAt) { · moved {{ a.lastTransferredAt | date: 'mediumDate' }} }</p>
}
```

### 9.9 API call — `frontend/.../core/services/location-manager-assignment.service.ts`

```ts
/** Moves an officer to another zone (the server refuses while they still hold pending verification work). */
transfer(assignment: LocationManagerAssignment, zoneId: string): Observable<LocationManagerAssignment> {
  return this.http.put<LocationManagerAssignment>(`/api/v1/location-managers/${assignment.locationManagerId}/transfer`, {
    userAccountId: assignment.userAccountId,
    zoneId,
    operationsManagerId: assignment.operationsManagerId,
  });
}
```

### 9.10 Audit whitelist — `frontend/.../core/api/audit-events.ts`

```ts
'PUT location-managers/transfer': () => 'Transfer Location Manager',
```

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| UI | No way to transfer an officer | **Transfer** button with a zone picker |
| Previous location | Overwritten and lost | Recorded in `location_manager_assignment_history`, shown on the officer row |
| Pending work | Not checked on transfer | Move refused until all pending work is handed over |
| Zone access after move | — | Immediate (zone read from the assignment on every call) |
| Audit | Transfer not in the audit whitelist | "Transfer Location Manager" is audited for internal roles |
| Listing performance | — | One history query per page of officers |

## 11. Testing

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Transfer an officer with no pending work to a free zone in the same city | Success; row shows the new zone and *Previously …* |
| 2 | Check the database | New row in `location_manager_assignment_history` with from/to zone and city names and `changed_at` |
| 3 | Transfer while the officer has pending requests | Work Transfer popup opens; nothing changes until zero remain; API alone returns 400 with the pending count |
| 4 | Choose a zone that already has an active officer | Not offered in the list; API returns "Zone already has an active Location Manager" |
| 5 | Supervisor from a different city | Refused |
| 6 | Log in as the moved officer | Dashboard and queue show the **new** zone's data |
| 7 | Old zone | Has no active officer until another is assigned |
| 8 | Stop S2 and try to transfer | Blocked ("Unable to verify pending reviews…") |
| 9 | Change only the supervisor | No history row and no pending-work check |
| 10 | Audit log | "Transfer Location Manager" entry for the acting Operations Manager |

Automated (`LocationManagerServiceImplTest`): moving to another zone is blocked while pending work exists and nothing is saved; moving with no pending work stores the previous location in history.

## 12. Final Result

An Operations Manager can now move a Location Manager to another zone from the UI. The move is refused while the officer still has pending verification work, the officer's previous location is kept, and the officer's zone-scoped access follows the new assignment immediately.

---

## Test Files Created for This CR

These are the backend test files that belong to this change request (paths from the project root):

| Test file | What it checks |
| --- | --- |
| `S1-platform-territory/src/test/java/com/cbg/lbos/service/LocationManagerServiceImplTest.java` | Transfer to another zone / same-zone rejection / zones that already have officers; deactivation blocked while reviews are pending or S2 is unreachable. |

---

## Main Code Location

| Item | Location |
| --- | --- |
| File | `S1-platform-territory/src/main/java/com/cbg/lbos/service/LocationManagerServiceImpl.java` |
| Place | method `transferLocationManager(UUID, LocationManagerDto)` |
| Why this is the main place | Moves a Location Manager to another zone (and Operations Manager) and records the assignment history. |

A banner comment `CR_CHG0030038_Reassign_Location_Managers_3238451` marks this place in the source code.
