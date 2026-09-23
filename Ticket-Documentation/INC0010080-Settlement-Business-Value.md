# INC0010080 — Settlement Business Value

## 1. Ticket Overview

| Field | Details |
| --- | --- |
| Ticket | INC0010080 |
| Category | Data Display |
| Issue | The Settlement screen in Admin → Finance displays a UUID instead of the actual business value. |
| Main Area | S6 finance service (Settlement entity/service) and the Finance → Settlements table in Angular |
| Purpose | Show the payee's business name (retailer / fleet owner / platform) instead of an internal id. |

---

## 2. Understanding the Ticket

**Requested:** the settlement list must show a meaningful business value, not a UUID.

**Why:** a UUID means nothing to a finance user; they need to know *who* is being paid.

**What the system should do:**
- RETAILER settlement → the retailer's business name.
- FLEET_OWNER settlement → the fleet owner's business name.
- PLATFORM settlement → `AroundU Platform`.
- Legacy settlements (no payee) or a payee that cannot be resolved → `N/A` — never the UUID.
- The UUID stays in the backend data model (it is still the internal reference).

**Affected:** Admin/Operations users on Finance → Settlements.

---

## 3. Existing Problem

```text
Order delivered → settlements created (payeeType + payeeId)
        ↓
GET /api/settlements returns the Settlement entity as stored
        ↓
Screen prints s.payeeId
        ↓
User sees "3f2b0c1e-…-9a7d" next to RETAILER
```

- **What the user saw:** a badge `RETAILER` and, under it, a UUID.
- **Incorrect:** the UUID is an internal key. The business name lives in another service (S2 partner service), and the settlement had no field for it.
- **Expected:** the business name.

---

## 4. Root Cause

1. **Data model:** `Settlement` (S6) stores only `payeeType` and `payeeId` (a UUID of a retailer/fleet owner). The partner's name is owned by S2 (`retailer`, `fleet owner`), which S6 does not store.
2. **API:** `SettlementServiceImpl.getAllSettlements()` was `return settlementRepository.findAll();` and the controller returned the entity as is — no name was ever looked up.
3. **UI:** `finance.component.html` rendered the only identifying field it had: `{{ s.payeeId }}`.

---

## 5. Solution

```text
Database (settlement: payee_type, payee_id)
        ↓
Entity Settlement  +  @Transient payeeName (not stored)
        ↓
SettlementServiceImpl.resolvePayeeNames()
   RETAILER    → S2 PartnerServiceClient.getRetailer(id).businessName
   FLEET_OWNER → S2 PartnerServiceClient.getFleetOwner(id).businessName
   PLATFORM    → "AroundU Platform"
   null / fail → "N/A"
        ↓
API  GET /api/settlements  (JSON now contains payeeName)
        ↓
Settlement Screen shows payeeName
        ↓
Business Value
```

- The existing S2 client from the support module (`PartnerServiceClient`) is reused — no new client.
- Names are resolved when settlements are **read**; nothing new is stored, so no migration is needed.
- Each distinct payee is looked up only once per request (cache map), so a page with many rows for the same retailer does not call S2 repeatedly.

---

## 6. Implementation Details

### Entity
**S6 `entity/Settlement.java`** — new `@Transient String payeeName` with getter/setter. `@Transient` means JPA does not create a column; Jackson still serializes it, so it appears in the API JSON.

### Service
**S6 `service/SettlementServiceImpl.java`**
- Injects `PartnerServiceClient`.
- `getAllSettlements()` and `getSettlementById()` call `resolvePayeeNames(...)` before returning.
- `updateSettlement()` and `completeSettlement()` (which return the settlement) also resolve the name; internal lookups use a private `findSettlement()` that does not.
- `lookupBusinessName()` returns the name or `N/A` when the id is missing, the type is unknown, the name is blank, or the S2 call fails (any `RuntimeException`).

### Frontend
**`core/models/settlement.model.ts`** — new optional `payeeName`.
**`features/operations/finance/finance.component.html`** — the payee cell now prints `payeeName || 'N/A'` instead of `payeeId`.

### Not changed
The UUID columns and creation logic (`recordOrderDeliverySettlement`, `payoutSettlement`) — the UUID is kept in the backend model.

---

## 7. Execution Flow

```text
1. Admin opens Finance → Settlements
        ↓
2. Angular calls GET /api/settlements (S6)
        ↓
3. SettlementController → SettlementServiceImpl.getAllSettlements()
        ↓
4. Repository returns settlements (payeeType, payeeId)
        ↓
5. resolvePayeeNames():
      PLATFORM            → "AroundU Platform"
      no id / no type     → "N/A"
      RETAILER            → S2 getRetailer(id).businessName
      FLEET_OWNER         → S2 getFleetOwner(id).businessName
        ↓
6. JSON returned with payeeName
        ↓
7. Table shows: [RETAILER] Fresh Mart
```

**Error flow:** if S2 is down or the partner no longer exists, the row shows `N/A` and the list still loads (the exception is caught per lookup).

---

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Entity | `S6…/entity/Settlement.java` | `@Transient payeeName` |
| Service | `S6…/service/SettlementServiceImpl.java` | resolves names via `PartnerServiceClient` |
| Client (reused) | `S6…/integration/client/PartnerServiceClient.java` | existing S2 lookups |
| Test | `S6…/service/SettlementServiceImplTest.java` | new name-resolution test |
| Frontend | `core/models/settlement.model.ts` | `payeeName` field |
| Frontend | `features/operations/finance/finance.component.html` | shows `payeeName` |

---

## 9. Important Code Changes

**File:** `S6-finance-support/src/main/java/com/lbos/finance/entity/Settlement.java`
**Purpose:** carry a display name without storing it.

```java
/** Display name of the payee, resolved when a settlement is read (never stored): the retailer / fleet owner
 *  business name, "AroundU Platform" for PLATFORM, and "N/A" for legacy or unresolvable rows. The payeeId stays
 *  as the internal reference. */
@Transient
private String payeeName;
public String getPayeeName() { return payeeName; }
public void setPayeeName(String payeeName) { this.payeeName = payeeName; }
```

---

**File:** `S6-finance-support/src/main/java/com/lbos/finance/service/SettlementServiceImpl.java`
**Purpose:** map payee type + id to a business name.

```java
@Override public List<Settlement> getAllSettlements() { List<Settlement> all = settlementRepository.findAll(); resolvePayeeNames(all); return all; }

static final String PLATFORM_PAYEE_NAME = "AroundU Platform";
static final String UNKNOWN_PAYEE_NAME = "N/A";

private void resolvePayeeNames(Collection<Settlement> settlements) {
    Map<String, String> resolved = new HashMap<>();
    for (Settlement settlement : settlements) {
        String type = settlement.getPayeeType();
        if ("PLATFORM".equals(type)) { settlement.setPayeeName(PLATFORM_PAYEE_NAME); continue; }
        if (settlement.getPayeeId() == null || type == null) { settlement.setPayeeName(UNKNOWN_PAYEE_NAME); continue; }
        settlement.setPayeeName(resolved.computeIfAbsent(type + ":" + settlement.getPayeeId(), key -> lookupBusinessName(type, settlement.getPayeeId())));
    }
}

private String lookupBusinessName(String payeeType, UUID payeeId) {
    try {
        String name = switch (payeeType) {
            case "RETAILER" -> partnerServiceClient.getRetailer(payeeId).businessName();
            case "FLEET_OWNER" -> partnerServiceClient.getFleetOwner(payeeId).businessName();
            default -> null;
        };
        return name == null || name.isBlank() ? UNKNOWN_PAYEE_NAME : name;
    } catch (RuntimeException ex) {
        return UNKNOWN_PAYEE_NAME;
    }
}
```

`computeIfAbsent` keyed by `type:id` means one S2 call per distinct payee. Every failure path returns `N/A`, never the UUID.

---

**File:** `frontend/src/app/features/operations/finance/finance.component.html`
**Purpose:** display the business value.

```html
@if (s.payeeType) {
  <span class="badge badge-pending">{{ s.payeeType }}</span>
  <span class="text-xs text-slate-500 block mt-0.5">{{ s.payeeName || 'N/A' }}</span>
} @else {
  <span class="text-xs text-slate-400">Operations manager</span>
}
```

Before, the middle line was `@if (s.payeeId) { … {{ s.payeeId }} … }`.

---

**File:** `frontend/src/app/core/models/settlement.model.ts`

```ts
/** Business name of the payee (retailer / fleet owner), "AroundU Platform" or "N/A" - what screens display. */
payeeName?: string | null;
```

---

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| RETAILER row | UUID | Retailer business name |
| FLEET_OWNER row | UUID | Fleet owner business name |
| PLATFORM row | nothing under the badge | `AroundU Platform` |
| Legacy / unresolvable | nothing or UUID | `N/A` |
| API JSON | `payeeId` only | `payeeId` + `payeeName` |
| Database | unchanged | unchanged (name is `@Transient`) |
| S2 calls | none | at most one per distinct payee per request |

---

## 11. Testing

### Test Case 1 — Retailer settlement
1. Deliver an order so a RETAILER settlement exists.
2. Open Admin → Finance → Settlements.
3. Expected: badge `RETAILER` with the retailer's business name below; no UUID.

### Test Case 2 — Fleet owner settlement
1. Open a FLEET_OWNER settlement.
2. Expected: the fleet owner's business name.

### Test Case 3 — Platform
1. Open the PLATFORM settlement.
2. Expected: `AroundU Platform`.

### Test Case 4 — Legacy row
1. Open a settlement created through the old operations-manager flow (no payee type).
2. Expected: `Operations manager` label (unchanged); an unresolvable payee shows `N/A`.

### Test Case 5 — S2 unavailable
1. Stop the partner service and reload the list.
2. Expected: the page loads; RETAILER/FLEET_OWNER rows show `N/A`.

### Test Case 6 — Unit test
`SettlementServiceImplTest.getAllSettlementsShowsBusinessNamesInsteadOfPayeeIds` checks the mapping for all five cases and that a repeated retailer is looked up once.

---

## 12. Final Result

```text
After the fix:

- The Settlement screen shows business names, not UUIDs.
- The mapping is done in S6 using the existing S2 partner client.
- PLATFORM, legacy and unresolvable payees are handled explicitly.
- The UUIDs remain in the backend model; the database schema is unchanged.
```

---

## Test Files Created for This Ticket

These are the backend test files that belong to this ticket (paths from the project root):

| Test file | What it checks |
| --- | --- |
| `S6-finance-support/src/test/java/com/lbos/finance/service/SettlementServiceImplTest.java` | Payee-name resolution (business name instead of the internal id) and the settlement rules. |

---

## Main Code Location

| Item | Location |
| --- | --- |
| File | `S6-finance-support/src/main/java/com/lbos/finance/service/SettlementServiceImpl.java` |
| Place | method `resolvePayeeNames(Collection<Settlement>)` |
| Why this is the main place | Fills the business name of each settlement's payee. |

A banner comment `TK_INC0010080_Settlement_Business_Value_3239886` marks this place in the source code.
