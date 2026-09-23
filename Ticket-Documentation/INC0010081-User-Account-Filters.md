# INC0010081 — User Account Role & Status Filters

## 1. Ticket Overview

| Field | Details |
| --- | --- |
| Ticket | INC0010081 |
| Category | Enhancement |
| Issue | The User Account screen lacks filtering by Role and Status, making searches inefficient. |
| Main Area | Admin → Accounts screen (`features/admin/accounts`) |
| Purpose | Role and Status dropdown filters that work together with the existing search box. |

---

## 2. Understanding the Ticket

**Requested:** let an admin narrow the account list by Role and by Status.

**Why:** the only tool was a free-text search, so finding "all suspended Retailers" meant scanning the whole list.

**What the system should do:**
- A **Role** dropdown and a **Status** dropdown, each with an `All` choice.
- Both combine with the search box.
- The table, row actions and sorting keep working; no UUIDs in the table.
- Use the shared dropdown style.

**Affected:** administrators managing user accounts.

---

## 3. Existing Problem

```text
Admin opens Accounts
        ↓
Screen loads every account, sorted by email
        ↓
Only a text box (email / name / role text) can narrow the list
        ↓
No way to pick a role or a status
```

- **What the user did:** wanted only one role or status.
- **What the system did:** offered only the search box (`applyFilter()` looked at the search text alone).
- **Expected:** Role and Status filters.

---

## 4. Root Cause

This is a missing feature, not a defect. In `accounts.component.ts` the list was narrowed by a single control (`searchControl`); `applyFilter()` had no notion of role or status, and the template had no controls for them.

---

## 5. Solution

The screen already loads **all** accounts once (`userAccountService.all()`) and filters them in the browser (the existing search worked this way), so the new filters use the same pattern: three controls feed one `applyFilter()` that produces the visible list.

```text
No Filter        → Role "All",  Status "All", search empty → every account
Role Only        → role === selected
Status Only      → accountStatus === selected
Role + Status    → both must match
(+ search text)  → also must match the search
```

- Changing any control re-runs `applyFilter()` immediately.
- Row actions (Suspend / Activate) work on the filtered rows exactly as before, and `load()` re-applies the current filters after a status change.
- Selecting **All** in a dropdown is the "clear" for that filter.

Note on the backend: S1 already has `getUserAccountsByRole` / `getUserAccountsByStatus`, but the screen does not call them — the full list is already in memory, so no new API call or backend change was needed for this ticket.

---

## 6. Implementation Details

### Frontend — `accounts.component.ts`
- Two new controls: `roleFilter` and `statusFilter` (`''` means All).
- `roleOptions` / `statusOptions` are `computed` signals: the known values (`SUPER_ADMIN, OPERATIONS_MANAGER, LOCATION_MANAGER, RETAILER, FLEET_MANAGER, DRIVER, CUSTOMER` and `ACTIVE, INACTIVE, SUSPENDED`) plus any other value present in the loaded accounts, so no account becomes unreachable.
- `label()` turns `OPERATIONS_MANAGER` into `Operations Manager` for display.
- `ngOnInit` subscribes all three controls to `applyFilter()`.
- `applyFilter()` now combines role, status and search.

### Frontend — `accounts.component.html`
The search field sits in a three-column grid with the Role and Status `<select class="select">` controls (the shared dropdown class from INC0010077).

### Backend
No change.

---

## 7. Execution Flow

```text
1. Admin opens Admin → Accounts
        ↓
2. All accounts load, sorted by email; filtered() = everything
        ↓
3. Admin picks Role = Retailer
        ↓
4. roleFilter.valueChanges → applyFilter()
        ↓
5. filtered() keeps rows with role === RETAILER
        ↓
6. Admin picks Status = Suspended
        ↓
7. applyFilter() → role AND status AND search text
        ↓
8. Table re-renders; empty result shows "No accounts found"
        ↓
9. Admin picks All / clears search → the filter is removed
```

**Alternate flow:** clicking Suspend/Activate on a row calls the status API, `load()` reloads the accounts and `applyFilter()` re-applies the selected filters.

---

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Frontend | `features/admin/accounts/accounts.component.ts` | filter controls, options, combined `applyFilter()` |
| Frontend | `features/admin/accounts/accounts.component.html` | Role and Status dropdowns beside the search box |

---

## 9. Important Code Changes

**File:** `frontend/src/app/features/admin/accounts/accounts.component.ts`
**Purpose:** filter state and options.

```ts
/** '' means "All". Combined with the search box in applyFilter(). */
readonly roleFilter = this.fb.nonNullable.control('');
readonly statusFilter = this.fb.nonNullable.control('');

private static readonly KNOWN_ROLES = ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'LOCATION_MANAGER', 'RETAILER', 'FLEET_MANAGER', 'DRIVER', 'CUSTOMER'];
private static readonly KNOWN_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

readonly roleOptions = computed(() => this.optionsFor(AdminAccountsComponent.KNOWN_ROLES, this.accounts().map((a) => a.role)));
readonly statusOptions = computed(() => this.optionsFor(AdminAccountsComponent.KNOWN_STATUSES, this.accounts().map((a) => a.accountStatus)));
```

```ts
ngOnInit(): void {
  this.searchControl.valueChanges.subscribe(() => this.applyFilter());
  this.roleFilter.valueChanges.subscribe(() => this.applyFilter());
  this.statusFilter.valueChanges.subscribe(() => this.applyFilter());
  this.load();
}
```

---

**File:** `frontend/src/app/features/admin/accounts/accounts.component.ts`
**Purpose:** the combined filter.

```ts
private applyFilter(): void {
  const q = this.searchControl.value.trim().toLowerCase();
  const role = this.roleFilter.value;
  const status = this.statusFilter.value;
  this.filtered.set(
    this.accounts().filter(
      (a) =>
        (!role || a.role === role) &&
        (!status || a.accountStatus === status) &&
        (!q ||
          a.email.toLowerCase().includes(q) ||
          `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q)),
    ),
  );
}
```

Every condition is "empty = no restriction", so all four cases (none / role / status / role + status) fall out of the same expression, with search on top. Before, this method only had the `q` condition.

---

**File:** `frontend/src/app/features/admin/accounts/accounts.component.html`
**Purpose:** the controls.

```html
<div class="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  <div class="form-group"> … search input … </div>
  <div class="form-group">
    <label class="form-label">Role</label>
    <select class="select" [formControl]="roleFilter" aria-label="Filter by role">
      <option value="">All</option>
      @for (role of roleOptions(); track role) {
        <option [value]="role">{{ label(role) }}</option>
      }
    </select>
  </div>
  <div class="form-group">
    <label class="form-label">Status</label>
    <select class="select" [formControl]="statusFilter" aria-label="Filter by status">
      <option value="">All</option>
      @for (status of statusOptions(); track status) {
        <option [value]="status">{{ label(status) }}</option>
      }
    </select>
  </div>
</div>
```

---

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| Filters | Search text only | Search + Role + Status |
| Combination | n/a | All three narrow the same list |
| Dropdown style | n/a | shared `.select` with arrow |
| Reset | Clear the search box | Choose `All` per filter / clear search |
| Table content | unchanged | unchanged (no UUIDs shown) |
| Backend | unchanged | unchanged |

---

## 11. Testing

### Test Case 1 — No filter
1. Open Admin → Accounts (Role = All, Status = All).
2. Expected: every account.

### Test Case 2 — Role only
1. Choose Role = Retailer.
2. Expected: only Retailer accounts.

### Test Case 3 — Status only
1. Choose Status = Suspended.
2. Expected: only suspended accounts.

### Test Case 4 — Role + Status
1. Choose Role = Location Manager and Status = Active.
2. Expected: only active Location Managers.

### Test Case 5 — With search
1. Add a search term (e.g. part of an email) while filters are set.
2. Expected: the result must satisfy the role, the status and the search text.

### Test Case 6 — No result
1. Pick a combination that matches nothing.
2. Expected: `No accounts found`.

### Test Case 7 — Actions still work
1. With a filter applied, Suspend an account.
2. Expected: the status changes and the list stays filtered (the account leaves a "Status = Active" view).

---

## 12. Final Result

```text
After the fix:

- The Accounts screen has Role and Status filters (with All).
- They combine with the existing search.
- Actions, sorting and the table layout are unchanged.
- Dropdowns use the shared style; no UUIDs are displayed.
```

---

## Addendum - filters on the Operations Manager's Location Managers page

The same kind of enhancement was added to **Operations -> Location managers** (the `officers` page): the Operations Manager can now search Location Managers by **name (or e-mail)** and filter by **zone** and **status**, with a *Clear filters* button and a "No location managers match these filters" message.

The name part is done by the server, not in the browser:

- `GET /api/v1/location-managers` accepts a new optional `name` parameter next to `zoneId`, `operationsManagerId` and `status`.
- `LocationManagerRepository.searchByName(...)` - case-insensitive "contains" on the officer's full name or e-mail, combined with the other filters.
- `LocationManagerServiceImpl.getLocationManagers(..., name, ...)` uses the plain query when the name is blank.
- `OfficersComponent` sends the filters (name debounced 300 ms; a newer filter change makes an older answer be ignored).

**Checked live** as the Operations Manager: name `karth` -> only Karthik; e-mail text `LM2.CHN` -> only Divya; zone; status INACTIVE; combined filters; clearing restores the full list.

---

## Test Files Created for This Ticket

The original ticket changed only the Angular Accounts screen (no backend, so no backend test). The addendum above added a server-side name filter for the Location Managers page, and that has a test file:

| Test file | What it checks |
| --- | --- |
| `S1-platform-territory/src/test/java/com/cbg/lbos/service/LocationManagerNameFilterTest.java` | Location Managers page filter (see the addendum): the name part is applied by the server together with zone and status. |

---

## Main Code Location

| Item | Location |
| --- | --- |
| File | `frontend/src/app/features/admin/accounts/accounts.component.ts` |
| Place | method `applyFilter()` |
| Why this is the main place | Combines the search box with the Role and Status filters. |

A banner comment `TK_INC0010081_User_Account_Filters_3239293` marks this place in the source code.
