# INC0010077 — Dropdown Arrow UI

## 1. Ticket Overview

| Field | Details |
| --- | --- |
| Ticket | INC0010077 |
| Category | UI |
| Issue | Dropdown controls are missing the arrow icon, affecting usability. |
| Main Area | Shared `.select` style in `frontend/src/styles.scss` (used by every dropdown in the Angular app) |
| Purpose | Every dropdown shows the same, consistent arrow and looks like the other form controls. |

---

## 2. Understanding the Ticket

**Requested:** dropdowns must show an arrow so the user can tell they are dropdowns.

**Why:** without an arrow, a dropdown looks like a plain text box and users do not know it can be opened.

**What the system should do:** all dropdowns share one look — an arrow on the right, text that never runs under the arrow, the same height/border/focus as text inputs, and a visible disabled state.

**Affected:** all `<select class="select">` controls in the application (28 component files use the class), including the new Role and Status filters, the Zone/Operations Manager dropdowns and the Product Category dropdowns.

---

## 3. Existing Problem

```text
Page renders <select class="select">
        ↓
.select removes the browser's own arrow (appearance-none)
        ↓
No replacement arrow is drawn
        ↓
Dropdown looks like a plain input
```

- **What the user saw:** dropdown boxes with no arrow.
- **What the system did:** the shared `.select` class hid the browser's native arrow but drew nothing in its place.
- **Expected:** a visible arrow on every dropdown.

---

## 4. Root Cause

The shared class in `styles.scss` was:

```scss
.select {
  @apply input appearance-none bg-no-repeat pr-9;
}
```

- `appearance-none` turns off the browser's native arrow.
- `bg-no-repeat` and `pr-9` were prepared for a background arrow image, but **no `background-image` was ever defined**, so nothing was drawn.

Because the whole app uses the same class, every dropdown was affected. One dropdown (the Work Transfer dialog, which borrows `.select`) worked around it by drawing its own chevron icon with a separate `<i class="fa-solid fa-chevron-down">`, so it looked different from the rest.

---

## 5. Solution

```text
<select class="select">
        ↓
.select  (shared CSS in styles.scss)
        ↓
SVG chevron as background-image, right-aligned
        ↓
Same arrow, height, padding, border, focus on every dropdown
```

The arrow is supplied **once**, in the shared class, as an inline SVG chevron background. No per-screen change is needed, and no image file or icon library is added.

---

## 6. Implementation Details

### Frontend (CSS)

**`frontend/src/styles.scss` → `.select`**
- Inherits `.input` (same height, padding, border, radius and focus ring as text fields).
- `appearance-none` still removes the native arrow, but a data-URI SVG chevron is placed with `background-position: right 0.85rem center` at `1rem × 1rem`.
- `pr-10` keeps the text clear of the arrow; `truncate` cuts long values instead of running under it; `cursor-pointer` shows it is clickable.
- **Focus:** the chevron changes to the app's purple.
- **Disabled:** grey chevron, grey background, `cursor-not-allowed`.
- **Multi-select / list boxes** (`multiple`, `size > 1`): no arrow, normal padding (an arrow makes no sense there).

**`shared/work-transfer/work-transfer-dialog.component.ts`** — removed its own Font Awesome chevron, because the shared class now provides the arrow (otherwise two arrows would show).

---

## 7. Execution Flow

```text
1. Any screen renders <select class="select">
        ↓
2. Tailwind @layer components applies .select
        ↓
3. .input gives the box (border, radius, padding, focus)
        ↓
4. background-image draws the chevron at the right edge
        ↓
5. pr-10 + truncate keep the selected text away from the arrow
        ↓
6. Focus → purple chevron; disabled → grey chevron
```

**Alternate flows:** a `multiple`/`size` select has no arrow; a select in a narrow container truncates the label instead of overlapping the arrow.

---

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Frontend (styles) | `frontend/src/styles.scss` | `.select` now draws the arrow; focus, disabled and multiple variants |
| Frontend (component) | `frontend/src/app/shared/work-transfer/work-transfer-dialog.component.ts` | removed the duplicate chevron icon |

---

## 9. Important Code Changes

**File:** `frontend/src/styles.scss`
**Purpose:** give every `.select` an arrow.

```scss
.select {
  @apply input cursor-pointer appearance-none truncate bg-no-repeat pr-10;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 7.5l5 5 5-5'/%3E%3C/svg%3E");
  background-position: right 0.85rem center;
  background-size: 1rem 1rem;
}
.select:focus {
  background-image: url("data:image/svg+xml,...stroke='%237c1fb8'...");   /* purple chevron */
}
.select:disabled {
  @apply cursor-not-allowed bg-slate-50 text-slate-400;
  background-image: url("data:image/svg+xml,...stroke='%23cbd5e1'...");   /* light grey chevron */
}
.select[multiple],
.select[size]:not([size='1']) {
  background-image: none;
  @apply pr-4;
}
```

Before, this rule was only `@apply input appearance-none bg-no-repeat pr-9;` — the missing `background-image` is exactly what this change adds. The SVG is a chevron path (`M5 7.5l5 5 5-5`) stroked in slate grey.

---

**File:** `frontend/src/app/shared/work-transfer/work-transfer-dialog.component.ts`
**Purpose:** avoid a second arrow.

```html
<!-- removed -->
<i class="fa-solid fa-chevron-down shrink-0 text-xs text-slate-400"></i>
```

---

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| Arrow | None (native hidden, nothing drawn) | Chevron on every dropdown |
| Spacing | `pr-9`, text could meet the arrow area | `pr-10` + truncate, no overlap |
| Focus | Input focus ring only | Focus ring + purple chevron |
| Disabled | No specific look | Grey background, grey chevron, not-allowed cursor |
| Consistency | Work Transfer used its own icon | One shared implementation |

---

## 11. Testing

### Test Case 1 — Arrow is visible
1. Open any screen with a dropdown (e.g. Admin → Accounts → Role filter, Register role, Retailer → Add Product → Category).
2. Expected: a chevron on the right side of the control.

### Test Case 2 — Focus
1. Click the dropdown.
2. Expected: purple focus ring and purple chevron.

### Test Case 3 — Disabled
1. Open a screen where a dropdown is disabled.
2. Expected: grey background and light-grey chevron, not clickable.

### Test Case 4 — Long text
1. Choose an option with a long label, or view the dropdown in a narrow container.
2. Expected: text is truncated and never runs under the arrow.

### Test Case 5 — Work Transfer dialog
1. Open the Work Transfer popup (deactivating a Location Manager with pending work).
2. Expected: exactly one arrow on its dropdown.

---

## 12. Final Result

```text
After the fix:

- Every <select class="select"> shows the same chevron arrow.
- Focus and disabled states are styled consistently.
- Long values do not overlap the arrow.
- The fix lives in one shared CSS class, so new dropdowns get it automatically.
```
