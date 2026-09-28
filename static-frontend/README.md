# AroundU – static frontend

This folder is a **static copy of the Angular frontend** in `../frontend`, built with plain HTML, CSS and vanilla JavaScript only.
It reproduces the Angular pages' layout, styling, text, validation messages, popups, tables, forms, dropdowns and flows.
The desktop view was compared screenshot by screenshot with the Angular build.

* **No Angular, no TypeScript, no build step.** The pages are ordinary `.html` files that load `.css` and `.js` files.
* **No backend.** There are no REST calls, no microservices, no database and no real authentication server.
  Every request the Angular services would send is answered in the browser from hardcoded data (`js/common/data-store.js`).
* **All data is hardcoded.** The data is the platform's seed data (`../seed-data`), compiled into `js/common/data.js`.
* **`localStorage` is used for simulation.** Logins, carts, orders, tickets, approvals and profile edits are stored in
  `localStorage`, so they survive page reloads and are shared by all the role folders.
* **Desktop first.** The desktop layout is the reference. The Angular app's responsive classes are kept as they are, but the
  mobile and tablet layouts were not re-verified.

Two changes from the Angular app were made on request:

* **Retailer bulk product upload is removed.** The catalogue keeps the normal single-product form (fields, validation,
  category, product images, edit, duplicate, delete).
* **Retailer profile is read-only until Edit.** All profile fields are always shown but disabled. **Edit** enables them.
  **Save changes** stays disabled until a field actually differs from the saved profile. Saving stores the change
  locally, then disables the fields and the Save button again.

The Angular project itself was not modified.

---

## Start page

Open **`customer/commerce/html/landing.html`**. It is the public home page, the Angular route `/`.
`index.html` in this folder only forwards to it.

The pages work when opened straight from disk (double-click the file). They also work from any static web server:

```
cd static-frontend
python -m http.server 8080        # then open http://localhost:8080/customer/commerce/html/landing.html
```

---

## Signing in (simulated)

Every seeded account has the same password: **`Lbos@2026!`**

| Role | Folder | Example account | Lands on |
|---|---|---|---|
| Customer | `customer/commerce`, `customer/logistics` | `customer1.chn@lbos.com` | `customer/commerce/html/home.html` |
| Retailer | `retailer` | `retailer1.chn@lbos.com` (`retailer6.chn@lbos.com` is still pending verification) | `retailer/html/dashboard.html` |
| Fleet owner | `fleet-owner` | `fleet1.baw@lbos.com` | `fleet-owner/html/dashboard.html` |
| Driver | `driver` | `driver1fleet3.chn@lbos.com` | `driver/html/dashboard.html` |
| Support executive | `support-executive` | `support1@lbos.com` | `support-executive/html/dashboard.html` |
| Location manager | `location-manager` | `lm1.chn@lbos.com` | `location-manager/html/dashboard.html` |
| Operational manager | `operational-manager` | `op.ch@lbos.com` | `operational-manager/html/dashboard.html` |
| Admin | `admin` | `admin@lbos.com` | `admin/html/dashboard.html` |

The complete list of accounts is in `../credentials.md` and `../seed-data/credentials.md`.

**How the simulated sign-in works:**

* Everyone signs in on `customer/commerce/html/login.html`, the single `/login` page of the Angular app.
  Logging in checks the email and password against the seeded users. It stores a session under `aroundu.session`
  (the same key the Angular app uses) and opens that role's dashboard.
* Registering creates a new customer account, which can then log in.
* Logging out removes the session.
* "Forgot password" and "reset password" behave like the Angular screens do.

**Route guards** behave as they do in Angular:

* A signed-out visitor who opens a protected page is sent to the login page.
* A signed-in user who opens another role's page sees `unavailable.html`.
* A customer without a delivery address is sent to `add-address.html`.
* An unverified retailer or fleet owner is sent to their onboarding page.

---

## Folder structure

There is one folder per user role. The customer has two sections: commerce and logistics.
Every role folder is self-contained:

```
<role>/
├── html/            one HTML file per page of that role
├── css/
│   ├── <page>.css   that page's own stylesheet
│   └── common/      stylesheets of the components the role's pages share, one file per component
└── js/
    ├── <page>.js    that page's component (state, handlers, template)
    └── common/      scripts shared by the role's pages, one file per component / service / module
```

```
static-frontend/
├── index.html                 forwards to customer/commerce/html/landing.html
├── assets/images/favicon.ico
├── customer/
│   ├── commerce/              public pages (landing, login, register, password reset) + the shop
│   └── logistics/             parcel booking
├── retailer/
├── fleet-owner/
├── driver/
├── support-executive/
├── location-manager/
├── operational-manager/
└── admin/
```

### CSS

The Angular templates are styled with Tailwind utility classes and a small design system in `src/styles.scss`.
Each page links its stylesheets in the same cascade order as the Angular build:

1. `common/fonts.css`, `common/fontawesome.css`: web fonts and icons, embedded so they also load from `file://`.
   Only the icons the role uses are listed.
2. `common/base.css`: the reset, colour variables, page font and background.
3. Design-system components (`@layer components` in `styles.scss`), one file each, and only where used:
   `buttons.css`, `card.css`, `badge.css`, `form-controls.css` (inputs, dropdowns, labels), `spinner.css`,
   `header.css` (glass header and nav pills), `brandmark.css` and `dropdown-panel.css`.
4. `<page>.css`: the utility classes that page uses, with its shell and components, in Tailwind's order. It also holds the
   page component's own `.component.css` (for example the landing page's scroll-reveal animations).
5. Component stylesheets (Angular `*.component.css` / `:host` rules), one file per component:
   `shell.css`, `order-status-stepper.css`, `product-card.css`, `star-rating.css`, `empty-state.css`, `loading-state.css`,
   `my-tickets.css`, `serviceability-conflict-dialog.css`.

A layout component whose Angular stylesheet is empty (for example the portal sidebars and headers) has no CSS file.
It is styled entirely by the utility classes in the page stylesheets.

### JavaScript (`js/common/`)

| File(s) | What it is |
|---|---|
| `template.js`, `dom-morph.js`, `app.js` | Rendering: `U.html` templates, in-place DOM updates, re-rendering after every change (change detection) |
| `pipes.js`, `forms.js`, `input-directives.js`, `input-rules.js`, `helpers.js` | Angular pipes (dates, currency), a small reactive-forms equivalent with validators, input filters, the validation rules and messages |
| `toast.js` | The app-wide toast |
| `navigation.js` | Route → page mapping across all role folders, route guards, role landing pages and `boot()` |
| `shell.js`, `header.js`, `footer.js`, `bottom-nav.js` | Customer layout: header (address picker, notifications, account menu), footer, mobile tab bar |
| `portal-shell.js`, `sidebar.js`, `header.js`, `footer.js` | Portal layout of the other roles: sidebar, top header with the account menu, footer |
| `*-service.js`, `file-blobs.js` | The Angular services (same names and methods), answered locally |
| `data.js`, `data-store.js`, `data-client.js` | Hardcoded data, the in-browser data store that applies the business rules, and the call layer between services and store |
| `product-card.js`, `order-status-stepper.js`, `confirm-dialog.js`, `address-list.js`, `my-tickets.js`, `document-history.js`, `work-transfer.js`, `entity-ticket-queue.js`, ... | Shared components (`src/app/shared/*` and reused feature components) |

A role folder only contains the common files its own pages use.

Every HTML page loads its common scripts, then its page script, then calls `boot({ route, shell, guards, page })`. `boot()`:

1. runs the route guards;
2. renders the page inside the role's layout;
3. re-renders it whenever its data changes.

---

## Pages

Where the Angular route contains an id, the static page takes it as `?id=`. For example, `/orders/12` becomes
`customer/commerce/html/order-detail.html?id=12`.

**Customer - Commerce** - `customer/commerce/html/`

| Page | Angular route | Angular component |
|---|---|---|
| `landing.html` | `/` | `landing.component` |
| `login.html` | `/login` | `login.component` |
| `register.html` | `/register` | `register.component` |
| `forgot-password.html` | `/forgot-password` | `forgot-password.component` |
| `reset-password.html` | `/reset-password` | `reset-password.component` |
| `unavailable.html` | `/unavailable` | `unavailable.component` |
| `add-address.html` | `/add-address` | `add-address.component` |
| `home.html` | `/home` | `home.component` |
| `product-list.html` | `/products` | `product-list.component` |
| `product-detail.html` | `/products/:id` | `product-detail.component` |
| `cart.html` | `/cart` | `cart.component` |
| `wishlist.html` | `/wishlist` | `wishlist.component` |
| `address-list.html` | `/addresses` | `address-list.component` |
| `checkout.html` | `/checkout` | `checkout.component` |
| `order-list.html` | `/orders` | `order-list.component` |
| `order-detail.html` | `/orders/:id` | `order-detail.component` |
| `profile.html` | `/profile` | `profile.component` |
| `customer-support.html` | `/support` | `customer-support.component` |
| `ticket-detail.html` | `/support/:id` | `ticket-detail.component` |
| `profile-ticket-detail.html` | `/profile/:id` | `ticket-detail.component` |

**Customer - Logistics** - `customer/logistics/html/`

| Page | Angular route | Angular component |
|---|---|---|
| `logistics-booking.html` | `/logistics` | `logistics-booking.component` |

**Retailer** - `retailer/html/`

| Page | Angular route | Angular component |
|---|---|---|
| `onboarding.html` | `/retailer/onboarding` | `onboarding.component` |
| `dashboard.html` | `/retailer/dashboard` | `dashboard.component` |
| `catalogue.html` | `/retailer/catalogue` | `catalogue.component` |
| `inventory.html` | `/retailer/inventory` | `inventory.component` |
| `orders.html` | `/retailer/orders` | `orders.component` |
| `store.html` | `/retailer/store` | `store.component` |
| `profile.html` | `/retailer/profile` | `profile.component` |
| `finance.html` | `/retailer/finance` | `finance.component` |
| `user-support.html` | `/retailer/support` | `user-support.component` |
| `notifications.html` | `/retailer/notifications` | `notifications.component` |
| `ticket-detail.html` | `/retailer/support/:id` | `ticket-detail.component` |
| `escalations.html` | `/retailer/escalations` | `retailer-escalations.component` |

**Fleet Owner** - `fleet-owner/html/`

| Page | Angular route | Angular component |
|---|---|---|
| `onboarding.html` | `/fleet/onboarding` | `onboarding.component` |
| `dashboard.html` | `/fleet/dashboard` | `dashboard.component` |
| `drivers.html` | `/fleet/drivers` | `drivers.component` |
| `vehicles.html` | `/fleet/vehicles` | `vehicles.component` |
| `assignments.html` | `/fleet/assignments` | `assignments.component` |
| `expenses.html` | `/fleet/expenses` | `expenses.component` |
| `trips.html` | `/fleet/trips` | `trips.component` |
| `notifications.html` | `/fleet/notifications` | `notifications.component` |
| `user-support.html` | `/fleet/support` | `user-support.component` |
| `ticket-detail.html` | `/fleet/support/:id` | `ticket-detail.component` |
| `escalations.html` | `/fleet/escalations` | `fleet-escalations.component` |
| `profile.html` | `/fleet/profile` | `profile.component` |

**Driver** - `driver/html/`

| Page | Angular route | Angular component |
|---|---|---|
| `dashboard.html` | `/driver/dashboard` | `driver-dashboard.component` |
| `trips.html` | `/driver/trips` | `driver-trips.component` |
| `profile.html` | `/driver/profile` | `profile.component` |
| `user-support.html` | `/driver/support` | `user-support.component` |
| `ticket-detail.html` | `/driver/support/:id` | `ticket-detail.component` |

**Support Executive** - `support-executive/html/`

| Page | Angular route | Angular component |
|---|---|---|
| `dashboard.html` | `/support-staff/dashboard` | `support-dashboard.component` |
| `support.html` | `/support-staff/support` | `support.component` |
| `ticket-detail.html` | `/support-staff/support/:id` | `ticket-detail.component` |

**Location Manager** - `location-manager/html/`

| Page | Angular route | Angular component |
|---|---|---|
| `dashboard.html` | `/location/dashboard` | `dashboard.component` |
| `notifications.html` | `/location/notifications` | `notifications.component` |
| `queue-list.html` | `/location/queue` | `queue-list.component` |
| `queue-detail.html` | `/location/queue/:id` | `queue-detail.component` |
| `support.html` | `/location/support` | `support.component` |
| `ticket-detail.html` | `/location/support/:id` | `ticket-detail.component` |

**Operational Manager** - `operational-manager/html/`

| Page | Angular route | Angular component |
|---|---|---|
| `dashboard.html` | `/operations/dashboard` | `dashboard.component` |
| `queue-list.html` | `/operations/queue` | `queue-list.component` |
| `queue-detail.html` | `/operations/queue/:id` | `queue-detail.component` |
| `officers.html` | `/operations/officers` | `officers.component` |
| `territory.html` | `/operations/territory` | `territory.component` |
| `finance.html` | `/operations/finance` | `finance.component` |
| `support.html` | `/operations/support` | `support.component` |
| `ticket-detail.html` | `/operations/support/:id` | `ticket-detail.component` |
| `audit.html` | `/operations/audit` | `audit.component` |

**Admin** - `admin/html/`

| Page | Angular route | Angular component |
|---|---|---|
| `dashboard.html` | `/admin/dashboard` | `dashboard.component` |
| `accounts.html` | `/admin/accounts` | `accounts.component` |
| `operations-managers.html` | `/admin/operations-managers` | `operations-managers.component` |
| `officers.html` | `/admin/officers` | `officers.component` |
| `states.html` | `/admin/states` | `states.component` |
| `territory.html` | `/admin/territory` | `territory.component` |
| `queue-list.html` | `/admin/queue` | `queue-list.component` |
| `queue-detail.html` | `/admin/queue/:id` | `queue-detail.component` |
| `finance.html` | `/admin/finance` | `finance.component` |
| `support.html` | `/admin/support` | `support.component` |
| `ticket-detail.html` | `/admin/support/:id` | `ticket-detail.component` |
| `audit.html` | `/admin/audit` | `audit.component` |

Angular components that no page renders have no static copy. This holds in the Angular app too:

* `features/cart/cart-address-selector`
* `features/location/territory`
* `shared/terms-dialog` (the register page has its own terms popup)
* `shared/shop-detail-expander` (replaced by the retailer info dialog)

---

## Simulated backend and `localStorage`

`js/common/data-store.js` answers every call the Angular services make, from the hardcoded data. It covers:

* **Accounts and places:** auth, users, states, cities, zones, managers.
* **Partners and verification:** retailers, fleet owners, verification queues and documents.
* **Shopping and orders:** catalogue and inventory, cart, wishlist, addresses, checkout, reviews, orders, tracking.
* **Fleet:** trips, logistics bookings and rates, drivers, vehicles, assignments, expenses.
* **Finance, support and reporting:** payments, settlements, refunds, tax rules, notifications, support tickets, audit log, analytics.

It applies the business rules the real services enforce, such as ownership checks, status transitions,
validation messages and stock checks. Nothing is sent over the network: there is no `fetch`, no `XMLHttpRequest` and no server.

| `localStorage` key | Purpose |
|---|---|
| `aroundu.static.db` | The whole simulated database (the hardcoded data plus every change you make) |
| `aroundu.session` | The signed-in user (same key as the Angular app) |
| `aroundu.myOrderIds`, `aroundu.myDriverIds`, `aroundu.myVehicleIds` | The same "remembered ids" the Angular services keep |
| `aroundu.sidebarCollapsed` | Collapsed / expanded portal sidebar |

Every role folder reads and writes the same keys, so an order placed as a customer shows up for the retailer.

Saving takes about 250 ms, like a network round-trip, so the loading spinners and disabled buttons behave as in the Angular app.

Uploaded files (documents, product images, proofs) are read in the browser and stored in the simulated database.

**To reset the demo data**, do either of the following:

* clear the site's `localStorage` in the browser's developer tools;
* run `MockBackend.reset()` in the developer-tools console.

---

## Differences you may notice

* Order, ticket and trip numbers are generated from the current time, as in Angular, so they differ between runs.
* Document downloads that the real backend generates are produced in the browser; seeded documents are small placeholder PDFs.
* Emails (password reset, notifications to other users) are not sent. Their effects are recorded in the simulated database.

---

## How it was verified (desktop, 1440 × 900)

**Against the Angular app**

* The Angular production build and this folder were loaded side by side in Chromium.
* Both had the same session and the same data; the Angular app's API calls were answered by the same data store.
* 190 page states were screenshotted and compared pixel by pixel. They cover every page, plus:
  * validation errors, tabs, dropdowns, dialogs and popups;
  * work-transfer popups;
  * order, ticket, refund, verification, dispatch and delivery-proof flows.

**Results (190 states)**

* **179 are identical.** This includes the retailer's new-product and edit-product forms.
* **6 differ on purpose,** because of the two requested changes:
  * the catalogue list without the bulk-upload controls, including the delete-confirmation state;
  * the three former bulk-upload states;
  * the read-only retailer profile with its Edit button.
* **3 differ only in a value created at that moment:** two order / booking numbers and one ticket-message time.
* **1 differs because of the test harness,** not this copy: the harness cannot hand Angular a real file, so on the fleet
  expense-proof preview Angular shows "Preview is not available".
* **1 differs only in text anti-aliasing:** 138 pixels in the portal sidebar's brand row once the location dashboard is scrolled.
  The DOM, every element's position and every computed style are identical there.

**Other checks**

* **Against the previous one-folder version:** every state was also compared with the earlier static copy, which had already
  been verified against Angular. The rendered DOM is identical apart from the requested changes and generated ids.
  Every class an element carries is styled by the new stylesheets.
* **Script dependencies:** for every page, every global a loaded script uses is defined by a script that page loads.
* **Crawl:** all 80 pages were opened as a suitable user, over HTTP and straight from disk (`file://`). None had script errors,
  console errors, failed or 404 requests, or broken internal links.
* **Retailer profile:**
  * Initially: Edit enabled, Save disabled, fields disabled.
  * After Edit: fields enabled, Save still disabled.
  * After a change: Save enabled. Changing the value back disables Save again.
  * After Save: the new value is shown, the fields and Save are disabled, and the value survives a reload.
* **Bulk upload:** no bulk-upload code, text or files remain in the retailer folder or the data store.
