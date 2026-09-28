# AroundU – static frontend

This folder is a **static copy of the Angular frontend** in `../frontend`. It uses only plain HTML, CSS and vanilla JavaScript.
It has the same pages, layout, styling, text, validation messages, popups, tables, forms, dropdowns and business flows as the
Angular application. No part of the design was changed. Every page was compared screenshot-by-screenshot with the Angular build.

* **No Angular, no TypeScript, no build step.** The pages are ordinary `.html` files that load `.css` and `.js` files.
* **No backend.** There are no REST calls, no microservices, no database and no real authentication server.
  Every request the Angular services would send is answered in the browser by a small in-memory "mock backend".
* **All data is hardcoded.** The data is the platform's seed data (`../seed-data`), compiled into `js/data.js`.
* **`localStorage` is used for simulation.** Logins, sign-ups, carts, orders, tickets, approvals and so on are stored in
  `localStorage`, so the state survives page reloads and navigation, just as it would with a real server.

The Angular project itself was not modified.

---

## Start page

Open **`html/landing.html`**. It is the public home page, the Angular route `/`.

`index.html` in this folder only forwards to it.

The pages work when opened straight from disk (double-click the file). They also work from any static web server, for example:

```
cd static-frontend
python -m http.server 8080        # then open http://localhost:8080/html/landing.html
```

---

## Signing in (simulated)

Every seeded account has the same password: **`Lbos@2026!`**

| Role | Example account | Lands on |
|---|---|---|
| Customer | `customer1.chn@lbos.com` | `home.html` |
| Retailer | `retailer1.chn@lbos.com` (`retailer6.chn@lbos.com` is still pending verification) | `retailer-dashboard.html` |
| Fleet manager | `fleet1.baw@lbos.com` | `fleet-dashboard.html` |
| Driver | `driver1fleet3.chn@lbos.com` | `driver-dashboard.html` |
| Location manager | `lm1.chn@lbos.com` | `location-dashboard.html` |
| Operations manager | `op.ch@lbos.com` | `operations-dashboard.html` |
| Super admin | `admin@lbos.com` | `admin-dashboard.html` |
| Support staff | `support1@lbos.com` | `support-staff-dashboard.html` |

The complete list of accounts is in `../credentials.md` and `../seed-data/credentials.md`.

**How the simulated sign-in works:**

* Logging in checks the email and password against the seeded users and stores a session under `aroundu.session`. This is the same key the Angular app uses.
* Registering creates a new customer account, which can then log in.
* Logging out removes the session.
* "Forgot password" and "reset password" behave like the Angular screens do.

**Route guards** behave as they do in Angular:

* A signed-out visitor who opens a protected page is sent to `login.html`.
* A signed-in user who opens another role's portal sees `unavailable.html`.
* A customer without a delivery address is sent to `add-address.html`.
* An unverified retailer or fleet owner is sent to their onboarding page.

---

## Folder structure

```
static-frontend/
├── index.html              forwards to html/landing.html
├── html/                   one HTML file per Angular route (80 pages)
├── css/
│   ├── global.css          the compiled Angular global stylesheet (Tailwind build of src/styles.css)
│   ├── fontawesome.css     Font Awesome 6 (icons), exactly as bundled by the Angular build
│   ├── components.css      the Angular component stylesheets (*.component.css)
│   └── landing.css         landing page component styles
├── js/
│   ├── global.js           rendering helpers, date/currency pipes, form + validator engine, toasts
│   ├── validation.js       input rules, password policy and field hints (same messages as Angular)
│   ├── support-categories.js  ticket category taxonomy + SLA badge logic
│   ├── data.js             the hardcoded seed data
│   ├── mock-backend.js     answers every /api request locally, persists to localStorage
│   ├── api.js              request layer (latency simulation, session expiry handling)
│   ├── services.js         the Angular services, same method names
│   ├── navigation.js       page links, route guards, the customer shell and the portal shells (sidebars, headers, footers)
│   ├── components/         shared components (dialogs, address list, ticket list, document history, work transfer, ...)
│   └── <page>.js           one script per page
└── assets/
    ├── fonts/              Inter, Outfit, Plus Jakarta Sans
    ├── webfonts/           Font Awesome font files
    └── images/favicon.ico
```

Every HTML page loads the shared CSS and scripts, plus its own page script. It then calls `boot({ route, shell, guards, page })`, which:

1. runs the route guards;
2. renders the page inside the correct shell (the customer header and footer, or a portal sidebar);
3. keeps the page up to date as the data changes.

---

## Pages (Angular route → static file)

Where the Angular route contains an id, the static page takes it as `?id=`. For example, `/orders/12` becomes `order-details.html?id=12`.

**Public**

| Angular route | Static file |
|---|---|
| `/` | `landing.html` |
| `/login` | `login.html` |
| `/register` | `register.html` |
| `/forgot-password` | `forgot-password.html` |
| `/reset-password` | `reset-password.html` |
| `/unavailable` | `unavailable.html` |

**Customer**

| Angular route | Static file |
|---|---|
| `/home` | `home.html` |
| `/add-address` | `add-address.html` |
| `/addresses` | `addresses.html` |
| `/products` | `products.html` |
| `/products/:id` | `product-details.html` |
| `/cart` | `cart.html` |
| `/wishlist` | `wishlist.html` |
| `/checkout` | `checkout.html` |
| `/orders` | `orders.html` |
| `/orders/:id` | `order-details.html` |
| `/logistics` | `logistics.html` |
| `/profile` | `profile.html` |
| `/profile/:id` | `profile-ticket.html` |
| `/support` | `support.html` |
| `/support/:id` | `support-ticket.html` |

**Retailer**

| Angular route | Static file |
|---|---|
| `/retailer/onboarding` | `retailer-onboarding.html` |
| `/retailer/dashboard` | `retailer-dashboard.html` |
| `/retailer/catalogue` | `retailer-catalogue.html` |
| `/retailer/inventory` | `retailer-inventory.html` |
| `/retailer/orders` | `retailer-orders.html` |
| `/retailer/store` | `retailer-store.html` |
| `/retailer/profile` | `retailer-profile.html` |
| `/retailer/finance` | `retailer-finance.html` |
| `/retailer/notifications` | `retailer-notifications.html` |
| `/retailer/support` | `retailer-support.html` |
| `/retailer/support/:id` | `retailer-support-ticket.html` |
| `/retailer/escalations` | `retailer-escalations.html` |

**Fleet**

| Angular route | Static file |
|---|---|
| `/fleet/onboarding` | `fleet-onboarding.html` |
| `/fleet/dashboard` | `fleet-dashboard.html` |
| `/fleet/drivers` | `fleet-drivers.html` |
| `/fleet/vehicles` | `fleet-vehicles.html` |
| `/fleet/assignments` | `fleet-assignments.html` |
| `/fleet/expenses` | `fleet-expenses.html` |
| `/fleet/trips` | `fleet-trips.html` |
| `/fleet/notifications` | `fleet-notifications.html` |
| `/fleet/support` | `fleet-support.html` |
| `/fleet/support/:id` | `fleet-support-ticket.html` |
| `/fleet/escalations` | `fleet-escalations.html` |
| `/fleet/profile` | `fleet-profile.html` |

**Driver**

| Angular route | Static file |
|---|---|
| `/driver/dashboard` | `driver-dashboard.html` |
| `/driver/trips` | `driver-trips.html` |
| `/driver/profile` | `driver-profile.html` |
| `/driver/support` | `driver-support.html` |
| `/driver/support/:id` | `driver-support-ticket.html` |

**Location manager**

| Angular route | Static file |
|---|---|
| `/location/dashboard` | `location-dashboard.html` |
| `/location/notifications` | `location-notifications.html` |
| `/location/queue` | `location-queue.html` |
| `/location/queue/:id` | `location-queue-detail.html` |
| `/location/support` | `location-support.html` |
| `/location/support/:id` | `location-support-ticket.html` |

**Operations manager**

| Angular route | Static file |
|---|---|
| `/operations/dashboard` | `operations-dashboard.html` |
| `/operations/queue` | `operations-queue.html` |
| `/operations/queue/:id` | `operations-queue-detail.html` |
| `/operations/officers` | `operations-officers.html` |
| `/operations/territory` | `operations-territory.html` |
| `/operations/finance` | `operations-finance.html` |
| `/operations/support` | `operations-support.html` |
| `/operations/support/:id` | `operations-support-ticket.html` |
| `/operations/audit` | `operations-audit.html` |

**Super admin**

| Angular route | Static file |
|---|---|
| `/admin/dashboard` | `admin-dashboard.html` |
| `/admin/accounts` | `admin-accounts.html` |
| `/admin/operations-managers` | `admin-operations-managers.html` |
| `/admin/officers` | `admin-officers.html` |
| `/admin/states` | `admin-states.html` |
| `/admin/territory` | `admin-territory.html` |
| `/admin/queue` | `admin-queue.html` |
| `/admin/queue/:id` | `admin-queue-detail.html` |
| `/admin/finance` | `admin-finance.html` |
| `/admin/support` | `admin-support.html` |
| `/admin/support/:id` | `admin-support-ticket.html` |
| `/admin/audit` | `admin-audit.html` |

**Support staff**

| Angular route | Static file |
|---|---|
| `/support-staff/dashboard` | `support-staff-dashboard.html` |
| `/support-staff/support` | `support-staff-support.html` |
| `/support-staff/support/:id` | `support-staff-support-ticket.html` |

Two Angular components are not reachable from any route or template in the Angular app, so they have no static page:

* `features/cart/cart-address-selector`
* `features/location/territory`

---

## Simulated backend and `localStorage`

`js/mock-backend.js` implements every endpoint the Angular services call. It covers:

* **Accounts and places:** auth, users, states, cities, zones, managers.
* **Partners and verification:** retailers, fleet owners, verification queues and documents.
* **Shopping and orders:** catalogue and inventory, bulk upload, cart, wishlist, addresses, checkout, reviews, orders, tracking.
* **Fleet:** trips, logistics bookings and rates, drivers, vehicles, assignments, expenses.
* **Finance, support and reporting:** payments, settlements, refunds, tax rules, notifications, support tickets, audit log, analytics.

It applies the same business rules the backend enforces, such as ownership checks, status transitions, validation messages and stock checks.

| `localStorage` key | Purpose |
|---|---|
| `aroundu.static.db` | The whole simulated database (seed data + every change you make) |
| `aroundu.session` | The signed-in user (same key as the Angular app) |
| `aroundu.myOrderIds`, `aroundu.myDriverIds`, `aroundu.myVehicleIds` | Same "remembered ids" the Angular services keep |
| `aroundu.sidebarCollapsed` | Collapsed / expanded portal sidebar |

Mutations take about 250 ms, as a network round-trip would, so the loading spinners and disabled buttons behave as they do in the Angular app.

Uploaded files (documents, images, bulk-upload spreadsheets) are read in the browser and stored in the simulated database.

**To reset the demo data**, do either of the following:

* clear the site's `localStorage` in the browser's developer tools;
* run `MockBackend.reset()` in the developer-tools console.

---

## Differences you may notice

* Order numbers, ticket numbers and trip numbers are generated from the current time, as in Angular, so they differ between runs.
* Downloads that the real backend generates (bulk-upload templates, rejected-product reports, document files) are generated in the browser:
  * spreadsheets are CSV or Excel-compatible XML;
  * seeded documents are small placeholder PDFs.
* Emails (password reset, notifications to other users) are not sent. Their effects are recorded in the simulated database.

---

## How it was verified

The Angular production build and this static copy were loaded side by side in Chromium.

**Setup**

* Both were given the same session and the same data.
* The Angular app's API calls were answered by the same mock backend.

**What was compared**

* 190 page states were screenshotted and compared pixel by pixel, at desktop (1440 × 900) and at mobile (390 × 844). They covered every page, plus:
  * validation errors and tabs;
  * dropdowns, dialogs and popups;
  * bulk-upload conflict, result and rejection-log dialogs;
  * work-transfer popups;
  * order, ticket, refund, verification, dispatch and delivery-proof flows.

**Results**

* All screenshots match exactly, except where the screen shows a value created at that moment:
  * order and booking numbers, which are generated from the current time;
  * the time printed on a new ticket message.
* One further case differs only because of the test harness, not the static copy. The harness cannot hand Angular a real file, so for the fleet expense-proof preview Angular shows "Preview is not available". The static copy shows the stored proof.

**Other checks**

* All 80 pages were opened as a suitable user, at both sizes, over HTTP and straight from disk (`file://`).
  * None had script errors, console errors, failed or 404 requests, or broken internal links.
* Some pages scroll sideways at 390 px:
  * the customer pages, because of the header's address picker;
  * the finance pages, because of the tab row.
  * The Angular app scrolls sideways by exactly the same amounts on the same pages, so the copy keeps this.
* Tested flows:
  * sign-in, registration followed by sign-in with the new account, and sign-out;
  * the session-expiry redirect;
  * the route guards: signed-out visitor, wrong role, missing delivery address, unverified retailer, signed-in visitor on the landing page.
