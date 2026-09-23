# INC0010082 — Accounts & Ops Manager Status Synchronization

## 1. Ticket Overview

| Field | Details |
| --- | --- |
| Ticket | INC0010082 |
| Category | Synchronization |
| Severity | Sev-1 (per tracker) |
| Issue | User status is not synchronized between the Accounts and Ops Manager modules after activation/deactivation. |
| Main Area | S1 platform service: `UserAccountService`, `OperationsManagerService`, new `OperationsManagerStatusSync` |
| Purpose | An Operations Manager's account status and assignment status stay consistent, whichever screen changes them. |

---

## 2. Understanding the Ticket

**Requested:** when an Operations Manager is activated or deactivated in one module, the other module must show the same state.

**Why:** the same person has two statuses:
- `UserAccount.accountStatus` (Accounts module — `ACTIVE`, `INACTIVE`, `SUSPENDED` …), and
- `OperationsManager.assignmentStatus` (Ops Manager module — `ACTIVE`, `INACTIVE`, `SUSPENDED`, `TRANSFERRED`).

If they disagree, an Ops Manager can appear active in one screen and inactive in another.

**What the system should do:**
- Activate/deactivate in **Accounts** → the Ops Manager assignment follows.
- Activate/deactivate in **Ops Manager** → the account follows.
- The rule must be enforced in the backend (not just in the UI), in one transaction, without loops.
- `SUSPENDED` and `TRANSFERRED` assignments are deliberate states and must not be overwritten.

---

## 3. Existing Problem

```text
Admin deactivates the account (Accounts screen)
        ↓
UserAccountService.updateAccountStatus() saves the account only
        ↓
OperationsManager.assignmentStatus is still ACTIVE
        ↓
Ops Manager screen shows "Active"; Accounts shows "Inactive"
```

The reverse also happened: deactivating (or deleting) the assignment on the Ops Manager screen left the account `ACTIVE`.

---

## 4. Root Cause

Two independent fields with no code connecting them, confirmed in S1:

- `UserAccountService.updateAccountStatus(...)` and `updateUserAccount(...)` set `accountStatus` and saved the account — nothing touched `OperationsManager`.
- `OperationsManagerService.create/update/status/reassign/delete` set `assignmentStatus` and saved the assignment — nothing touched `UserAccount`.

`OperationsManagerService.delete()` was `findOperationsManager(id).setAssignmentStatus(AssignmentStatus.INACTIVE)`, i.e. also assignment-only.

---

## 5. Solution

A small Spring component, `OperationsManagerStatusSync`, holds both directions. Each service calls it right after it changes its own status. The component only uses **repositories**, never the other service, so there is no circular call and no recursion. Everything runs inside the caller's `@Transactional` method, so both changes commit or roll back together.

**Activation / Deactivation from Accounts**
```text
Activation / Deactivation
        ↓
Accounts  (UserAccountService.updateAccountStatus / updateUserAccount)
        ↓
Synchronization Logic  (OperationsManagerStatusSync.accountStatusChanged)
        ↓
Ops Manager  (assignmentStatus ACTIVE ⇄ INACTIVE)
        ↓
Updated User Status
```

**Activation / Deactivation from Ops Manager**
```text
Activation / Deactivation
        ↓
Ops Manager  (OperationsManagerService.create / update / status / reassign / delete)
        ↓
Synchronization Logic  (OperationsManagerStatusSync.assignmentStatusChanged)
        ↓
Accounts  (accountStatus ACTIVE ⇄ INACTIVE)
        ↓
Updated User Status
```

**Mapping rules**

| Change | Effect |
| --- | --- |
| Account → `ACTIVE`, assignment `INACTIVE` | assignment → `ACTIVE` (rejected if another Ops Manager already holds an active assignment in that city) |
| Account → `INACTIVE`, assignment `ACTIVE` | assignment → `INACTIVE` |
| Assignment → `ACTIVE`, account `INACTIVE` | account → `ACTIVE` |
| Assignment → `INACTIVE`, account `ACTIVE` | account → `INACTIVE` |
| Assignment `SUSPENDED` / `TRANSFERRED` | never overwritten |
| Account status other than ACTIVE/INACTIVE (e.g. `SUSPENDED`) | assignment not touched (login eligibility already blocks such an account) |

---

## 6. Implementation Details

### Service — new component
**S1 `service/OperationsManagerStatusSync.java`**
- `accountStatusChanged(UserAccount)` — looks up the account's assignment (`findByUserAccountId`); if none, nothing happens. Applies the ACTIVE⇄INACTIVE mapping and saves the assignment. Before activating an assignment it enforces the existing "one active Ops Manager per city" rule and throws `ConflictException("City already has an active operations manager")`, which rolls the whole change back.
- `assignmentStatusChanged(OperationsManager)` — applies the mapping to the assignment's account and saves it.

### Service — Accounts side
**S1 `service/UserAccountService.java`** — constructor takes the sync component. `updateAccountStatus()` saves the account then calls `accountStatusChanged(saved)`; `updateUserAccount()` does the same when a new `accountStatus` was supplied. The internal S1 endpoint used by other services (`PATCH /internal/v1/user-accounts/{id}/status`) calls the same method, so it is synchronized too.

### Service — Ops Manager side
**S1 `service/OperationsManagerService.java`** — constructor takes the sync component. After saving, `create`, `update`, `reassign`, `status` and `delete` call `assignmentStatusChanged(...)`. (`delete()` was rewritten to load the entity, set `INACTIVE`, then sync.)

### Frontend
No change was needed. The Accounts screen already reloads its list after a status change (`this.load()`), and the Ops Manager screen reloads after `setStatus`, so both show the synchronized value.

### Controller / Repository
Unchanged. The existing `OperationsManagerRepository.findByUserAccountId` and `findFirstByCityIdAndAssignmentStatus` are reused.

---

## 7. Execution Flow

### Deactivation from Accounts
```text
1. Admin clicks Suspend / sets INACTIVE on an Ops Manager account
        ↓
2. PATCH /api/user-accounts/{id}/status
        ↓
3. UserAccountController → locationManagerService.assertAccountStatusChangeAllowed(...)
        ↓
4. UserAccountService.updateAccountStatus(): account saved with the new status
        ↓
5. OperationsManagerStatusSync.accountStatusChanged(account)
        ↓
6. Assignment found; INACTIVE + assignment ACTIVE → assignment set INACTIVE and saved
        ↓
7. One transaction commits; both modules show INACTIVE
```

### Activation from Accounts
Steps 1–4 as above with `ACTIVE`; then the sync finds an `INACTIVE` assignment, checks that no *other* Ops Manager is ACTIVE in that city, sets the assignment `ACTIVE`, saves. If another manager holds the city → `ConflictException` → the account status change is rolled back.

### From the Ops Manager screen
```text
1. Admin toggles the Ops Manager (PATCH /api/v1/operations-managers/{id}/status)
        ↓
2. OperationsManagerService.status(): city-uniqueness check when activating; status saved
        ↓
3. OperationsManagerStatusSync.assignmentStatusChanged(assignment)
        ↓
4. ACTIVE + account INACTIVE → account ACTIVE   |   INACTIVE + account ACTIVE → account INACTIVE
        ↓
5. Committed together; Accounts screen shows the same status
```

**Alternate flows:** `SUSPENDED`/`TRANSFERRED` assignments are left as they are in both directions; an account with no Ops Manager profile (e.g. a Customer) has no assignment, so the sync does nothing.

---

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Service | `S1…/service/OperationsManagerStatusSync.java` | new: both sync directions |
| Service | `S1…/service/UserAccountService.java` | calls `accountStatusChanged` |
| Service | `S1…/service/OperationsManagerService.java` | calls `assignmentStatusChanged` in create/update/reassign/status/delete |
| Repository | `S1…/repository/OperationsManagerRepository.java` | existing methods reused (no change) |
| Test | `S1…/service/OperationsManagerStatusSyncTest.java` | new tests for both directions and the preserved states |
| Test | `OperationsManagerServiceTest`, `UserAccountServiceTest` | constructors updated for the new dependency |

---

## 9. Important Code Changes

**File:** `S1-platform-territory/src/main/java/com/cbg/lbos/service/OperationsManagerStatusSync.java`
**Purpose:** account → assignment.

```java
public void accountStatusChanged(UserAccount account) {
    if (account == null || account.getId() == null) return;
    OperationsManager assignment = operationsManagerRepository.findByUserAccountId(account.getId()).orElse(null);
    if (assignment == null) return;
    String status = account.getAccountStatus();
    if (ACTIVE.equalsIgnoreCase(status) && assignment.getAssignmentStatus() == AssignmentStatus.INACTIVE) {
        // one city may only ever have one ACTIVE Operations Manager - the same rule the assignment APIs enforce
        operationsManagerRepository.findFirstByCityIdAndAssignmentStatus(assignment.getCity().getId(), AssignmentStatus.ACTIVE)
                .filter(existing -> !existing.getId().equals(assignment.getId()))
                .ifPresent(existing -> { throw new ConflictException("City already has an active operations manager"); });
        assignment.setAssignmentStatus(AssignmentStatus.ACTIVE);
        operationsManagerRepository.save(assignment);
    } else if (INACTIVE.equalsIgnoreCase(status) && assignment.getAssignmentStatus() == AssignmentStatus.ACTIVE) {
        assignment.setAssignmentStatus(AssignmentStatus.INACTIVE);
        operationsManagerRepository.save(assignment);
    }
}
```

Only `INACTIVE→ACTIVE` and `ACTIVE→INACTIVE` transitions are performed; any other assignment state falls through untouched.

---

**File:** same file
**Purpose:** assignment → account.

```java
public void assignmentStatusChanged(OperationsManager assignment) {
    if (assignment == null || assignment.getUserAccount() == null) return;
    UserAccount account = assignment.getUserAccount();
    if (assignment.getAssignmentStatus() == AssignmentStatus.ACTIVE && INACTIVE.equalsIgnoreCase(account.getAccountStatus())) {
        account.setAccountStatus(ACTIVE);
        userAccountRepository.save(account);
    } else if (assignment.getAssignmentStatus() == AssignmentStatus.INACTIVE && ACTIVE.equalsIgnoreCase(account.getAccountStatus())) {
        account.setAccountStatus(INACTIVE);
        userAccountRepository.save(account);
    }
}
```

It writes the repository directly instead of calling `UserAccountService`, which is what prevents a loop between the two directions.

---

**File:** `S1-platform-territory/src/main/java/com/cbg/lbos/service/UserAccountService.java`
**Purpose:** hook the Accounts side.

```java
public UserAccountResponseDto updateAccountStatus(UUID id, String accountStatus) {
    UserAccount userAccount = findUserAccountById(id);
    userAccount.setAccountStatus(validateLength(normalizeRequiredText(accountStatus, "Account status"), 30, "Account status").toUpperCase());
    UserAccount saved = userAccountRepository.save(userAccount);
    operationsManagerStatusSync.accountStatusChanged(saved);
    return convertToResponseDto(saved);
}
```

---

**File:** `S1-platform-territory/src/main/java/com/cbg/lbos/service/OperationsManagerService.java`
**Purpose:** hook the Ops Manager side.

```java
public Response status(UUID id, StatusRequest request) {
    OperationsManager operationsManager = findOperationsManager(id);
    if (request.status() == AssignmentStatus.ACTIVE) {
        requireCityNotAlreadyManaged(operationsManager.getCity().getId(), id);
    }
    operationsManager.setAssignmentStatus(request.status());
    OperationsManager saved = operationsManagerRepository.save(operationsManager);
    statusSync.assignmentStatusChanged(saved);
    return toResponse(saved);
}

public void delete(UUID id) {
    OperationsManager operationsManager = findOperationsManager(id);
    operationsManager.setAssignmentStatus(AssignmentStatus.INACTIVE);
    statusSync.assignmentStatusChanged(operationsManager);
}
```

The same one-line call is added to `create`, `update` and `reassign`.

---

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| Deactivate in Accounts | account INACTIVE, assignment stays ACTIVE | both INACTIVE |
| Activate in Accounts | account ACTIVE, assignment stays INACTIVE | both ACTIVE (city rule enforced) |
| Deactivate/delete in Ops Manager | assignment INACTIVE, account stays ACTIVE | both INACTIVE |
| Activate in Ops Manager | assignment ACTIVE, account stays INACTIVE | both ACTIVE |
| SUSPENDED / TRANSFERRED | n/a | preserved, never overwritten |
| Where enforced | nowhere | backend, one transaction |
| Internal API (other services) | not synced | synced (same service method) |

---

## 11. Testing

### Test Case 1 — Deactivate from Accounts
1. Admin → Accounts, find an Operations Manager with an ACTIVE assignment; set it INACTIVE.
2. Open the Ops Manager list.
3. Expected: the assignment shows INACTIVE.

### Test Case 2 — Activate from Accounts
1. Re-activate that account.
2. Expected: assignment becomes ACTIVE (unless another Ops Manager is ACTIVE in the same city — then the request fails with `City already has an active operations manager` and the account stays INACTIVE).

### Test Case 3 — Deactivate from Ops Manager
1. Ops Manager screen → set an ACTIVE manager INACTIVE.
2. Expected: Accounts shows that user's account INACTIVE.

### Test Case 4 — Activate from Ops Manager
1. Activate the manager again.
2. Expected: the account becomes ACTIVE.

### Test Case 5 — Preserved states
1. Set an assignment to SUSPENDED or TRANSFERRED, then change the account between ACTIVE and INACTIVE.
2. Expected: the assignment status does not change.

### Test Case 6 — No profile
1. Change the status of a Customer account.
2. Expected: works as before; no Ops Manager lookup effect.

### Test Case 7 — Automated
`OperationsManagerStatusSyncTest` covers deactivate/activate, the city conflict, preserved SUSPENDED/TRANSFERRED and the reverse direction; the S1 suite passes.

---

## 12. Final Result

```text
After the fix:

- Account status and Ops Manager assignment status stay in step in both directions.
- The rule is enforced in the S1 backend, inside one transaction, with no recursion.
- SUSPENDED and TRANSFERRED assignments are never overwritten.
- The one-active-manager-per-city rule still applies when activating.
```

---

## Addendum - a Location Manager blocking a partner is now reflected in the Accounts page

**Problem found later:** when a Location Manager used *Revoke Approval & Block* on a retailer or fleet owner, only the partner record in S2 was changed (`SUSPENDED`). The S1 user account that the admin **Accounts** page lists stayed `ACTIVE`, so the two screens disagreed. Two further causes were found while fixing it:

1. The S2 -> S1 status call (and the existing S5 driver call) used `PATCH`, which Feign's default HTTP client cannot send ("Invalid HTTP method: PATCH"), so the call never left the service and the failure was swallowed as best-effort. The internal S1 endpoint now also answers to `POST`, and both clients use it.
2. The admin Accounts screen re-used a 60-second in-memory copy of the account list, so a status changed by someone else could stay hidden for up to a minute. The Accounts screen now always loads fresh (`UserAccountService.all(true)`).

**Change:**

- `S2 VerificationQueueServiceImpl.revokeApproval` suspends the retailer / fleet owner and then calls `syncAccountStatus(userAccountId, "SUSPENDED")` after the transaction commits (a failure there never undoes the block).
- The repeat-offender suspension in `processVerificationResult` does the same, and a partner approved again reactivates an account that is `SUSPENDED` (`reactivateSuspendedAccount`).
- A driver blocked from the same screen is synchronised by S5 (`DriverServiceImpl`), which now really reaches S1 through `S1PlatformClient.updateAccountStatus`.

**Files:** `S2-partner-verification/.../service/VerificationQueueServiceImpl.java`, `S2-partner-verification/.../client/AccountLookupClient.java`, `S5-fleet-operations/.../client/S1PlatformClient.java`, `S1-platform-territory/.../controller/InternalUserAccountController.java`, `frontend/.../core/services/user-account.service.ts`, `frontend/.../admin/accounts/accounts.component.ts`.

**Checked live:** an approved test retailer was blocked by the Location Manager; the admin account list then showed `SUSPENDED`.

### Second addendum - deactivating a Location Manager from the Operations Manager's page

**Problem found later:** *Deactivate* on the Operations Manager's **Location managers** page only changed the officer's assignment (`INACTIVE`); the officer's user account - the row the admin **Accounts** page lists - stayed `ACTIVE`. The Operations Manager sync already existed, but the Location Manager pair had no sync in either direction.

**Change (S1):** `OperationsManagerStatusSync` now also keeps the Location Manager pair in step, with the same table as the Operations Manager pair (ACTIVE / INACTIVE / SUSPENDED mirrored, TRANSFERRED never touched):

- `locationManagerAssignmentChanged(...)` - called by `LocationManagerServiceImpl.activateAssignment` and `deactivateAssignment`, so the account follows the assignment.
- `accountStatusChanged(...)` - the admin Accounts screen / internal status API now also updates the officer's assignment. Switching an account back to `ACTIVE` is refused (`ConflictException`) when the officer's zone or supervising Operations Manager is not active, the same rule `activateAssignment` enforces.
- `activateAssignment` switches an `INACTIVE` account back on together with the assignment (an account that is `SUSPENDED` is still refused).

**Checked live:** Operations Manager activates then deactivates an officer - the admin account list showed `ACTIVE` then `INACTIVE`; the admin sets the account `ACTIVE` / `INACTIVE` - the officers page followed both times.

---

## Test Files Created for This Ticket

These are the backend test files that belong to this ticket (paths from the project root):

| Test file | What it checks |
| --- | --- |
| `S1-platform-territory/src/test/java/com/cbg/lbos/service/OperationsManagerStatusSyncTest.java` | Both directions of the Accounts <-> Operations Manager sync and the preserved SUSPENDED / TRANSFERRED states. |
| `S2-partner-verification/src/test/java/com/example/lbos/service/VerificationQueueAccountStatusSyncTest.java` | A Location Manager blocking a retailer / fleet owner also suspends their user account (addendum). |
| `S1-platform-territory/src/test/java/com/cbg/lbos/controller/InternalUserAccountControllerStatusTest.java` | The internal status endpoint answers to POST as well as PATCH (addendum). |
| `S1-platform-territory/src/test/java/com/cbg/lbos/service/LocationManagerAccountStatusSyncTest.java` | Location Manager account <-> assignment sync in both directions, TRANSFERRED / unverified accounts left alone, reactivation refused when the supervisor is inactive (second addendum). |
| `S1-platform-territory/src/test/java/com/cbg/lbos/service/LocationManagerServiceImplTest.java` | Deactivate / activate through the service also move the account; a blocked deactivation leaves the account `ACTIVE`; a `SUSPENDED` account is still refused on activation (second addendum). |

---

## Main Code Location

| Item | Location |
| --- | --- |
| File | `S1-platform-territory/src/main/java/com/cbg/lbos/service/OperationsManagerStatusSync.java` |
| Place | method `accountStatusChanged(UserAccount)` |
| Why this is the main place | The synchronisation rule between the account status and the assignment status. |

A banner comment `TK_INC0010082_User_Status_Synchronization_3230833` marks this place in the source code.
