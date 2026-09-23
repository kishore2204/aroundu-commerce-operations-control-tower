# INC0010075 — Password Validation

## 1. Ticket Overview

| Field | Details |
| --- | --- |
| Ticket | INC0010075 |
| Category | Validation |
| Issue | Password validation appeared only after submission. Indicators for uppercase, lowercase, number and special character must appear while typing. |
| Main Area | Password fields (Register, Reset password, Admin → Accounts, Officers, Drivers) and the S1 password rule |
| Purpose | Live "Password requirements" checklist, one password policy shared by the screens and enforced by the backend. |

---

## 2. Understanding the Ticket

**Requested:** while a user types a password, the screen should show which rules are met and which are not (minimum length, uppercase, lowercase, number, special character).

**Why:** the user only learned the password was unacceptable after pressing submit, and the earlier rule did not even distinguish uppercase from lowercase.

**What the system should do:**
- Show a "Password requirements" checklist that updates on every keystroke.
- Enforce the same five rules on the server in every flow that sets a password.

**Affected:** customers registering, users resetting a password, admins/operations creating accounts.

---

## 3. Existing Problem

```text
User types a password
        ↓
Screen checks only: at least 8 characters
        ↓
Nothing is shown while typing; on submit a toast says
"Password must be at least 8 characters."
```

- Register, Reset, Accounts, Officers and Drivers only validated length (`minLength(8)`).
- Register only reported a problem through the toast built after pressing submit; Accounts showed a static hint sentence (`At least 8 characters, with a letter, a number, and a special character`) that never reacted to typing.
- The backend rule was `^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$` — "a letter", not "an uppercase **and** a lowercase letter".
- **Expected:** live indicators for all five rules, and server enforcement of exactly those rules.

---

## 4. Root Cause

1. **Validation was only the length rule** on the screens (`Validators.minLength(8)`), so uppercase/lowercase/number/special were never evaluated on the client.
2. **Feedback was tied to submit:** Register's error text came from `firstValidationMessage()`, which runs after the submit handler calls `markAllAsTouched()`.
3. **No live component:** nothing rendered per-rule status; only static text existed.
4. **Weaker/inconsistent backend rule:** one regex with "a letter" (no upper/lower split); `CustomerRegistrationRequestDto` only had `@Size(min = 8, max = 72)`; `CreateOfficerRequestDto` only had `@NotBlank`.

---

## 5. Solution

```text
User Types Password
        ↓
passwordChecks(value)  (pure function, 5 rules)
        ↓
Password Rules Checked (length, uppercase, lowercase, number, special)
        ↓
<app-password-requirements> re-renders
        ↓
Indicators Updated (grey → green ✓ / red ✗)
```

- One rules module (`password-policy.ts`) drives both the checklist and the form validator, so they cannot disagree.
- One backend class (`PasswordPolicy`) drives every DTO and service check.
- The checklist is bound to the control's current value, so it updates on every keystroke without waiting for submit.

---

## 6. Implementation Details

### Frontend

**`core/validation/password-policy.ts` (new)** — `passwordChecks()` returns the five checks with a `met` flag; `passwordPolicyValidator()` marks the control invalid (`passwordPolicy`) unless all five are met.

**`shared/password-requirements/password-requirements.component.ts` (new)** — `<app-password-requirements [value]="...">` renders "Password requirements" and a list of the five rules. Neutral grey before the user starts typing; green ✓ when met; red ✗ when not met after typing has started.

**Wiring:** Register, Reset password, Admin → Accounts (create), Officers (create officer) and Drivers (create) now use `passwordPolicyValidator()` + `Validators.maxLength(PASSWORD_MAX_LENGTH)` and render the checklist under the password input. The old static hint in Accounts was replaced by the live component.

### Backend

**S1 `validation/PasswordPolicy.java` (new)** — the regex, message and `isValid()`.

**S1 DTOs** — `UserAccountRequestDto`, `ResetPasswordRequestDto`, `CreateOfficerRequestDto`, `CustomerRegistrationRequestDto` use `@Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)`.

**S1 `UserAccountService.validatePassword`** — used by account creation, update, registration and reset; now delegates to `PasswordPolicy.isValid` (this also covers the officer and driver flows, which create accounts through this service).

---

## 7. Execution Flow

```text
1. User clicks the password field and types
        ↓
2. Value flows into the form control
        ↓
3. app-password-requirements gets the new value
        ↓
4. passwordChecks() evaluates the five rules
        ↓
5. Each rule row turns green (met) or red (not met)
        ↓
6. passwordPolicyValidator() keeps the form invalid until all are met
        ↓
7. On submit the request goes to S1
        ↓
8. DTO @Pattern + UserAccountService.validatePassword check again
        ↓
9. Valid → password is BCrypt-encoded and saved
```

**Alternate flows:** empty field → only `required` is reported and the checklist stays neutral; a password longer than 72 characters fails `maxLength` and the length rule; a direct API call with a weak password is rejected with `PasswordPolicy.MESSAGE`.

---

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Frontend | `core/validation/password-policy.ts` | five rules + validator |
| Frontend | `shared/password-requirements/password-requirements.component.ts` | live checklist |
| Frontend | `features/auth/register/*`, `features/auth/reset-password/*` | validator + checklist |
| Frontend | `features/admin/accounts/*`, `features/operations/officers/*`, `features/fleet/drivers/*` | validator + checklist |
| Backend S1 | `validation/PasswordPolicy.java` | single rule |
| Backend S1 | `dto/UserAccountRequestDto`, `ResetPasswordRequestDto`, `CreateOfficerRequestDto`, `CustomerRegistrationRequestDto` | `@Pattern(PasswordPolicy.REGEX)` |
| Service S1 | `service/UserAccountService.java` | `validatePassword` uses `PasswordPolicy` |

---

## 9. Important Code Changes

**File:** `frontend/src/app/core/validation/password-policy.ts`
**Purpose:** the five rules and the form validator.

```ts
export function passwordChecks(value: string | null | undefined): PasswordCheck[] {
  const password = value ?? '';
  return [
    { key: 'length', label: 'Minimum 8 characters', met: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH },
    { key: 'uppercase', label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { key: 'lowercase', label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { key: 'number', label: 'Number', met: /[0-9]/.test(password) },
    { key: 'special', label: 'Special character', met: /[^A-Za-z0-9\s]/.test(password) },
  ];
}

export function passwordPolicyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null; // `required` reports empty
    return passwordChecks(String(value)).every((check) => check.met) ? null : { passwordPolicy: true };
  };
}
```

`passwordChecks` is the single source for both the live list and the validator. A special character is anything that is not a letter, digit or whitespace.

---

**File:** `frontend/src/app/shared/password-requirements/password-requirements.component.ts`
**Purpose:** render the live checklist.

```html
<p class="mb-1 text-xs font-bold text-slate-700">Password requirements</p>
<ul class="m-0 list-none space-y-1 p-0 text-xs">
  @for (check of checks; track check.key) {
    <li class="flex items-center gap-1.5 font-semibold"
        [class.text-emerald-600]="check.met"
        [class.text-rose-600]="!check.met && started"
        [class.text-slate-400]="!check.met && !started">
      <i class="fa-solid" [class.fa-circle-check]="check.met" [class.fa-circle-xmark]="!check.met && started" [class.fa-circle]="!check.met && !started"></i>
      {{ check.label }}
    </li>
  }
</ul>
```

```ts
@Input() value: string | null | undefined = '';
get checks(): PasswordCheck[] { return passwordChecks(this.value); }
get started(): boolean { return !!this.value; }
```

Because `checks` is computed from the bound `value`, every keystroke re-evaluates and re-colors the list.

---

**File:** `frontend/src/app/features/auth/register/register.component.ts` and `.html`
**Purpose:** use the shared policy and show the checklist.

```ts
// before
password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
// after
password: ['', [Validators.required, passwordPolicyValidator(), Validators.maxLength(PASSWORD_MAX_LENGTH)]],
```

```html
<app-password-requirements [value]="form.controls.password.value" />
```

---

**File:** `S1-platform-territory/src/main/java/com/cbg/lbos/validation/PasswordPolicy.java`
**Purpose:** the backend rule used by every flow.

```java
public static final int MIN_LENGTH = 8;
public static final int MAX_LENGTH = 72;

public static final String REGEX = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[^A-Za-z\\d\\s]).{8,72}$";

public static final String MESSAGE =
        "Password must be 8 to 72 characters and contain an uppercase letter, a lowercase letter, a number and a special character";

public static boolean isValid(String password) {
    return password != null && PATTERN.matcher(password).matches();
}
```

The old rule (`(?=.*[A-Za-z])`) only asked for "a letter"; this one asks separately for uppercase and lowercase. The 72-character cap is the existing backend limit.

---

**File:** `S1-platform-territory/src/main/java/com/cbg/lbos/dto/ResetPasswordRequestDto.java` (same pattern in the other DTOs)
**Purpose:** bean validation at the API boundary.

```java
@NotBlank
@Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
private String newPassword;
```

---

**File:** `S1-platform-territory/src/main/java/com/cbg/lbos/service/UserAccountService.java`
**Purpose:** service-level enforcement (also covers officer and driver creation).

```java
private void validatePassword(String password) {
    if (!hasText(password) || !PasswordPolicy.isValid(password)) {
        throw new ValidationException(PasswordPolicy.MESSAGE);
    }
}
```

---

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| When validated | Only after submit (toast) / static hint | On every keystroke |
| Feedback | One text message about length | Checklist with a ✓/✗ per rule |
| Client rules | Length only | Length, uppercase, lowercase, number, special |
| Backend rule | "a letter, a number, a special character" | uppercase + lowercase + number + special, 8–72 |
| Enforcement | Some DTOs only `@Size` / `@NotBlank` | Same rule in all password DTOs and the service |

---

## 11. Testing

### Test Case 1 — Live indicators
1. Open Register and click the password field.
2. Expected: five neutral (grey) rules under "Password requirements".
3. Type `a` → Lowercase turns green, the other four turn red.
4. Continue: `aA` → Uppercase green; `aA1` → Number green; `aA1!` → Special green; `aA1!aaaa` → Minimum 8 characters green.

### Test Case 2 — Valid password
1. Enter `Abcdef1!`.
2. Expected: all five green; the form can be submitted.

### Test Case 3 — Each missing rule
1. Enter `abcdefg1!` (no uppercase), `ABCDEFG1!` (no lowercase), `Abcdefgh!` (no number), `Abcdefg12` (no special).
2. Expected: exactly that rule stays red and the form does not submit.

### Test Case 4 — Other screens
1. Repeat on Reset password, Admin → Accounts (create), Operations → Officers (create officer), Fleet → Drivers (create).
2. Expected: the same checklist and behavior. (The Drivers default `Driver@123` satisfies the rules.)

### Test Case 5 — Backend enforcement
1. Call the register/reset/create-account API with `password123`.
2. Expected: rejected with the password policy message.

---

## 12. Final Result

```text
After the fix:

- Password rules are shown and updated while typing.
- The checklist and the form validator share one rule set.
- The same five rules are enforced by S1 in registration, reset, account
  creation, officer and driver creation.
- The screen can no longer accept a password the server would reject.
```

---

## Test Files Created for This Ticket

These are the backend test files that belong to this ticket (paths from the project root):

| Test file | What it checks |
| --- | --- |
| `S1-platform-territory/src/test/java/com/cbg/lbos/validation/InputRulesTest.java` | `passwordNeedsLengthUppercaseLowercaseNumberAndSpecialCharacter`, `passwordIsCappedAtTheExistingBackendLimit` - the single S1 password rule. |
| `S1-platform-territory/src/test/java/com/cbg/lbos/service/UserAccountServiceTest.java` | Password validation in the account service. |

---

## Main Code Location

| Item | Location |
| --- | --- |
| File | `S1-platform-territory/src/main/java/com/cbg/lbos/validation/PasswordPolicy.java` |
| Place | class `PasswordPolicy` |
| Why this is the main place | The single password rule used by registration, admin account creation, officers, drivers and reset. |

A banner comment `TK_INC0010075_Password_Validation_3247835` marks this place in the source code.
