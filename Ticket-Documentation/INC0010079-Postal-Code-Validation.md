# INC0010079 — Postal Code Validation

## 1. Ticket Overview

| Field | Details |
| --- | --- |
| Ticket | INC0010079 |
| Category | Validation |
| Issue | The Customer portal postal code field accepted invalid input. It should accept only 6-digit numeric values. |
| Main Area | Customer → Addresses form (Angular) and S3 address API (`AddressRequest`) |
| Purpose | Postal code is exactly 6 digits (digits only), validated on the screen and on the server. |

---

## 2. Understanding the Ticket

**Requested:** the postal code must be numeric and exactly 6 digits.

**Why:** the field took any text (letters, symbols, any length up to 20), so bad delivery data could be saved.

**What the system should do:**
- Only digits can be typed; no more than 6.
- Pasted text is cleaned.
- The form shows an error and blocks saving while the value is not exactly 6 digits.
- The backend rejects anything else.

**Affected:** customers adding or editing delivery addresses.

---

## 3. Existing Problem

```text
Customer types "AB-12 ###" in Postal code
        ↓
Form control has no validator; backend only limits the length to 20
        ↓
Address is saved with an invalid postal code
```

- **What the user did:** typed letters/symbols or a number of any length.
- **What the system did:** accepted and saved it.
- **Incorrect:** invalid postal codes were stored.
- **Expected:** only a 6-digit number.

---

## 4. Root Cause

1. **Frontend:** the control was `postalCode: ['']` — no validator at all — and the input was a plain `<input class="input" formControlName="postalCode" />` with no typing restriction.
2. **Backend:** `AddressRequest` declared `@Size(max=20) String postalCode`, i.e. only a length cap; letters were valid.

---

## 5. Solution

```text
Customer types / pastes in Postal code
        ↓
DigitsOnlyDirective [appDigitsOnly]="6"  (digits only, max 6)
        ↓
postalCodeValidator()  (^[0-9]{6}$)  → error text + Save disabled
        ↓
save() sends null when empty, digits when filled
        ↓
S3 AddressRequest @Pattern("^$|^[0-9]{6}$")
        ↓
Address saved
```

- The postal code stays **optional** (existing addresses may not have one), but if given it must be exactly 6 digits.
- An empty field is sent as `null`, not `""`, so the backend pattern is satisfied cleanly.

---

## 6. Implementation Details

### Frontend

**`core/validation/input-rules.ts`** — `POSTAL_CODE_PATTERN = /^[0-9]{6}$/`, message `Postal code must be exactly 6 digits`, and `postalCodeValidator()` (shared implementation with the mobile rule; empty passes).

**`shared/input-rules/digits-only.directive.ts`** — same directive as INC0010070, used with a limit of 6.

**`features/addresses/address-list.component.ts`** — control becomes `['', [postalCodeValidator()]]`; `save()` converts an empty value to `null` before calling the API.

**`features/addresses/address-list.component.html`** — input uses `type="tel"` and `[appDigitsOnly]="6"`, shows the error text when invalid; the submit button is already `[disabled]="form.invalid || saving()"`.

### Backend

**S3 `dto/request/AddressRequest.java`** — the `postalCode` component of the record changed from `@Size(max=20)` to `@Pattern(regexp="^$|^[0-9]{6}$", message="Postal code must be exactly 6 digits")`. The `^$` alternative allows an empty value (optional field).

---

## 7. Execution Flow

```text
1. Customer opens Addresses → Add / Edit address
        ↓
2. Types in Postal code; directive removes non-digits and stops at 6
        ↓
3. postalCodeValidator() runs on each change
        ↓
4. Invalid → "Postal code must be exactly 6 digits"; Add/Save is disabled
        ↓
5. Valid or empty → Save
        ↓
6. save() builds the request; empty postalCode → null
        ↓
7. POST/PUT to S3 → @Valid AddressRequest checks the pattern
        ↓
8. Address stored; list shows the postal code next to zone and city
```

**Alternate flows:** paste `56 00-01x` → `560001`; 5 digits → error and Save disabled; API call with `"ABCDEF"` or `"12345"` → rejected by S3 with the pattern message.

---

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Frontend | `core/validation/input-rules.ts` | postal-code pattern, message, validator |
| Frontend | `shared/input-rules/digits-only.directive.ts` | reused (limit 6) |
| Frontend | `features/addresses/address-list.component.ts` | validator; empty → `null` |
| Frontend | `features/addresses/address-list.component.html` | directive + error message |
| Backend S3 | `dto/request/AddressRequest.java` | `@Pattern` 6 digits (empty allowed) |

---

## 9. Important Code Changes

**File:** `frontend/src/app/core/validation/input-rules.ts`
**Purpose:** the Angular postal-code rule.

```ts
export const POSTAL_CODE_LENGTH = 6;
export const POSTAL_CODE_PATTERN = /^[0-9]{6}$/;
export const POSTAL_CODE_MESSAGE = 'Postal code must be exactly 6 digits';

export const postalCodeValidator = (): ValidatorFn => patternValidator(POSTAL_CODE_PATTERN, 'postalCode');
```

`patternValidator` ignores empty values, so an empty postal code stays allowed; anything else must match exactly 6 digits.

---

**File:** `frontend/src/app/features/addresses/address-list.component.ts`
**Purpose:** validate, and send `null` for an empty optional field.

```ts
// before
postalCode: [''],
// after
postalCode: ['', [postalCodeValidator()]],
```

```ts
const { stateId: _stateId, postalCode, ...rest } = this.form.getRawValue();
const request = { ...rest, postalCode: postalCode.trim() ? postalCode.trim() : null };
```

---

**File:** `frontend/src/app/features/addresses/address-list.component.html`
**Purpose:** restrict typing and show the error.

```html
<input class="input" type="tel" [appDigitsOnly]="6" formControlName="postalCode" placeholder="6-digit postal code" />
@if (form.controls.postalCode.invalid) {
  <p class="mt-1 text-xs font-semibold text-rose-600">Postal code must be exactly 6 digits</p>
}
```

---

**File:** `S3-commerce-customer/src/main/java/com/lbos/commercecustomer/dto/request/AddressRequest.java`
**Purpose:** server-side enforcement.

```java
// before
@Size(max=20) String postalCode
// after
@Pattern(regexp="^$|^[0-9]{6}$", message="Postal code must be exactly 6 digits") String postalCode
```

---

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| Typing | Any character | Digits only, max 6 |
| Paste | Pasted as-is | Cleaned to digits, cut at 6 |
| Frontend validation | None | `^[0-9]{6}$` (optional when empty) |
| Error message | None | `Postal code must be exactly 6 digits` |
| Save button | Enabled | Disabled while invalid |
| Backend | `@Size(max=20)` | `^$|^[0-9]{6}$` |
| Empty value | `""` sent | `null` sent |

---

## 11. Testing

### Test Case 1 — Valid
1. Customer → Addresses → Add address.
2. Enter `560001` in Postal code and fill the other required fields.
3. Expected: no error, address saved, `560001` appears in the list.

### Test Case 2 — Letters / symbols
1. Try typing `AB12#`.
2. Expected: only `12` appears.

### Test Case 3 — Length
1. Enter `56000` → error `Postal code must be exactly 6 digits`, Save disabled.
2. Type a 7th digit → not accepted.

### Test Case 4 — Paste
1. Paste `560 001-x`.
2. Expected: field shows `560001`.

### Test Case 5 — Optional
1. Leave Postal code empty and save.
2. Expected: address saved with no postal code.

### Test Case 6 — Backend
1. Call the S3 address create/update API with `"postalCode": "12A456"`.
2. Expected: validation error `Postal code must be exactly 6 digits`.

---

## 12. Final Result

```text
After the fix:

- The postal code accepts only 6-digit numbers.
- Typing and pasting are controlled; the form blocks invalid values.
- S3 enforces the same rule, so the API cannot store an invalid code.
- The field remains optional and empty values are sent as null.
```

---

## Test Files Created for This Ticket

These are the backend test files that belong to this ticket (paths from the project root):

| Test file | What it checks |
| --- | --- |
| `S3-commerce-customer/src/test/java/com/lbos/commercecustomer/service/AddressRequestPostalCodeTest.java` | Backend rule: exactly 6 digits, empty allowed; wrong length / letters / spaces rejected. |
| `S3-commerce-customer/src/test/java/com/lbos/commercecustomer/service/comprehensive/AddressServiceComprehensiveTest.java` | Address service behaviour. |

---

## Main Code Location

| Item | Location |
| --- | --- |
| File | `S3-commerce-customer/src/main/java/com/lbos/commercecustomer/dto/request/AddressRequest.java` |
| Place | record `AddressRequest`, field `postalCode` (`@Pattern`) |
| Why this is the main place | The backend postal-code rule. |

A banner comment `TK_INC0010079_Postal_Code_Validation_3248237` marks this place in the source code.
