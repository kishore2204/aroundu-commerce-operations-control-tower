# CHG0030050 — Reassign Verification Requests and Controlled Location Manager Deactivation

## 1. CR Overview

| Item | Detail |
| --- | --- |
| CR number | CHG0030050 |
| Title | Reassign Verification Requests, Controlled Location Manager Deactivation with Mandatory Work Reassignment |
| Purpose | Let an Operations Manager move pending verification requests (individually or in bulk) from one Location Manager to another, and make disabling / deactivating / moving a Location Manager impossible until all of their pending work has been handed over |
| Main affected area | S2 verification queue (pending-work and transfer endpoints), S1 Location Manager rules, a new **Work Transfer popup**, the Operations "Location managers" page and the Admin "Accounts" page |

## 2. Understanding the CR

**What was requested**

1. Reassign pending verification requests between Location Managers to balance workload — individually or in bulk, notify the new Location Manager, and make the requests appear immediately in the new manager's queue and dashboard metrics.
2. When deactivating/disabling a Location Manager, show their open work in a **popup** with reassignment options, and **prevent deactivation until all open work has been reassigned**.

**Why it was required**

If a Location Manager was removed while requests were still waiting for them, those requests would be stranded. Workload also could not be rebalanced in bulk.

**What the system now does**

```text
Operations Manager: Deactivate / Disable / Transfer a Location Manager
        ↓
   pending work?  ── no ──→ action proceeds, no popup
        │ yes
        ↓
   Work Transfer popup (left: pending requests + checkboxes, right: choose a Location Manager)
        ↓  Transfer (individual or bulk, partial allowed)
   remaining > 0 → popup stays open       remaining = 0 → popup closes → original action continues
```

## 3. Existing Problem

- `deactivateAssignment` already refused when S2 reported pending reviews, but:
  - S2 counted **only requests explicitly assigned** to the officer (`reviewed_by_account_id`). Requests that simply sat in the officer's zone were **not counted**, so an officer with a full queue could be deactivated with "0 pending".
  - The UI answered a refusal with a **toast message**, not a way to fix it.
- Only **Deactivate** was guarded. **Disabling the account** (Admin → Accounts → Suspend) and **transferring the officer to another zone** were not.
- Reassignment existed only one request at a time (`PATCH /api/verification-queues/{id}/assign` from the Operations dashboard, capped at 15 pending items per reviewer), with no bulk option and no notification.
- A request handed to another Location Manager in a different zone would not appear in their queue, because the queue list was filtered by **zone only**.

## 4. Root Cause

1. **No single definition of "pending work".** Deactivation counted explicit assignments; the queue view used the zone; the dashboard had no equivalent. The counts could disagree.
2. **Ownership was implicit.** A request "belongs" to a zone; only some requests had an explicit reviewer. A transfer needs a real owner field that every view respects.
3. **The guard was a refusal, not a workflow**, and covered one action out of three.

## 5. Solution

**One definition, used everywhere** (`VerificationWork` in S2): a request is *pending* while it is open and in `SENT_TO_LOCATION_MANAGER` (awaiting review) or `RESUBMISSION_REQUIRED` (waiting for the user's corrected document, then returns for review). It **belongs** to a Location Manager if it is explicitly assigned to them (`reviewed_by_account_id`) or, when nobody is assigned, it sits in their zone.

Transferring a request means setting `reviewed_by_account_id` to the new Location Manager. Every view then respects it.

```text
Operations Manager clicks Deactivate / Transfer (Officers page) or Suspend (Accounts page)
    ↓
Frontend guard → GET /api/verification-queues/pending-work/{officerAccountId}
    ↓
VerificationQueueController.getPendingWork → VerificationQueueServiceImpl.getPendingWork
    ↓  S1 lookup of the officer's zone · OM may only view officers under them
    ↓  VerificationQueueRepository.findPendingWork(officer, zone, PENDING_STATUSES)
    ↓
[] → run the action           [items] → Work Transfer popup
    ↓
Popup: candidates = GET /api/v1/location-managers/{id}/transfer-candidates (S1: active, same state, not self)
    ↓
Transfer → POST /api/verification-queues/transfer-work { from, to, queueIds[] }
    ↓
VerificationQueueServiceImpl.transferWork  (each request moves or fails on its own)
    ↓  reviewed_by_account_id = new officer · notification (after commit) · remainingPending returned
    ↓
remainingPending = 0 → popup closes → original action runs (S1 re-checks; refuses if anything remains)
```

## 6. Implementation Details

### 6.1 Backend — S2

**Endpoints** (`VerificationQueueController`):

| Endpoint | Purpose | Access |
| --- | --- | --- |
| `GET /api/verification-queues/pending-work/{reviewerAccountId}` | The officer's pending requests for the popup | Super Admin, Operations Manager (SecurityConfig + gateway) |
| `POST /api/verification-queues/transfer-work` | Individual / bulk transfer | Super Admin, Operations Manager |
| `GET /internal/v1/verification-queues/reviewer/{id}/pending-count?zoneId=` | Count used by S1 to block deactivate / move / disable | Service-to-service |

An Operations Manager can only view or move the work of Location Managers **they supervise** (`requireSupervisionOf`); Super Admin can act on any.

**`getPendingWork`** returns `PendingWorkItemDTO` (queue handle, type, **partner name**, status, submitted date). Names come from one query per type for retailers and fleet owners, and best-effort calls to S5 for drivers/vehicles. No ids are shown to the user.

**`transferWork(fromAccount, toAccount, queueIds)`**

1. Refuses transferring to the same officer.
2. Looks up both officers in S1. The target must be **active** and in the **same state** as the source (the "eligible Location Manager" rule).
3. For each requested request, independently:
   - not found → *"This request no longer exists"*;
   - not pending with the source officer (already decided, already moved) → *"This request is no longer pending with this Location Manager"*;
   - the target is the request's own submitter → *"A reviewer cannot decide on their own submission"*;
   - otherwise `reviewed_by_account_id` is set to the target.
4. Sends one notification to the target after the transaction commits.
5. Returns `transferred[]`, `failed[]` (with reasons) and `remainingPending` (a fresh count).

Only checks that can fail run before a request is written, so a request is never half-moved. The 15-item cap of the ad-hoc `assign` endpoint is intentionally **not** applied here, because a mandatory hand-over must be able to complete.

**Notification.** The new Location Manager gets an in-app notification (existing S2 → S6 notification client, type `VERIFICATION_WORK_ASSIGNED`): *"N verification requests have been transferred to you from <name>. Open your verification queue to review them."* Location Managers now have a **Notifications** menu item (reusing the existing notifications page).

**Reflecting in the new officer's queue and dashboard.**

- Queue: `findVisibleToReviewer` returns requests assigned to the officer **plus** their zone's requests that are decided or not handed to someone else. `GET /api/verification-queues` and `/status/{status}` use it for Location Managers.
- Dashboard: pending counts and the workload chart use `countPendingByType`, which follows the same ownership rule (CHG0030046).
- The old officer no longer sees or can act on a request handed away (`ZoneScope.canSee`).

### 6.2 Backend — S1 (controlled deactivation)

- `S2PartnerClient.getPendingReviewCount(account, zone)` — now zone-aware, so unassigned zone work counts.
- **Deactivate** (`deactivateAssignment`), **transfer to another zone** (CHG0030038) and **account disable** (`assertAccountStatusChangeAllowed`, called from `UserAccountController` for any status other than `ACTIVE`) all call the same `validateNoPendingReviews`. It **fails closed** if S2 cannot answer.
- `GET /api/v1/location-managers/{id}/transfer-candidates` → active Location Managers in the same state (active account, `LOCATION_MANAGER` role, `ACTIVE` assignment), excluding the officer.

### 6.3 Frontend

**`shared/work-transfer/work-transfer-dialog.component.ts`** (new) — the popup:

- **Left:** heading *Pending Verification Work*, "N pending work items", **Select All** (with a partial state), **"N selected"**, and the list with one checkbox per request. Each row shows *type: partner name*, status and submitted date. Only this list scrolls (`h-72 overflow-y-auto`); the popup does not grow with the list. Select All applies to the whole pending set, not only visible rows.
- **Right:** heading *Choose Location Manager to transfer work*, a dropdown whose options show **Name / City / Zone** (no ids), and the **Transfer** button below it.
- **Validation:** *"Select at least one pending work item to transfer."* and *"Choose a Location Manager to transfer the work to."*
- **Partial transfer:** transferred items leave the list immediately, the selection resets, and the popup stays open while items remain. Items that failed stay, with their reason, and can be retried. An HTTP failure removes nothing and shows an error.
- **Completion:** when the server reports `remainingPending = 0` the popup emits `completed`; the host shows *"All pending work has been successfully transferred."* and runs the original action. If the real remaining count differs from what is displayed, the list is reloaded from the server.
- Closing the popup (X or Esc) means **cancelled** — the original action is not performed.

**`features/operations/officers/officers.component.*`** — `guarded(...)` wraps **Deactivate** and **Transfer**: no pending work → runs immediately without a popup; pending work → popup; if the pending work cannot be read the action is not carried out.

**`features/admin/accounts/accounts.component.*`** — the same guard for **Suspend** on a `LOCATION_MANAGER` account (the officer's assignment is looked up so their eligible targets can be listed).

**`verification-queue.service.ts`** — `pendingWork(...)`, `transferWork(...)`. **`audit-events.ts`** — `POST verification-queues/transfer-work` → *"Transfer Verification Work"*.

### 6.4 Scope notes (what the data model allows)

- The CR mentions *open verification requests, pending approvals and active assignments*. In the code the only work owned by a Location Manager is the **verification request** (awaiting review, or waiting for a re-upload that returns to them for review), so those are the items in the popup. There is no other kind of assignment attached to a Location Manager to list.
- Reassignment is chosen **per selection**: the Operations Manager ticks one or more items and picks one target officer per Transfer click; sending different items to different officers is done with repeated transfers (as in the flow below), not with a dropdown on each row.
- The earlier per-request "Rebalance" list on the Operations dashboard (`PATCH /api/verification-queues/{id}/assign`) is unchanged.

## 7. Execution Flow

1. Operations Manager clicks **Deactivate** on *Alex Morgan* (10 pending requests).
2. The page reads the pending work → 10 items → popup opens: *"There are pending verification requests assigned to this Location Manager. Transfer all pending work before continuing."*
3. OM selects 5 items, chooses *John Doe – Chennai – Zone 1*, clicks **Transfer**.
4. S2 moves 5 requests, notifies John Doe, returns `remainingPending = 5`. The 5 items disappear; the popup stays open.
5. OM clicks **Select All** (the remaining 5), chooses *Jane Doe – Chennai – Zone 2*, **Transfer**.
6. `remainingPending = 0` → popup closes → message *"All pending work has been successfully transferred."* → **Deactivate** is sent and now succeeds.
7. John Doe and Jane Doe see the requests in their queue and pending counts; Alex sees none.

**Alternate flows**

| Situation | Result |
| --- | --- |
| No pending work | No popup; the action proceeds |
| Partial transfer | Popup stays open; **Deactivate is not sent** |
| One request already decided meanwhile | It stays listed with its reason; the others move |
| Transfer request fails (network/server) | Nothing removed; error shown; retry possible |
| Popup closed with work remaining | Original action not performed |
| Deactivate API called directly with work pending | S1 refuses: *"…pending verification review(s) assigned; transfer their work before continuing"* |
| S2 unreachable | Refused (fails closed) |
| Target inactive or in another state | 409 from S2 (and not offered in the dropdown) |
| Operations Manager tries an officer they do not supervise | 403 |
| New work arrives while the popup is open | Server count differs from the list → list reloaded, popup stays open |

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Service (S2) | `service/VerificationWork.java` (new) | The single "pending work" definition |
| Service (S2) | `service/VerificationQueueServiceImpl.java` | `getPendingWork`, `transferWork`, notification, visibility |
| Controller (S2) | `controller/VerificationQueueController.java` | `pending-work` and `transfer-work` endpoints; Location Manager queue scoping |
| Controller (S2) | `controller/InternalVerificationQueueController.java` | Zone-aware pending count |
| Repository (S2) | `repository/VerificationQueueRepository.java` | `findPendingWork`, `countPendingWork`, `findVisibleToReviewer` |
| DTO (S2) | `PendingWorkItemDTO`, `TransferWorkRequestDTO`, `TransferWorkResultDTO` | New |
| Security (S2) + Gateway | `SecurityConfig.java`, `RouteAuthorizationRules.java` | Restrict the new endpoints to Super Admin / Operations Manager |
| Service (S1) | `LocationManagerServiceImpl`, `LocationManagerController` | Candidates endpoint, disable guard |
| Controller (S1) | `UserAccountController` | Calls the guard before changing an account's status |
| Frontend | `shared/work-transfer/work-transfer-dialog.component.ts` | The popup |
| Frontend | `officers.component.*`, `accounts.component.*` | Guard on Deactivate / Transfer / Suspend |
| Frontend | `verification-queue.service.ts`, `verification.model.ts`, `location-manager-assignment.service.ts` | API calls and types |
| Frontend | `location-shell.component.ts`, `app.routes.ts` | Notifications menu for Location Managers |
| Tests | `VerificationWorkTransferTest`, `LocationManagerServiceImplTest` | Definition, partial transfer, failures, notification, permissions |

## 9. Important Code Changes

### 9.1 One definition of pending work — `S2-partner-verification/.../service/VerificationWork.java`

```java
/** Statuses of an open request that the Location Manager still has to work through. */
public static final List<String> PENDING_STATUSES = List.of("SENT_TO_LOCATION_MANAGER", "RESUBMISSION_REQUIRED");
...
/** Pending work owned by this reviewer: assigned to them, or unassigned in their zone. */
public static boolean isPendingFor(VerificationQueue queue, UUID reviewerAccountId, UUID reviewerZoneId) {
    if (!isPending(queue)) {
        return false;
    }
    if (queue.getReviewedByAccountId() != null) {
        return queue.getReviewedByAccountId().equals(reviewerAccountId);
    }
    return reviewerZoneId != null && reviewerZoneId.equals(queue.getZoneId());
}
```

### 9.2 Queries — `.../repository/VerificationQueueRepository.java`

```java
/** A reviewer's pending work: assigned to them, or unassigned in their zone - see VerificationWork. */
@org.springframework.data.jpa.repository.Query("select q from VerificationQueue q where q.isActive = true and q.verificationStatus in :statuses "
        + "and (q.reviewedByAccountId = :reviewer or (q.reviewedByAccountId is null and q.zoneId = :zoneId)) order by q.createdAt asc")
List<VerificationQueue> findPendingWork(@org.springframework.data.repository.query.Param("reviewer") UUID reviewerAccountId,
        @org.springframework.data.repository.query.Param("zoneId") UUID zoneId,
        @org.springframework.data.repository.query.Param("statuses") Collection<String> statuses);

@org.springframework.data.jpa.repository.Query("select count(q) from VerificationQueue q where q.isActive = true and q.verificationStatus in :statuses "
        + "and (q.reviewedByAccountId = :reviewer or (q.reviewedByAccountId is null and q.zoneId = :zoneId))")
long countPendingWork(@org.springframework.data.repository.query.Param("reviewer") UUID reviewerAccountId,
        @org.springframework.data.repository.query.Param("zoneId") UUID zoneId,
        @org.springframework.data.repository.query.Param("statuses") Collection<String> statuses);

/** What a Location Manager may see: requests assigned to them, plus their zone's requests that are decided or not handed to someone else. */
@org.springframework.data.jpa.repository.Query("select q from VerificationQueue q where (q.reviewedByAccountId = :reviewer or (q.zoneId = :zoneId "
        + "and (q.reviewedByAccountId is null or q.isActive = false or q.verificationStatus not in :pending)))")
List<VerificationQueue> findVisibleToReviewer(@org.springframework.data.repository.query.Param("reviewer") UUID reviewerAccountId,
        @org.springframework.data.repository.query.Param("zoneId") UUID zoneId,
        @org.springframework.data.repository.query.Param("pending") Collection<String> pendingStatuses);
```

### 9.3 Endpoints — `.../controller/VerificationQueueController.java`

```java
@GetMapping("/pending-work/{reviewerAccountId}")
public ResponseEntity<List<com.example.lbos.dto.PendingWorkItemDTO>> getPendingWork(@PathVariable UUID reviewerAccountId) {
    return ResponseEntity.ok(service.getPendingWork(reviewerAccountId));
}

@PostMapping("/transfer-work")
public ResponseEntity<com.example.lbos.dto.TransferWorkResultDTO> transferWork(
        @Valid @RequestBody com.example.lbos.dto.TransferWorkRequestDTO request) {
    return ResponseEntity.ok(service.transferWork(request));
}
```

`.../dto/TransferWorkRequestDTO.java` and `TransferWorkResultDTO.java`:

```java
public record TransferWorkRequestDTO(
        @NotNull UUID fromReviewerAccountId,
        @NotNull UUID toReviewerAccountId,
        @NotEmpty List<UUID> verificationQueueIds) {
}

public record TransferWorkResultDTO(
        List<UUID> transferred,
        List<Failure> failed,
        long remainingPending) {

    public record Failure(UUID verificationQueueId, String reason) {
    }
}
```

### 9.4 The transfer — `.../service/VerificationQueueServiceImpl.java`

```java
if (request.fromReviewerAccountId().equals(request.toReviewerAccountId())) {
    throw new InvalidVerificationTransitionException("Choose a different Location Manager to transfer the work to");
}
LocationManagerClient.LocationManagerSummary from = lookupLocationManager(request.fromReviewerAccountId());
requireSupervisionOf(from);
LocationManagerClient.LocationManagerSummary to = lookupLocationManager(request.toReviewerAccountId());
if (!to.isActive()) {
    throw new InvalidVerificationTransitionException("The selected Location Manager is not active");
}
if (to.stateId() == null || !to.stateId().equals(from.stateId())) {
    throw new InvalidVerificationTransitionException("Work can only be transferred to a Location Manager in the same state");
}
```

```java
for (UUID id : new java.util.LinkedHashSet<>(request.verificationQueueIds())) {
    VerificationQueue queue = requested.get(id);
    String problem = null;
    if (queue == null) {
        problem = "This request no longer exists";
    } else if (!VerificationWork.isPendingFor(queue, request.fromReviewerAccountId(), from.zoneId())) {
        problem = "This request is no longer pending with this Location Manager";
    } else if (request.toReviewerAccountId().equals(queue.getSubmittedByAccountId())) {
        problem = "A reviewer cannot decide on their own submission";
    }
    if (problem != null) {
        failed.add(new com.example.lbos.dto.TransferWorkResultDTO.Failure(id, problem));
        continue;
    }
    queue.setReviewedByAccountId(request.toReviewerAccountId());
    queue.setUpdatedAt(OffsetDateTime.now());
    verificationQueueRepository.save(queue);
    transferred.add(id);
}

if (!transferred.isEmpty()) {
    notifyWorkAssigned(request.toReviewerAccountId(), transferred.size(), from.displayName());
}
long remaining = verificationQueueRepository.countPendingWork(
        request.fromReviewerAccountId(), from.zoneId(), VerificationWork.PENDING_STATUSES);
return new com.example.lbos.dto.TransferWorkResultDTO(transferred, failed, remaining);
```

### 9.5 Supervision check and notification — same file

```java
boolean operationsManager = authentication.getAuthorities().stream()
        .anyMatch(authority -> "ROLE_OPERATIONS_MANAGER".equals(authority.getAuthority()));
UUID caller = resolveAuthenticatedUserAccountId();
if (operationsManager && (caller == null || !caller.equals(locationManager.operationsManagerAccountId()))) {
    throw new com.example.lbos.exception.ForbiddenActionException("This Location Manager is not under your supervision");
}
```

```java
new com.example.lbos.client.NotificationClient.NotificationCreateRequest(
        toAccountId, "LOCATION_MANAGER", "VERIFICATION_WORK_ASSIGNED", "VERIFICATION_QUEUE", null,
        "Verification work assigned to you",
        count + (count == 1 ? " verification request has" : " verification requests have")
                + " been transferred to you from " + fromName + ". Open your verification queue to review "
                + (count == 1 ? "it." : "them."));
AfterCommit.run("Notifying " + toAccountId + " about transferred verification work", () -> notificationClient.create(request));
```

### 9.6 Count used by S1 to block the action — `.../controller/InternalVerificationQueueController.java`

```java
public ResponseEntity<PendingReviewCountResponse> pendingCount(@PathVariable UUID reviewerAccountId,
        @org.springframework.web.bind.annotation.RequestParam(required = false) UUID zoneId) {
    // With the reviewer's zone this is their full pending work (assigned + unassigned in the zone); without it,
    // only what was explicitly assigned to them - the count the older callers always got.
    long pending = zoneId != null
            ? service.getPendingWorkCount(reviewerAccountId, zoneId)
            : service.getPendingReviewCountForReviewer(reviewerAccountId);
    return ResponseEntity.ok(new PendingReviewCountResponse(pending));
}
```

### 9.7 Access rules — `S2 SecurityConfig.java` and gateway `RouteAuthorizationRules.java`

```java
.requestMatchers(org.springframework.http.HttpMethod.GET,
        "/api/verification-queues/pending-work/*")
.hasAnyRole("SUPER_ADMIN", "OPERATIONS_MANAGER")
```

```java
new RouteAuthorizationRule("/api/verification-queues/pending-work/*", PLATFORM_STAFF),
new RouteAuthorizationRule("/api/verification-queues/transfer-work", PLATFORM_STAFF),
```

(The `POST` is already covered by the existing S2 rule that limits `POST /api/verification-queues/**` to Super Admin and Operations Manager.)

### 9.8 Disable-account guard and eligible targets — S1

`LocationManagerServiceImpl`:

```java
public void assertAccountStatusChangeAllowed(UUID userAccountId, String newStatus) {
    if (newStatus == null || "ACTIVE".equalsIgnoreCase(newStatus.trim())) {
        return;
    }
    locationManagerRepository.findFirstByUserAccountIdOrderByAssignedAtDesc(userAccountId)
            .filter(locationManager -> locationManager.getAssignmentStatus() == AssignmentStatus.ACTIVE)
            .ifPresent(this::validateNoPendingReviews);
}

public java.util.List<LocationManagerDto> getTransferCandidates(UUID locationManagerId) {
    LocationManager source = findLocationManager(locationManagerId);
    UUID stateId = source.getZone().getCity().getState().getId();
    return locationManagerRepository.findTransferCandidates(stateId, locationManagerId, AssignmentStatus.ACTIVE)
            .stream().map(this::toDto).toList();
}
```

`UserAccountController`:

```java
locationManagerService.assertAccountStatusChangeAllowed(id, statusRequest.accountStatus());
return ResponseEntity.ok(
        userAccountService
                .updateAccountStatus(id, statusRequest.accountStatus()));
```

`LocationManagerRepository`:

```java
@Query("select lm from LocationManager lm join fetch lm.userAccount ua join fetch lm.zone z join fetch z.city c " +
       "where c.state.id = :stateId and lm.id <> :excludedId and lm.assignmentStatus = :status " +
       "and upper(ua.accountStatus) = 'ACTIVE' and upper(ua.role) = 'LOCATION_MANAGER' " +
       "order by c.cityName, z.zoneName")
java.util.List<LocationManager> findTransferCandidates(@Param("stateId") UUID stateId,
        @Param("excludedId") UUID excludedLocationManagerId, @Param("status") AssignmentStatus status);
```

### 9.9 Popup: select all, count, layout — `frontend/.../shared/work-transfer/work-transfer-dialog.component.ts`

```ts
/** Applies to the whole pending set, not only the rows currently scrolled into view. */
toggleAll(checked: boolean): void {
  this.selected.set(checked ? new Set(this.items().map((item) => item.verificationQueueId)) : new Set());
}
```

```html
<div class="mt-4 grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6">
  <!-- LEFT: pending verification work -->
  <section class="flex min-w-0 flex-col rounded-xl border border-slate-200">
    ...
    <span class="text-sm font-semibold text-violet-700">{{ selected().size }} selected</span>
    ...
    <ul class="m-0 h-72 list-none divide-y divide-slate-100 overflow-y-auto p-0">
  ...
  <!-- RIGHT: who takes the work -->
  <h3 class="m-0 text-sm font-bold text-slate-900">Choose Location Manager to transfer work</h3>
```

### 9.10 Popup: transfer, partial results, completion — same file

```ts
transfer(): void {
  if (this.transferring()) return;
  this.notice.set(null);
  if (this.selected().size === 0) {
    this.error.set('Select at least one pending work item to transfer.');
    return;
  }
  const target = this.target();
  if (!target) {
    this.error.set('Choose a Location Manager to transfer the work to.');
    return;
  }
  ...
  this.queues.transferWork(this.officerUserAccountId, target.userAccountId, [...this.selected()]).subscribe({
    next: (result) => {
      this.transferring.set(false);
      // Only what the server confirms as moved leaves the list; anything else stays, with its reason.
      const moved = new Set(result.transferred);
      this.items.update((items) => items.filter((item) => !moved.has(item.verificationQueueId)));
      this.selected.set(new Set());
      this.failures.set(Object.fromEntries(result.failed.map((f) => [f.verificationQueueId, f.reason])));
      ...
      if (result.remainingPending === 0) {
        this.completed.emit();
      } else if (this.items().length !== result.remainingPending) {
        this.reload(); // the officer's real workload differs from what is shown - never leave a stale list
      }
    },
    error: (err) => {
      this.transferring.set(false);
      this.error.set(extractErrorMessage(err, 'The transfer failed. Nothing was moved - please try again.'));
    },
  });
}
```

### 9.11 Blocking the original action — `frontend/.../officers.component.ts`

```ts
/**
 * Disable / deactivate / move only ever proceeds with nothing pending: no pending work -> straight through,
 * no popup; pending work -> the Work Transfer popup, and the action runs only once it reports zero left.
 * If the pending work cannot be read the action is not carried out.
 */
private guarded(assignment: LocationManagerAssignment, actionLabel: string, run: () => void): void {
  this.busyId.set(assignment.locationManagerId);
  this.queueService.pendingWork(assignment.userAccountId).subscribe({
    next: (items) => {
      this.busyId.set(null);
      if (items.length === 0) run();
      else this.transferGate.set({ assignment, actionLabel, run });
    },
    error: (err) => {
      this.busyId.set(null);
      this.snackBar.open(extractErrorMessage(err, 'Could not check this Location Manager\'s pending work.'), 'Dismiss', { duration: 3500 });
    },
  });
}

onWorkTransferred(): void {
  const gate = this.transferGate();
  this.transferGate.set(null);
  this.snackBar.open('All pending work has been successfully transferred.', 'Dismiss', { duration: 3500 });
  gate?.run();
}

setActive(assignment: LocationManagerAssignment, active: boolean): void {
  const apply = (): void => {
    this.service.setActive(assignment.locationManagerId, active).subscribe({
      next: () => this.load(),
      error: (err) => this.snackBar.open(extractErrorMessage(err), 'Dismiss', { duration: 3500 }),
    });
  };
  if (active) apply(); else this.guarded(assignment, 'deactivated', apply);
}
```

`officers.component.html`:

```html
@if (transferGate(); as gate) {
  <app-work-transfer-dialog
    [officerName]="officerName(gate.assignment)"
    [officerUserAccountId]="gate.assignment.userAccountId"
    [locationManagerId]="gate.assignment.locationManagerId"
    [actionLabel]="gate.actionLabel"
    (completed)="onWorkTransferred()"
    (cancelled)="transferGate.set(null)" />
}
```

### 9.12 The same guard on "disable account" — `frontend/.../features/admin/accounts/accounts.component.ts`

```ts
setStatus(account: UserAccount, status: string): void {
  // Taking a Location Manager out of service is blocked while they still hold pending verification work:
  // no pending work -> straight through; otherwise the Work Transfer popup, then the change.
  if (account.role === 'LOCATION_MANAGER' && status !== 'ACTIVE') {
    this.queueService.pendingWork(account.id).subscribe({
      next: (items) => (items.length === 0 ? this.applyStatus(account, status) : this.openTransfer(account, status)),
      error: (err) => this.showToast(extractErrorMessage(err, 'Could not check this Location Manager\'s pending work.')),
    });
    return;
  }
  this.applyStatus(account, status);
}
```

### 9.13 API calls — `frontend/.../core/services/verification-queue.service.ts`

```ts
pendingWork(reviewerAccountId: string): Observable<PendingWorkItem[]> {
  return this.http.get<PendingWorkItem[]>(`/api/verification-queues/pending-work/${reviewerAccountId}`);
}

transferWork(fromReviewerAccountId: string, toReviewerAccountId: string, verificationQueueIds: string[]): Observable<TransferWorkResult> {
  return this.http.post<TransferWorkResult>('/api/verification-queues/transfer-work', {
    fromReviewerAccountId,
    toReviewerAccountId,
    verificationQueueIds,
  });
}
```

### 9.14 Ownership rule for the officer's own screens — `S2 security/ZoneScope.java`

```java
public static boolean canSee(VerificationQueueDTO queue, UUID accountId, UUID zoneId) {
    if (accountId != null && accountId.equals(queue.getReviewedByAccountId())) {
        return true;
    }
    if (zoneId == null || !zoneId.equals(queue.getZoneId())) {
        return false;
    }
    boolean pending = Boolean.TRUE.equals(queue.getIsActive()) && queue.getVerificationStatus() != null
            && VerificationWork.PENDING_STATUSES.contains(queue.getVerificationStatus().toUpperCase());
    return queue.getReviewedByAccountId() == null || !pending;
}
```

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| "Pending work" | Only explicitly assigned requests; zone queue not counted | One definition: assigned **or** unassigned in the officer's zone |
| Deactivate with pending work | Refusal shown as a toast | **Work Transfer popup**; action continues only at zero |
| Disable account / move to another zone | Not guarded | Same guard (UI and server) |
| Reassignment | One request at a time, max 15 per reviewer, no notification | Individual **and** bulk, partial allowed, no cap, notification to the new manager |
| New manager's queue | Zone-filtered only — transferred work from another zone invisible | Queue shows assigned + zone requests; pending counts and dashboard follow |
| Failure handling | — | Per-request success/failure; failed items stay with a reason; retry |
| Eligible targets | Any | Active Location Managers in the same state (server-checked) |
| Audit | — | "Transfer Verification Work" is audited for internal roles |

## 11. Testing

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Deactivate a Location Manager with **no** pending work | No popup; deactivated |
| 2 | Deactivate one with 10 pending | Popup: left list (10, "0 selected"), right dropdown |
| 3 | Select All | All 10 ticked, "10 selected"; untick clears |
| 4 | Tick 2 individual items | "2 selected"; Select All shows partial state |
| 5 | Transfer with nothing selected / no target | Validation messages; nothing sent |
| 6 | Transfer 5 to *John Doe · Chennai · Zone 1* | 5 disappear, "5 pending work items", popup open, deactivation **not** sent |
| 7 | Transfer remaining 5 to another officer | Popup closes, success message, deactivation happens |
| 8 | Dropdown options | Only active Location Managers in the same state; each shows name, city, zone |
| 9 | Long list | Only the left list scrolls; right side and popup height stay fixed |
| 10 | New officer opens Verification Queue / Dashboard | Transferred requests visible; pending counts increased |
| 11 | New officer's Notifications | "N verification requests have been transferred to you…" |
| 12 | Old officer | No longer sees or can decide the moved requests |
| 13 | Simulate a request decided while the popup is open | Stays listed with "no longer pending…"; others move |
| 14 | Call `PATCH …/deactivate` directly with work pending | 400 with pending count |
| 15 | Super Admin → Accounts → Suspend a Location Manager with work | Same popup; suspend happens after the transfer |
| 16 | Operations Manager opens pending-work of an officer they do not supervise | 403 |
| 17 | Close popup (X / Esc) with work remaining | Nothing changes |

Automated: `VerificationWorkTransferTest` (pending-work definition, popup list with partner names, partial transfer, failure isolation, single notification, ineligible targets, supervision rule, visibility rule) and `LocationManagerServiceImplTest` (blocked while pending, disable guard, transfer candidates).

## 12. Final Result

A Location Manager can no longer be deactivated, disabled or moved while any verification work is pending. The Operations Manager is shown that work in a two-panel popup and can hand it over individually or in bulk, in as many steps as needed; the new officers see it immediately in their queue, counts and notifications, and only when nothing remains does the original action go through.

---

## Test Files Created for This CR

These are the backend test files that belong to this change request (paths from the project root):

| Test file | What it checks |
| --- | --- |
| `S2-partner-verification/src/test/java/com/example/lbos/service/VerificationWorkTransferTest.java` | Pending-work definition, partial transfer, failures, notification, permissions. |
| `S1-platform-territory/src/test/java/com/cbg/lbos/service/LocationManagerServiceImplTest.java` | Deactivation guard while work is pending. |

---

## Main Code Location

| Item | Location |
| --- | --- |
| File | `S2-partner-verification/src/main/java/com/example/lbos/service/VerificationQueueServiceImpl.java` |
| Place | method `transferWork(TransferWorkRequestDTO)` |
| Why this is the main place | Moves an officer's pending verification requests to another Location Manager. |

A banner comment `CR_CHG0030050_Reassign_Verification_Deactivation_3239399_3241245` marks this place in the source code.
