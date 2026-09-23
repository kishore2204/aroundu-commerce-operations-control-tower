# INC0010070 — Mobile Number Validation

## 1. Ticket Overview

| Field | Details |
| --- | --- |
| Ticket | INC0010070 |
| Category | Validation |
| Issue | The mobile number field accepted alphabetic characters and showed an incorrect validation message. It should accept only numbers and show `Mobile number must be 10 digits`. |
| Main Area | Angular input fields for a mobile number (Register, Admin → Accounts, Profile, Logistics booking) and the backend that receives it (S1, S4) |
| Purpose | One consistent mobile-number rule for the whole application: exactly 10 digits, digits only. |

---

## 2. Understanding the Ticket

**Requested:** a mobile number field must take digits only, must be exactly 10 digits long, and must show the message `Mobile number must be 10 digits` when it is wrong.

**Why:** users could type letters, spaces or symbols into the field, and the message they got did not match the rule the business wants.

**What the system should do:**
- Refuse letters and symbols while the user types.
- Never let more than 10 digits be entered.
- Clean pasted text (remove everything that is not a digit).
- Validate again on submit, and validate again on the server so the rule cannot be bypassed.

**Affected:** every screen where a mobile number is entered, and every API that receives one.

---

## 3. Existing Problem

```text
User types "abcdefghij" (or "98a-76 54321099")
        ↓
Existing validators only check the LENGTH (10 to 15 characters)
        ↓
Letters are accepted; message says "between 10 and 15 digits"
```

- **What the user did:** typed letters/symbols, or pasted a number with spaces, into the mobile field.
- **What the system did:** accepted the value (it only checked how long it was), and reported the range `10 to 15`.
- **Incorrect:** letters passed the screen; the allowed length (10–15) did not match the business rule (10); the message was wrong.
- **Expected:** digits only, exactly 10, message `Mobile number must be 10 digits`.

---

## 4. Root Cause

Confirmed from the source before the fix:

1. **Register form** validated only length, not the characters:
   `phoneNumber: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(15)]]`
   `minLength`/`maxLength` count characters, so `abcdefghij` is valid.
2. **No typing restriction:** the input was a plain `<input type="tel">`; nothing stopped non-digit keystrokes or pasted text.
3. **Wrong rule and wrong message:** the range was 10–15 and the message was `Mobile number must be between 10 and 15 digits.` (Register), `Enter a valid phone number containing 10 to 15 digits only.` (Accounts).
4. **Inconsistent rules between screens:** Accounts and Profile used `/^[0-9]{10,15}$/`; Logistics booking used `/^[6-9]\d{9}$/`.
5. **Backend accepted the same wrong rule:** `UserAccountRequestDto` used `@Pattern("^[0-9]{10,15}$")`, `UserAccountService.normalizePhoneNumber` used `matches("^[0-9]{10,15}$")`, and `CustomerRegistrationRequestDto` only had `@Size(min = 10, max = 15)`.

---

## 5. Solution

The rule is defined **once per side** and reused everywhere:

```text
User types / pastes
        ↓
DigitsOnlyDirective  (blocks non-digits, caps at 10, cleans paste)
        ↓
mobileNumberValidator()  (^[0-9]{10}$)  → "Mobile number must be 10 digits"
        ↓
POST to API
        ↓
S1 DTO @Pattern(MobileNumberRule.REGEX)  +  UserAccountService.normalizePhoneNumber
        ↓
Saved only if exactly 10 digits
```

- Typing aid (directive) + validator on the screen give instant feedback.
- The backend enforces the identical rule, so calling the API directly cannot skip it.
- No new library was used.

---

## 6. Implementation Details

### Frontend

**`core/validation/input-rules.ts` → single definition of the rule.** Holds the pattern, the message and the Angular validator. Empty values are left to `Validators.required`; anything else must match exactly 10 digits.

**`shared/input-rules/digits-only.directive.ts` → typing/paste control.** Used as `[appDigitsOnly]="10"`. On `keydown` it blocks any non-digit key and stops typing when 10 digits are present; on `paste` it removes every non-digit and trims to 10; on `input` (drag-drop, autofill) it cleans again. It writes the cleaned value back through a real `input` event so reactive forms and `ngModel` see exactly what is displayed.

**Screens wired to the shared rule**

| Screen | Change |
| --- | --- |
| Register | validator `mobileNumberValidator()`, `[appDigitsOnly]="10"`, inline message `Mobile number must be 10 digits` |
| Admin → Accounts (create) | same validator + directive; message text updated |
| Profile | same validator + directive; label `Mobile number`; inline message |
| Logistics booking (receiver phone) | `PHONE_PATTERN = MOBILE_NUMBER_PATTERN`; `[appDigitsOnly]="10"`; message updated |

### Backend

**S1 `validation/MobileNumberRule.java` (new)** → the single backend definition (`^[0-9]{10}$`, message `Mobile number must be exactly 10 digits`).

**S1 `UserAccountRequestDto` / `CustomerRegistrationRequestDto`** → bean validation `@Pattern(regexp = MobileNumberRule.REGEX, ...)` (registration previously only checked size).

**S1 `UserAccountService.normalizePhoneNumber`** → service-level check with `MobileNumberRule.isValid(...)`, covering every flow that creates/updates an account.

**S4 `LogisticsBookingDetailService.validateReceiver`** → receiver phone changed from `^[6-9][0-9]{9}$` to `^[0-9]{10}$`, so the whole application uses the same 10-digit rule.

---

## 7. Execution Flow

```text
1. User focuses the mobile field and types / pastes
        ↓
2. DigitsOnlyDirective drops non-digits and stops at 10 digits
        ↓
3. Angular form value = cleaned digits
        ↓
4. mobileNumberValidator() runs on every change
        ↓
5. Field touched + invalid → "Mobile number must be 10 digits" is shown
        ↓
6. On submit the form posts the value to S1 (or S4 for logistics)
        ↓
7. Backend validates again (DTO @Pattern + service check)
        ↓
8. Valid → saved. Invalid → request rejected with the backend message
```

**Alternate flows**
- Pasted `98a-76 54321099` → becomes `9876543210` (cut at 10 digits).
- Empty field → `Validators.required` reports it (the mobile rule ignores empty values).
- Direct API call with letters or 9/11 digits → rejected by the backend.

---

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Frontend | `frontend/src/app/core/validation/input-rules.ts` | new shared rule + validator |
| Frontend | `frontend/src/app/shared/input-rules/digits-only.directive.ts` | new digits-only/paste directive |
| Frontend | `features/auth/register/register.component.ts/.html` | validator, directive, message |
| Frontend | `features/admin/accounts/accounts.component.ts/.html` | validator, directive, message |
| Frontend | `features/profile/profile.component.ts/.html` | validator, directive, message |
| Frontend | `features/logistics/logistics-booking.component.ts/.html` | shared pattern, directive, message |
| Backend S1 | `validation/MobileNumberRule.java` | new single rule |
| Backend S1 | `dto/UserAccountRequestDto.java`, `dto/CustomerRegistrationRequestDto.java` | `@Pattern` with the shared rule |
| Backend S1 | `service/UserAccountService.java` | `normalizePhoneNumber` uses the rule |
| Backend S4 | `service/LogisticsBookingDetailService.java` | receiver phone `^[0-9]{10}$` |

---

## 9. Important Code Changes

**File:** `frontend/src/app/core/validation/input-rules.ts`
**Purpose:** the one Angular definition of the mobile rule.

```ts
export const MOBILE_NUMBER_LENGTH = 10;
export const MOBILE_NUMBER_PATTERN = /^[0-9]{10}$/;
export const MOBILE_NUMBER_MESSAGE = 'Mobile number must be 10 digits';

function patternValidator(pattern: RegExp, errorKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    return pattern.test(String(value)) ? null : { [errorKey]: true };
  };
}

export const mobileNumberValidator = (): ValidatorFn => patternValidator(MOBILE_NUMBER_PATTERN, 'mobileNumber');
```

The validator checks the *characters* (regex), not just the length, so letters are now invalid. This replaces the length-only check that let `abcdefghij` through.

---

**File:** `frontend/src/app/shared/input-rules/digits-only.directive.ts`
**Purpose:** stop non-digits while typing and clean pasted text.

```ts
@HostListener('keydown', ['$event'])
onKeydown(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return; // Backspace, arrows, Tab...
  if (!/^[0-9]$/.test(event.key)) { event.preventDefault(); return; }
  const noSelection = this.element.selectionStart === this.element.selectionEnd;
  if (noSelection && this.element.value.length >= this.max()) event.preventDefault();
}

@HostListener('paste', ['$event'])
onPaste(event: ClipboardEvent): void {
  event.preventDefault();
  const digits = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
  ...
  const merged = (this.element.value.slice(0, start) + digits + this.element.value.slice(end)).slice(0, this.max());
  this.write(merged);
}
```

A letter key is cancelled, an 11th digit is cancelled, and pasted text is reduced to digits and cut at 10. `write()` re-dispatches an `input` event so the form control receives the cleaned value.

---

**File:** `frontend/src/app/features/auth/register/register.component.ts`
**Purpose:** replace the length-only validators.

```ts
// before
phoneNumber: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(15)]],
// after
phoneNumber: ['', [Validators.required, mobileNumberValidator()]],
```

```ts
if (c.phoneNumber.hasError('mobileNumber')) return `${MOBILE_NUMBER_MESSAGE}.`;
```

The submit toast now reports the correct rule instead of "between 10 and 15 digits".

---

**File:** `frontend/src/app/features/auth/register/register.component.html`
**Purpose:** input restriction + inline message.

```html
<input type="tel" class="input" formControlName="phoneNumber" [appDigitsOnly]="10" placeholder="10-digit mobile" />
@if (form.controls.phoneNumber.touched && form.controls.phoneNumber.hasError('mobileNumber')) {
  <p class="mt-1 text-xs font-semibold text-rose-600">Mobile number must be 10 digits</p>
}
```

---

**File:** `S1-platform-territory/src/main/java/com/cbg/lbos/validation/MobileNumberRule.java`
**Purpose:** the single backend rule.

```java
public final class MobileNumberRule {
    public static final String REGEX = "^[0-9]{10}$";
    public static final String MESSAGE = "Mobile number must be exactly 10 digits";

    public static boolean isValid(String value) {
        return value != null && value.matches(REGEX);
    }
}
```

---

**File:** `S1-platform-territory/src/main/java/com/cbg/lbos/dto/CustomerRegistrationRequestDto.java`
**Purpose:** registration previously only checked size.

```java
@NotBlank
@Pattern(regexp = MobileNumberRule.REGEX, message = MobileNumberRule.MESSAGE)
private String phoneNumber;
```

---

**File:** `S1-platform-territory/src/main/java/com/cbg/lbos/service/UserAccountService.java`
**Purpose:** service-level enforcement for every account flow.

```java
if (!MobileNumberRule.isValid(normalizedPhoneNumber)) {
    throw new ValidationException(MobileNumberRule.MESSAGE);
}
```

---

**File:** `S4-order-logistics/src/main/java/com/cbg/lbos/service/LogisticsBookingDetailService.java`
**Purpose:** align the receiver phone with the application-wide rule.

```java
|| !dto.getReceiverPhoneNumber().trim().matches("^[0-9]{10}$")) {
    throw new IllegalArgumentException("Receiver mobile number must be exactly 10 digits");
```

---

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| Allowed characters | Anything (only length checked) | Digits only |
| Length | 10–15 (Logistics: 10 starting 6–9) | Exactly 10 everywhere |
| Typing | Any key accepted | Non-digit keys blocked; 11th digit blocked |
| Paste | Pasted as-is | Cleaned to digits, cut at 10 |
| Message | `between 10 and 15 digits` | `Mobile number must be 10 digits` |
| Backend | `^[0-9]{10,15}$`, registration size-only | `^[0-9]{10}$` in DTOs and service |

---

## 11. Testing

### Test Case 1 — Valid input
1. Open the Register page.
2. Type `9876543210` in Mobile Number.
3. Expected: accepted, no error message.

### Test Case 2 — Letters and symbols
1. Try typing `abc`, `9-8`, or a space.
2. Expected: the characters do not appear.

### Test Case 3 — Paste
1. Paste `98a-76 54321099`.
2. Expected: the field shows `9876543210`.

### Test Case 4 — Too short
1. Enter `98765`, leave the field.
2. Expected: `Mobile number must be 10 digits`; submit reports the same message.

### Test Case 5 — Too long
1. Type 10 digits and press another digit.
2. Expected: the extra digit is not entered.

### Test Case 6 — Backend enforcement
1. Send a create/register request with `phoneNumber` `"98765abcde"` or `"987654321"`.
2. Expected: rejected by the backend with a mobile-number validation message.

### Test Case 7 — Other screens
1. Repeat cases 1–4 on Admin → Accounts (create), Profile, and Logistics booking (receiver phone).
2. Expected: identical behavior.

---

## 12. Final Result

```text
After the fix:

- Mobile fields accept digits only and never more than 10.
- Pasted text is cleaned automatically.
- The message is "Mobile number must be 10 digits" on every screen.
- S1 and S4 enforce the same rule, so the API cannot be used to bypass it.
- The rule lives in one place per side (input-rules.ts / MobileNumberRule.java).
```

---

## Test Files Created for This Ticket

These are the backend test files that belong to this ticket (paths from the project root):

| Test file | What it checks |
| --- | --- |
| `S1-platform-territory/src/test/java/com/cbg/lbos/validation/InputRulesTest.java` | `mobileNumberIsExactlyTenDigits` - the single S1 mobile rule. |
| `S4-order-logistics/src/test/java/com/cbg/lbos/service/LogisticsBookingDetailServiceTest.java` | `createRejectsAnInvalidReceiverPhoneNumber` - the receiver phone rule of the logistics booking. |
| `S1-platform-territory/src/test/java/com/cbg/lbos/service/UserAccountServiceTest.java` | Phone number handling in the account service. |

---

## Main Code Location

| Item | Location |
| --- | --- |
| File | `S1-platform-territory/src/main/java/com/cbg/lbos/validation/MobileNumberRule.java` |
| Place | class `MobileNumberRule` |
| Why this is the main place | The one rule (exactly 10 digits) every mobile number field on the backend uses. |

A banner comment `TK_INC0010070_Mobile_Number_Validation_3230833` marks this place in the source code.
