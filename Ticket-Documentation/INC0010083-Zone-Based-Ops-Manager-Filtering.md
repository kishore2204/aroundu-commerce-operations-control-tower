# INC0010083 — Zone-Based Ops Manager Dropdown

## 1. Ticket Overview

| Field | Details |
| --- | --- |
| Ticket | INC0010083 |
| Category | Business Logic |
| Issue | The Supervising Operations Manager dropdown is not filtered based on the selected Zone. |
| Main Area | Operations → Officers → "Assign existing officer" form (`features/operations/officers`) |
| Purpose | Only Operations Managers of the selected Zone's city can be picked as supervisor. |

---

## 2. Understanding the Ticket

**Requested:** after the user chooses a Zone, the "Supervising operations manager" dropdown must list only Operations Managers that belong to that Zone.

**Why:** a Location Manager is assigned to a Zone, and a Zone belongs to a City; the supervising Ops Manager must manage that same city. Listing everyone lets the user pick an unrelated manager.

**How the relationship works in this project:**

```text
Zone  ──belongs to──►  City  ◄──assigned to──  Operations Manager
```

A Zone has a `cityId`; an Operations Manager has a `cityId` (`OperationsManagerAssignment.cityId`). "Ops Manager of the Zone" therefore means "Ops Manager of the Zone's city".

**What the system should do:** refresh the list when the Zone changes, clear a stale selection, show `Name — City` (no UUIDs), and not restrict to ACTIVE managers only (any assignment status of that city is listed).

**Affected:** Super Admin assigning an existing Location Manager account to a Zone.

---

## 3. Existing Problem

```text
Admin opens "Assign officer"
        ↓
Form loads ALL Operations Managers once (size 100)
        ↓
Admin picks a Zone (e.g. Chennai – T. Nagar)
        ↓
Dropdown still shows managers of every city
```

- The Supervising Operations Manager options never depended on the Zone control.
- Picking a Zone and then a manager of another city was possible, and a previously picked manager stayed selected after changing the Zone.

---

## 4. Root Cause

In `officers.component.ts` the operations managers were loaded once in `ngOnInit`:

```ts
this.operationsManagerService.list().subscribe({
  next: (p) => this.operationsManagers.set(p.content),
  ...
});
```

`list()` was called with **no city**, so it returned all managers, and nothing listened to changes of the `zoneId` control. The template looped over the full list.

---

## 5. Solution

```text
Select Zone
    ↓
Zone Value / ID  (form control zoneId)
    ↓
Find the zone → its cityId
    ↓
Fetch Ops Managers  GET /api/v1/operations-managers?cityId=…   (existing API)
    ↓
Filter by Zone  (S1 returns only that city's managers)
    ↓
Display Matching Ops Managers  "Name — City"
```

- The existing OM-by-city API is reused: `OperationsManagerService.list(cityId)` on the frontend, which S1 already supports (`cityId` query parameter, `findByCityId`). No backend change was needed.
- The list is **not** filtered to ACTIVE only; every manager of that city is returned.
- On each Zone change the previous selection is cleared and the list is replaced.

---

## 6. Implementation Details

### Frontend — `officers.component.ts`
- In the constructor, `form.controls.zoneId.valueChanges` is piped through `switchMap`:
  1. clear `operationsManagerId`;
  2. empty `operationsManagers`;
  3. look up the chosen zone in `zones()`; if found call `operationsManagerService.list(zone.cityId)`, else `of(null)`.
- `switchMap` cancels an older in-flight request, so a fast Zone change cannot show the previous zone's managers.
- `takeUntilDestroyed()` unsubscribes with the component.
- The initial "load all operations managers" call was removed.
- `startCreate()` empties the list before resetting the form.

### Frontend — `officers.component.html`
- Placeholder shows `Select a zone first` until a Zone is chosen, then `Select an operations manager`.
- Options display `{{ om.displayName || om.email }} — {{ om.cityName }}`.
- If a Zone is chosen and the city has no manager, a message `No operations manager is assigned to this zone's city.` is shown. The field stays required, so the form cannot be submitted without a valid manager.
- The dropdown uses the shared `.select` style.

### Backend
No change. Existing S1 endpoint: `GET /api/v1/operations-managers?cityId=…` → `OperationsManagerService.list(cityId, status, pageable)` → `OperationsManagerRepository.findByCityId(...)`.

---

## 7. Execution Flow

```text
1. Admin opens Officers → Assign officer
        ↓
2. Supervising operations manager shows "Select a zone first" (empty)
        ↓
3. Admin selects a Zone
        ↓
4. zoneId.valueChanges fires → operationsManagerId reset, list emptied
        ↓
5. Zone found in zones() → cityId
        ↓
6. GET /api/v1/operations-managers?size=100&cityId=<cityId>
        ↓
7. S1 returns that city's managers (any assignment status)
        ↓
8. Dropdown shows "Name — City"
        ↓
9. Admin selects a manager and submits (userAccountId, zoneId, operationsManagerId)
```

**Alternate flows**
- Zone changed again → steps 4–8 repeat and the earlier choice is cleared.
- City with no manager → empty list + message; form stays invalid.
- Zone cleared → list emptied, placeholder returns.
- Request failure → `loadError` shows `Could not load operations managers for this zone.`

---

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Frontend | `features/operations/officers/officers.component.ts` | reacts to Zone changes; loads managers by city; clears stale value |
| Frontend | `features/operations/officers/officers.component.html` | placeholder, `Name — City` labels, empty-state message |
| API (reused) | `S1…/controller/OperationsManagerController.java` (`cityId` parameter) | existing |
| Repository (reused) | `S1…/repository/OperationsManagerRepository.findByCityId` | existing |

---

## 9. Important Code Changes

**File:** `frontend/src/app/features/operations/officers/officers.component.ts`
**Purpose:** reload the manager list whenever the Zone changes.

```ts
constructor(...) {
  // The supervising Operations Manager must belong to the selected Zone's city: whenever the Zone changes, drop
  // the previous choice and load that city's Operations Managers (any assignment status - not only ACTIVE).
  this.form.controls.zoneId.valueChanges
    .pipe(
      switchMap((zoneId) => {
        this.form.controls.operationsManagerId.setValue('');
        this.operationsManagers.set([]);
        const zone = this.zones().find((z) => z.zoneId === zoneId);
        return zone ? this.operationsManagerService.list(zone.cityId) : of(null);
      }),
      takeUntilDestroyed(),
    )
    .subscribe({
      next: (page) => this.operationsManagers.set(page?.content ?? []),
      error: (err) => this.loadError.set(extractErrorMessage(err, 'Could not load operations managers for this zone.')),
    });
}
```

Line by line: clearing the control removes a stale selection; clearing the list avoids showing the old zone's managers while loading; `zone.cityId` is the link between Zone and Ops Manager; `switchMap` keeps only the latest request.

---

**File:** `frontend/src/app/core/services/operations-manager.service.ts` (existing method reused)

```ts
list(cityId?: string): Observable<SpringPage<OperationsManagerAssignment>> {
  let params = new HttpParams().set('size', 100);
  if (cityId) params = params.set('cityId', cityId);
  return this.http.get<SpringPage<OperationsManagerAssignment>>('/api/v1/operations-managers', { params });
}
```

---

**File:** `frontend/src/app/features/operations/officers/officers.component.html`
**Purpose:** show only matching managers, no UUIDs.

```html
<select class="select" formControlName="operationsManagerId">
  <option value="" disabled>{{ form.controls.zoneId.value ? 'Select an operations manager' : 'Select a zone first' }}</option>
  @for (om of operationsManagers(); track om.id) {
    <option [value]="om.id">{{ om.displayName || om.email }} — {{ om.cityName }}</option>
  }
</select>
@if (form.controls.zoneId.value && operationsManagers().length === 0) {
  <p class="mt-1 text-xs font-semibold text-amber-600">No operations manager is assigned to this zone's city.</p>
}
```

---

**File (removed logic):** `officers.component.ts` `ngOnInit`

```ts
// removed
this.operationsManagerService.list().subscribe({
  next: (p) => this.operationsManagers.set(p.content),
  error: (err) => this.loadError.set(extractErrorMessage(err, 'Could not load operations managers.')),
});
```

---

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| Options | All Operations Managers | Managers of the selected Zone's city |
| When loaded | Once at page open | Every time the Zone changes |
| Stale selection | Kept after changing Zone | Cleared on Zone change |
| Label | `Name - City` for everyone | `Name — City`, only matching ones |
| No manager for the city | Unrelated managers offered | Empty list + message, form stays invalid |
| Status filter | none | none (any assignment status is listed, not only ACTIVE) |
| Backend | – | unchanged (existing `cityId` filter) |

---

## 11. Testing

### Test Case 1 — Before a zone is chosen
1. Open Officers → Assign officer.
2. Expected: the manager dropdown shows `Select a zone first` and has no options.

### Test Case 2 — Matching managers
1. Select a Zone in city A.
2. Expected: only Operations Managers whose city is A, shown as `Name — A`.

### Test Case 3 — Change zone
1. Choose a manager, then change the Zone to one in city B.
2. Expected: the chosen manager is cleared and the list now shows city B's managers.

### Test Case 4 — Empty city
1. Choose a Zone whose city has no manager.
2. Expected: no options, the message `No operations manager is assigned to this zone's city.`, and the Assign button stays disabled.

### Test Case 5 — Not only ACTIVE
1. Make a manager INACTIVE in a city and select a Zone of that city.
2. Expected: that manager is still listed (the list is not restricted to ACTIVE).

### Test Case 6 — Fast switching
1. Change the Zone quickly several times.
2. Expected: the dropdown always ends with the last chosen zone's managers.

### Test Case 7 — Submit
1. Choose officer, Zone and a listed manager; press Assign.
2. Expected: the assignment is created with those values.

---

## 12. Final Result

```text
After the fix:

- The Supervising Operations Manager dropdown follows the selected Zone's city.
- It refreshes on every Zone change and clears a stale selection.
- Labels read "Name — City"; no UUIDs are shown.
- The existing OM-by-city API is reused; the backend is unchanged.
```

---

## Test Files Created for This Ticket

No backend code was changed for this ticket, so no backend test file was needed or created. The behaviour is checked on the screen (see the Testing section above).

---

## Main Code Location

| Item | Location |
| --- | --- |
| File | `frontend/src/app/features/operations/officers/officers.component.ts` |
| Place | constructor - the `zoneId.valueChanges` subscription |
| Why this is the main place | Reloads the Operations Managers of the selected zone's city and clears a stale choice. |

A banner comment `TK_INC0010083_Zone_Based_Ops_Manager_Filtering_3235425` marks this place in the source code.
