# INC0010078 — Password Visibility Toggle

## 1. Ticket Overview

| Field | Details |
| --- | --- |
| Ticket | INC0010078 |
| Category | UI |
| Issue | The password field showed multiple or inconsistent eye icons for showing/hiding the password. Only one consistent toggle must be shown, and it must correctly show/hide the password. |
| Main Area | Every password input (Register, Reset password, Admin → Accounts, Officers, Drivers) and global styles |
| Purpose | Exactly one visibility toggle per password input, everywhere. |

---

## 2. Understanding the Ticket

**Requested:** each password field must have one eye icon; clicking it shows the password, clicking again hides it.

**Why:** users saw two eye icons on the same field on some screens, and no eye at all on others.

**What the system should do:** Password and Confirm Password each get their own single toggle; the icon reflects the current state.

**Affected:** all users who enter passwords.

---

## 3. Existing Problem

```text
Screen with a password field
        ↓
Application draws its own eye button
        ↓
Browser (Edge/Chrome) also draws its native "reveal password" eye
        ↓
Two eye icons on one input
```

- **Duplicate icons:** screens that already had the app's own toggle (Register, Admin → Accounts, Drivers) also showed the browser's built-in eye inside the same input.
- **Missing icon:** Reset password and the Operations → Officers "create officer" form used a plain `type="password"` input with **no** application toggle at all — so they looked different from the rest.
- **Expected:** one toggle on every password input.

---

## 4. Root Cause

1. **Native browser control:** Microsoft Edge (and some Chromium builds) render their own reveal control (`::-ms-reveal`, plus the clear/autofill buttons) inside `input[type=password]`. It was layered on top of the application's toggle button, producing the second eye. Nothing in the styles hid it.
   *(How this was established: the project's own toggle button was already present on those screens and nothing in the source drew a second icon, so the second eye can only be the browser's built-in control. It was not screenshot-verified in Edge in this session.)*
2. **Inconsistent implementation:** the toggle was implemented per screen (a `showPassword` signal + button). Reset password and Officers never got one.

---

## 5. Solution

```text
Password Field
      ↓
Single Visibility Toggle  (application button, one per input)
   ↙             ↘
Show Password   Hide Password
type="text"     type="password"
eye-slash icon  eye icon
```

- One global CSS rule hides the browser-native reveal/clear/autofill controls for every password input, so only the application's toggle remains.
- The missing toggles were added to Reset password (2 inputs) and Officers (2 inputs) using the same markup and pattern as Register.
- Existing toggles (Register, Accounts, Drivers) were kept — never two for one input.

---

## 6. Implementation Details

### Frontend — global style

**`frontend/src/styles.scss`** — rules that hide `::-ms-reveal`, `::-ms-clear` and `::-webkit-credentials-auto-fill-button` on every `input[type='password']`.

### Frontend — toggles added where missing

**`features/auth/reset-password/reset-password.component.ts/.html`**
- Two signals: `showPassword`, `showConfirmPassword`.
- Each input is wrapped in `<div class="relative">`; `[type]` is bound to `'text' | 'password'`; one absolutely-positioned button toggles the signal; the icon is `fa-eye` (hidden) or `fa-eye-slash` (visible).

**`features/operations/officers/officers.component.ts/.html`**
- Signals `showOfficerPassword` and `showOfficerConfirmPassword` for the create-officer form, same markup.

### Screens that already had a toggle (kept)
Register (Password + Confirm), Admin → Accounts (Password + Confirm), Fleet → Drivers (temporary password).

---

## 7. Execution Flow

```text
1. Password input renders with [type]="show ? 'text' : 'password'"
        ↓
2. Browser-native reveal button is hidden by the global CSS rule
        ↓
3. Only the application's eye button is visible
        ↓
4. User clicks it → signal flips
        ↓
5. Angular re-binds type → text (visible) / password (masked)
        ↓
6. Icon switches: fa-eye  ⇄  fa-eye-slash; aria-label: "Show password" ⇄ "Hide password"
```

Password and Confirm Password use separate signals, so each toggles independently.

---

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Frontend (styles) | `frontend/src/styles.scss` | hide native reveal/clear/autofill controls |
| Frontend | `features/auth/reset-password/reset-password.component.ts/.html` | two toggles added |
| Frontend | `features/operations/officers/officers.component.ts/.html` | two toggles added |

---

## 9. Important Code Changes

**File:** `frontend/src/styles.scss`
**Purpose:** remove the browser's own eye so only one remains.

```scss
input[type='password']::-ms-reveal,
input[type='password']::-ms-clear,
input[type='password']::-webkit-credentials-auto-fill-button {
  display: none !important;
  visibility: hidden;
  pointer-events: none;
}
```

It is a single global rule (not per screen), so every current and future password input is covered.

---

**File:** `frontend/src/app/features/auth/reset-password/reset-password.component.html`
**Purpose:** add the missing single toggle.

```html
<div class="relative">
  <input class="input !pr-11" [type]="showPassword() ? 'text' : 'password'" formControlName="newPassword" autocomplete="new-password" />
  <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-zepto-600"
          (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
    <i class="fa-solid" [class.fa-eye]="!showPassword()" [class.fa-eye-slash]="showPassword()"></i>
  </button>
</div>
```

```ts
readonly showPassword = signal(false);
readonly showConfirmPassword = signal(false);
```

`!pr-11` keeps typed text clear of the button.

---

**File:** `frontend/src/app/features/operations/officers/officers.component.html`
**Purpose:** same fix for the create-officer form.

```html
<input class="input !pr-11" [type]="showOfficerPassword() ? 'text' : 'password'" formControlName="password" autocomplete="new-password" />
<button type="button" ... (click)="showOfficerPassword.set(!showOfficerPassword())" ...>
  <i class="fa-solid" [class.fa-eye]="!showOfficerPassword()" [class.fa-eye-slash]="showOfficerPassword()"></i>
</button>
```

---

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| Register / Accounts / Drivers | App toggle + browser eye (two icons) | One icon (the app's) |
| Reset password | No toggle | Toggle on New and Confirm |
| Officers (create) | No toggle | Toggle on Password and Confirm |
| Icon state | Inconsistent | `fa-eye` (masked) ⇄ `fa-eye-slash` (visible) |
| Rule location | Nowhere | One global CSS rule |

---

## 11. Testing

### Test Case 1 — Single icon
1. Open Register in Edge.
2. Expected: one eye icon at the right of Password, and one at Confirm Password (no second icon inside the input).

### Test Case 2 — Show / hide
1. Type a password.
2. Click the eye → the text becomes visible and the icon becomes the slashed eye.
3. Click again → text is masked and the icon returns to the normal eye.

### Test Case 3 — Independent toggles
1. Show the Password field only.
2. Expected: Confirm Password stays masked.

### Test Case 4 — Previously missing screens
1. Open the reset link page (`/reset-password?token=…`) and Operations → Officers → create officer.
2. Expected: each password input has exactly one working eye.

### Test Case 5 — Other screens
1. Check Admin → Accounts (create) and Fleet → Drivers (create).
2. Expected: one icon per input.

---

## 12. Final Result

```text
After the fix:

- Every password input shows exactly one visibility toggle.
- The browser's native reveal control is hidden globally.
- Reset password and Officers now have the same toggle as Register.
- The icon and the masked/visible state always match.
```
