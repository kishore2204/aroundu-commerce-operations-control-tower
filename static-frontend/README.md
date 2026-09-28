# AroundU – static frontend

This folder is a **static copy of the Angular frontend** in `../frontend`, built with plain HTML, CSS and vanilla
JavaScript. It reproduces the Angular pages' layout, styling, text, validation messages, popups, tables, forms,
dropdowns and flows. The desktop view was compared screenshot by screenshot with the Angular build.

| | |
|---|---|
| **HTML** | the page structure: every page's markup is in its `.html` file |
| **CSS** | styling: shared design system and components in `common/`, page styles next to the page |
| **JS** | behaviour: state, events, validation, data, and the values that change on screen |

* **No Angular, no TypeScript, no build step.** Open a page and it works, from disk or from any static web server.
* **No backend.** There are no REST calls, no microservices, no database and no real authentication server.
  Every request the Angular services would send is answered in the browser from hardcoded data (`common/data/`).
* **All data is hardcoded.** The data is the platform's seed data (`../seed-data`), compiled into `common/data/data.js`.
* **`localStorage` is used for simulation.** Logins, carts, orders, tickets, approvals and profile edits are kept in the
  browser, so they survive page reloads and are shared by all the role folders.
* **Desktop first.** The desktop layout is the reference. The Angular app's responsive classes are kept as they are, but
  mobile and tablet layouts were not re-verified.

Two changes from the Angular app were made on request:

* **Retailer bulk product upload is removed.** The catalogue keeps the normal single-product form (fields, validation,
  category, product images, edit, duplicate, delete).
* **Retailer profile is read-only until Edit.** All profile fields are always shown but disabled. **Edit** enables them.
  **Save changes** stays disabled until a field actually differs from the saved profile. Saving stores the change locally,
  then disables the fields and the Save button again.

The Angular project itself was not modified.

---

## Start page

Open **`customer/commerce/html/landing.html`**. It is the public home page, the Angular route `/`.
`index.html` in this folder only forwards to it.

```
cd static-frontend
python -m http.server 8080        # optional; then open http://localhost:8080/customer/commerce/html/landing.html
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

* Everyone signs in on `customer/commerce/html/login.html`, the single `/login` page of the Angular app. The session is
  stored under `aroundu.session` (the same key as the Angular app) and the role's dashboard opens.
* Registering creates a new customer account, which can then log in. Logging out removes the session.
* Route guards behave as in Angular:
  * a signed-out visitor who opens a protected page is sent to the login page;
  * a signed-in user who opens another role's page sees `unavailable.html`;
  * a customer without a delivery address is sent to `add-address.html`;
  * an unverified retailer or fleet owner is sent to their onboarding page.

---

## Folder structure

```
static-frontend/
├── index.html                    forwards to customer/commerce/html/landing.html
├── assets/images/favicon.ico
├── common/                       everything used by more than one role, one folder per component / function
├── customer/
│   ├── commerce/                 public pages (landing, login, register, password reset) + the shop
│   │   ├── html/  css/  js/      one file per page
│   │   └── components/           components only the commerce pages use (product card, address list ...)
│   └── logistics/                parcel booking
├── retailer/        html/ css/ js/
├── fleet-owner/     html/ css/ js/
├── driver/          html/ css/ js/
├── support-executive/  location-manager/  operational-manager/  admin/     html/ css/ js/
```

**Role folders** belong to the role's owner. `<role>/html/<page>.html`, `<role>/css/<page>.css` and `<role>/js/<page>.js`
are that role's pages. Portal roles also have `<role>/js/<role>-shell.js`, the role's part of the portal layout: host
element, badge, titles and sidebar navigation (Angular `layout/<role>-shell`).

A page used by several roles is one Angular component, for example the ticket detail or the verification queue.
Its code lives once in `common/<component>/`, and each role has its own `.html` page for it.

**`common/`**

| Folder | What it holds |
|---|---|
| `core/` | The small runtime:<br>• `template.js`: HTML escaping and whitespace, as the Angular compiler does it<br>• `templates.js`: reads the page's markup<br>• `dom-morph.js`, `app.js`: in-place updates / change detection<br>• `pipes.js`: dates, currency<br>• `forms.js`: reactive forms and validators<br>• `input-directives.js`<br>• `helpers.js`<br>• `storage.js` |
| `navigation/` | Route → page map across all role folders, route guards, role landing pages, `boot()` |
| `data/` | The hardcoded data, the in-browser data store that applies the business rules, the call layer |
| `services/` | The Angular services, one file each (same names and methods), answered locally |
| `validation/`, `support-tickets/` | Input rules and messages; support ticket categories and SLA badge |
| `fonts/`, `icons/`, `base/` | Web fonts, Font Awesome icons (both embedded), reset and page-wide base styles |
| `utilities/` | The Tailwind utility classes still used as such (switched by the JS, or next to a shared class), once for the whole site: `utilities.css`, and `variants.css` for their hover / focus / responsive versions. |
| `buttons/`, `cards/`, `badges/`, `forms/`, `spinner/`, `brandmark/`, `dropdown/`, `table/`, `page/`, `animations/` | The design system of `src/styles.scss`, one file per component |
| `customer-shell/`, `header/`, `bottom-nav/`, `footer/` | Customer layout (used by `customer/commerce` and `customer/logistics`) |
| `portal-shell/`, `sidebar/`, `portal-header/`, `portal-footer/` | Portal layout of the other roles |
| `toast/`, `confirm-dialog/`, `empty-state/`, `field-hint/`, `password-requirements/`, `my-tickets/`, `document-history/`, `work-transfer/`, `entity-ticket-queue/` | Shared components |
| `ticket-detail/`, `notifications/`, `user-support/`, `operations-support/`, `queue-list/`, `queue-detail/`, `officers/`, `operations-territory/`, `operations-finance/`, `operations-audit/` | Pages shared by several roles |

A component folder holds its `.html` (markup), `.css` (styles, if it has any of its own) and `.js` (behaviour).

---

## How a page is put together

**HTML - the structure.** Each page is a complete document:

* `<app-root>` contains the page's structure, written out: the layout (header or sidebar, footer) and the page itself.
  Each part is marked by `<!--tpl:name (source)-->` … `<!--/tpl:name-->`.
* Parts that appear only in some states, or once per item, are `<template id="…">` elements placed where they appear:
  * a loading spinner, an error message or a dialog;
  * a table row, a list entry or a dropdown option.
* After `</app-root>` come the templates of the shared components the page uses. Each is a copy of
  `common/<component>/<component>.html`, between `<!-- BEGIN … -->` and `<!-- END … -->` comments. A page opened from disk
  cannot include another HTML file, so the markup is copied. **When you change a shared component's markup, update its
  `.html` in `common/` and the copies**; search for its BEGIN comment to find them.
* The places the JavaScript fills in are marked `<!--{{0}}-->` (content) and `{{0}}` (inside a tag).

**JS - the behaviour.** A page's `.js` holds its state, event handlers, validation and data calls. Where the screen
changes, it supplies only the values. For example, `U.tpl('catalogue-4-3-1', [p.id, p.name, …])` renders the
catalogue's product row from its `<template id="catalogue-4-3-1">` with those values. No script contains markup.
`boot()` in each page runs the route guards, reads the page's markup and renders the page. After every change, only the
parts of the page that differ are updated.

**CSS - the styling.** The stylesheets load in the same order as the Angular build's single stylesheet, so every rule wins
exactly where it won in Angular:

1. `fonts`, `icons`, `base`;
2. the design-system components (`buttons`, `cards`, `badges`, `forms/form-controls` …);
3. `utilities/utilities.css`;
4. the plain `styles.scss` classes (`page`, `cards/card-surface`, `forms/form-layout`, `table`, `animations`);
5. `utilities/variants.css`;
6. the layout and component stylesheets;
7. the page's own stylesheet: its named classes, then the Angular component's own CSS, if it has any.

**Every page has its own stylesheet with real rules.** The Angular templates style their elements with Tailwind utility
classes. Here each combination of them is one named class in the page's CSS file, for example `.cart-title`,
`.catalogue-cell`, `.dashboard-heading`. The name is the page (or component) and the kind of element, numbered when a
page has several. A class has exactly the declarations of the utilities it replaces: same values, same order, same
hover / focus / responsive variants. The shared layout (header, sidebar, footers, bottom navigation) does the same, for
example `.sidebar-link`, `.sidebar-link--active` and `.header-address-button`.

Components have their own stylesheets too (`common/<component>/<component>.css`,
`customer/commerce/components/<component>/<component>.css`). Four pages only host one component and have no
stylesheet of their own: the address book and support pages of the customer, and the escalation pages of the retailer
and the fleet owner.

A few utility classes stay as they are, in `common/utilities/` (`utilities.css`, `variants.css`):

* those the JavaScript switches on and off (active tab, selected row, status colours);
* those next to a shared class that must keep winning, as in the Angular build (for example `.card` sets the padding,
  so `card p-4` keeps its `p-4`).

---

## Pages

Where the Angular route contains an id, the page takes it as `?id=`. For example, `/orders/12` becomes
`customer/commerce/html/order-detail.html?id=12`.

**Customer - Commerce** - `customer/commerce/html/`

| Page | Angular route | Angular component | Page code |
|---|---|---|---|
| `landing.html` | `/` | `landing.component` | `customer/commerce/js/landing.js` |
| `login.html` | `/login` | `login.component` | `customer/commerce/js/login.js` |
| `register.html` | `/register` | `register.component` | `customer/commerce/js/register.js` |
| `forgot-password.html` | `/forgot-password` | `forgot-password.component` | `customer/commerce/js/forgot-password.js` |
| `reset-password.html` | `/reset-password` | `reset-password.component` | `customer/commerce/js/reset-password.js` |
| `unavailable.html` | `/unavailable` | `unavailable.component` | `customer/commerce/js/unavailable.js` |
| `add-address.html` | `/add-address` | `add-address.component` | `customer/commerce/js/add-address.js` |
| `home.html` | `/home` | `home.component` | `customer/commerce/js/home.js` |
| `product-list.html` | `/products` | `product-list.component` | `customer/commerce/js/product-list.js` |
| `product-detail.html` | `/products/:id` | `product-detail.component` | `customer/commerce/js/product-detail.js` |
| `cart.html` | `/cart` | `cart.component` | `customer/commerce/js/cart.js` |
| `wishlist.html` | `/wishlist` | `wishlist.component` | `customer/commerce/js/wishlist.js` |
| `address-list.html` | `/addresses` | `address-list.component` | `customer/commerce/js/address-list.js` |
| `checkout.html` | `/checkout` | `checkout.component` | `customer/commerce/js/checkout.js` |
| `order-list.html` | `/orders` | `order-list.component` | `customer/commerce/js/order-list.js` |
| `order-detail.html` | `/orders/:id` | `order-detail.component` | `customer/commerce/js/order-detail.js` |
| `profile.html` | `/profile` | `profile.component` | `customer/commerce/js/profile.js` |
| `customer-support.html` | `/support` | `customer-support.component` | `customer/commerce/js/customer-support.js` |
| `ticket-detail.html` | `/support/:id` | `ticket-detail.component` | `common/ticket-detail/` |
| `profile-ticket-detail.html` | `/profile/:id` | `ticket-detail.component` | `common/ticket-detail/` |

**Customer - Logistics** - `customer/logistics/html/`

| Page | Angular route | Angular component | Page code |
|---|---|---|---|
| `logistics-booking.html` | `/logistics` | `logistics-booking.component` | `customer/logistics/js/logistics-booking.js` |

**Retailer** - `retailer/html/`

| Page | Angular route | Angular component | Page code |
|---|---|---|---|
| `onboarding.html` | `/retailer/onboarding` | `onboarding.component` | `retailer/js/onboarding.js` |
| `dashboard.html` | `/retailer/dashboard` | `dashboard.component` | `retailer/js/dashboard.js` |
| `catalogue.html` | `/retailer/catalogue` | `catalogue.component` | `retailer/js/catalogue.js` |
| `inventory.html` | `/retailer/inventory` | `inventory.component` | `retailer/js/inventory.js` |
| `orders.html` | `/retailer/orders` | `orders.component` | `retailer/js/orders.js` |
| `store.html` | `/retailer/store` | `store.component` | `retailer/js/store.js` |
| `profile.html` | `/retailer/profile` | `profile.component` | `retailer/js/profile.js` |
| `finance.html` | `/retailer/finance` | `finance.component` | `retailer/js/finance.js` |
| `user-support.html` | `/retailer/support` | `user-support.component` | `common/user-support/` |
| `notifications.html` | `/retailer/notifications` | `notifications.component` | `common/notifications/` |
| `ticket-detail.html` | `/retailer/support/:id` | `ticket-detail.component` | `common/ticket-detail/` |
| `escalations.html` | `/retailer/escalations` | `retailer-escalations.component` | `retailer/js/escalations.js` |

**Fleet Owner** - `fleet-owner/html/`

| Page | Angular route | Angular component | Page code |
|---|---|---|---|
| `onboarding.html` | `/fleet/onboarding` | `onboarding.component` | `fleet-owner/js/onboarding.js` |
| `dashboard.html` | `/fleet/dashboard` | `dashboard.component` | `fleet-owner/js/dashboard.js` |
| `drivers.html` | `/fleet/drivers` | `drivers.component` | `fleet-owner/js/drivers.js` |
| `vehicles.html` | `/fleet/vehicles` | `vehicles.component` | `fleet-owner/js/vehicles.js` |
| `assignments.html` | `/fleet/assignments` | `assignments.component` | `fleet-owner/js/assignments.js` |
| `expenses.html` | `/fleet/expenses` | `expenses.component` | `fleet-owner/js/expenses.js` |
| `trips.html` | `/fleet/trips` | `trips.component` | `fleet-owner/js/trips.js` |
| `notifications.html` | `/fleet/notifications` | `notifications.component` | `common/notifications/` |
| `user-support.html` | `/fleet/support` | `user-support.component` | `common/user-support/` |
| `ticket-detail.html` | `/fleet/support/:id` | `ticket-detail.component` | `common/ticket-detail/` |
| `escalations.html` | `/fleet/escalations` | `fleet-escalations.component` | `fleet-owner/js/escalations.js` |
| `profile.html` | `/fleet/profile` | `profile.component` | `fleet-owner/js/profile.js` |

**Driver** - `driver/html/`

| Page | Angular route | Angular component | Page code |
|---|---|---|---|
| `dashboard.html` | `/driver/dashboard` | `driver-dashboard.component` | `driver/js/dashboard.js` |
| `trips.html` | `/driver/trips` | `driver-trips.component` | `driver/js/trips.js` |
| `profile.html` | `/driver/profile` | `profile.component` | `driver/js/profile.js` |
| `user-support.html` | `/driver/support` | `user-support.component` | `common/user-support/` |
| `ticket-detail.html` | `/driver/support/:id` | `ticket-detail.component` | `common/ticket-detail/` |

**Support Executive** - `support-executive/html/`

| Page | Angular route | Angular component | Page code |
|---|---|---|---|
| `dashboard.html` | `/support-staff/dashboard` | `support-dashboard.component` | `support-executive/js/dashboard.js` |
| `support.html` | `/support-staff/support` | `support.component` | `common/operations-support/` |
| `ticket-detail.html` | `/support-staff/support/:id` | `ticket-detail.component` | `common/ticket-detail/` |

**Location Manager** - `location-manager/html/`

| Page | Angular route | Angular component | Page code |
|---|---|---|---|
| `dashboard.html` | `/location/dashboard` | `dashboard.component` | `location-manager/js/dashboard.js` |
| `notifications.html` | `/location/notifications` | `notifications.component` | `common/notifications/` |
| `queue-list.html` | `/location/queue` | `queue-list.component` | `common/queue-list/` |
| `queue-detail.html` | `/location/queue/:id` | `queue-detail.component` | `common/queue-detail/` |
| `support.html` | `/location/support` | `support.component` | `common/operations-support/` |
| `ticket-detail.html` | `/location/support/:id` | `ticket-detail.component` | `common/ticket-detail/` |

**Operational Manager** - `operational-manager/html/`

| Page | Angular route | Angular component | Page code |
|---|---|---|---|
| `dashboard.html` | `/operations/dashboard` | `dashboard.component` | `operational-manager/js/dashboard.js` |
| `queue-list.html` | `/operations/queue` | `queue-list.component` | `common/queue-list/` |
| `queue-detail.html` | `/operations/queue/:id` | `queue-detail.component` | `common/queue-detail/` |
| `officers.html` | `/operations/officers` | `officers.component` | `common/officers/` |
| `territory.html` | `/operations/territory` | `territory.component` | `common/operations-territory/` |
| `finance.html` | `/operations/finance` | `finance.component` | `common/operations-finance/` |
| `support.html` | `/operations/support` | `support.component` | `common/operations-support/` |
| `ticket-detail.html` | `/operations/support/:id` | `ticket-detail.component` | `common/ticket-detail/` |
| `audit.html` | `/operations/audit` | `audit.component` | `common/operations-audit/` |

**Admin** - `admin/html/`

| Page | Angular route | Angular component | Page code |
|---|---|---|---|
| `dashboard.html` | `/admin/dashboard` | `dashboard.component` | `admin/js/dashboard.js` |
| `accounts.html` | `/admin/accounts` | `accounts.component` | `admin/js/accounts.js` |
| `operations-managers.html` | `/admin/operations-managers` | `operations-managers.component` | `admin/js/operations-managers.js` |
| `officers.html` | `/admin/officers` | `officers.component` | `common/officers/` |
| `states.html` | `/admin/states` | `states.component` | `admin/js/states.js` |
| `territory.html` | `/admin/territory` | `territory.component` | `common/operations-territory/` |
| `queue-list.html` | `/admin/queue` | `queue-list.component` | `common/queue-list/` |
| `queue-detail.html` | `/admin/queue/:id` | `queue-detail.component` | `common/queue-detail/` |
| `finance.html` | `/admin/finance` | `finance.component` | `common/operations-finance/` |
| `support.html` | `/admin/support` | `support.component` | `common/operations-support/` |
| `ticket-detail.html` | `/admin/support/:id` | `ticket-detail.component` | `common/ticket-detail/` |
| `audit.html` | `/admin/audit` | `audit.component` | `common/operations-audit/` |

Angular components that no page renders have no static copy. This holds in the Angular app too:

* `features/cart/cart-address-selector`
* `features/location/territory`
* `shared/terms-dialog` (the register page has its own terms popup)
* `shared/shop-detail-expander` (replaced by the retailer info dialog)

---

## Simulated backend and `localStorage`

`common/data/data-store.js` answers every call the Angular services make, from the hardcoded data. It covers:

* **Accounts and places:** auth, users, states, cities, zones, managers.
* **Partners and verification:** retailers, fleet owners, verification queues and documents.
* **Shopping and orders:** catalogue and inventory, cart, wishlist, addresses, checkout, reviews, orders, tracking.
* **Fleet:** trips, logistics bookings and rates, drivers, vehicles, assignments, expenses.
* **Finance, support and reporting:** payments, settlements, refunds, tax rules, notifications, support tickets, audit log, analytics.

It applies the business rules the real services enforce: ownership checks, status transitions, validation messages
and stock checks. Nothing is sent over the network: there is no `fetch`, no `XMLHttpRequest` and no server.

| `localStorage` key | Purpose |
|---|---|
| `aroundu.static.db` | The whole simulated database (the hardcoded data plus every change you make) |
| `aroundu.session` | The signed-in user (same key as the Angular app) |
| `aroundu.myOrderIds`, `aroundu.myDriverIds`, `aroundu.myVehicleIds` | The same "remembered ids" the Angular services keep |
| `aroundu.sidebarCollapsed` | Collapsed / expanded portal sidebar |
| `aroundu.rev` | When the state last changed, used to tell which copy is newest |

Every role folder reads and writes the same keys, so an order placed as a customer shows up for the retailer.
Saving takes about 250 ms, like a network round-trip, so the loading spinners and disabled buttons behave as in Angular.
Uploaded files (documents, product images, proofs) are read in the browser and stored in the simulated database.

**Pages opened straight from disk.** Chrome and Edge give every `file://` page the same `localStorage`. Other
browsers do not: Firefox, for example, gives each file its own. Without help, the dashboard would not see the session
the login page saved, the cart page would not see what the product page added, and a new order would be missing on its
order page. So `common/core/storage.js` also carries the state from page to page:

* a copy of the whole state is kept in the tab (`window.name`), for browsers that keep it between pages;
* the address of the page being opened carries the session, the other small values and **the changes made to the
  simulated database** (`#aroundu-state=...`). Every page has the hardcoded data, so only what changed travels. The page
  removes it from the address bar as soon as it has read it.

Whichever copy is newest wins when a page opens. Navigating inside the app (links, buttons, log out) carries the state.
Typing an address or using a bookmark starts from what that page last saw. In such a browser, very large uploads are
left out of the address, because browsers limit its length. For the most reliable demo in Firefox, run the folder from
a local web server (see *Start page*); every page then shares one origin and one `localStorage`.

**To reset the demo data**, do either of the following:

* run `MockBackend.reset()` in the developer-tools console;
* clear the site's `localStorage`, then close the tab. The tab keeps its own copy until it is closed.

---

## Differences you may notice

* Order, ticket and trip numbers are generated from the current time, as in Angular, so they differ between runs.
* Document downloads that the real backend generates are produced in the browser; seeded documents are small placeholder PDFs.
* Emails (password reset, notifications to other users) are not sent. Their effects are recorded in the simulated database.

---

## How it was verified (desktop, 1440 × 900)

**Build checks, on every page**

* Every template read back from the page's HTML, the way the browser reads it, renders exactly as the markup did when it
  was still in the JavaScript. That is 6,994 comparisons.
* The copies of each shared component's templates are identical in every page (1,944 copies).
* Every template a page's scripts use is in that page.
* No script outside `common/core/` contains markup.
* Every global a loaded script uses is defined by a script the page loads.

**Against the previous version of this folder**, which had been verified against Angular:

* **Screenshots:** 190 page states were compared, pixels and every element's computed style. They are identical apart from:
  * the requested changes;
  * values generated from the current time;
  * animations caught at a different moment (the pulsing location pin, the landing page's floating shapes);
  * text anti-aliasing noise of a few pixels.
* **Layout states:** every element of the headers, sidebars, footers and menus was also compared with `:hover`, `:active`,
  `:focus` and `:focus-visible` forced on. This covered the menus open, the sidebar collapsed, the fixed sidebar and the
  drawer: 2,868 element-state checks, all identical. So the semantic layout classes style exactly like the utility
  classes they replace.

* **Page stylesheets:** after the utility classes became named classes in the page and component stylesheets, every
  page was compared with the build before that change. Every element had the same computed style, with its ::before,
  ::after and ::placeholder: 11,080 elements on the 80 pages. The same was true with :hover, :focus,
  :focus-visible and :active forced on every interactive or state-styled element: 11,830 forced-state checks.
  The 190 saved page states of the screenshot comparison (dialogs, tabs, validation errors, flows) were compared the
  same way: 188 are identical, 27,937 elements and 30,567 forced-state checks. The other 2 are multi-step flows (a fleet
  dispatch and a driver pickup) that end in a slightly different state from one run to the next, even on the same build.

**Against the Angular app**

* The Angular production build and this folder were loaded side by side in Chromium, with the same session and the same
  data. The Angular app's API calls were answered by the same data store.
* 190 page states were compared pixel by pixel, covering every page plus validation errors, tabs, dropdowns, dialogs,
  popups, work-transfer popups, and the order, ticket, refund, verification, dispatch and delivery-proof flows.
* **179 are identical.** This includes the retailer's new-product and edit-product forms.
* **6 differ on purpose,** because of the requested changes: the catalogue list and its delete confirmation without the
  bulk-upload controls, the three former bulk-upload states, and the read-only retailer profile with its Edit button.
* **3 differ only in a value created at that moment:** two order / booking numbers and one ticket-message time.
* **1 differs because of the test harness:** it cannot hand Angular a real file, so on the fleet expense-proof preview
  Angular shows "Preview is not available".
* **1 differs only in text anti-aliasing:** 138 pixels in the portal sidebar's brand row once the location dashboard is
  scrolled. Positions and computed styles are identical there.

**Other checks**

* **Crawl:** all 80 pages were opened as a suitable user, over HTTP and straight from disk (`file://`). None had script
  errors, console errors, failed or 404 requests, or broken internal links.
* **Walkthrough from disk:** every role signs in through the real login form and clicks through every sidebar or header
  link. It also covers the customer flows, creating a product and the guards (85 checks, all passed).
* **Cross-page flows with different browser storage behaviours:** one `localStorage` for all pages (Chrome, Edge), one
  per folder, one per file, one per file with the tab copy cleared (how Firefox treats pages opened from disk), and
  `localStorage` blocked. Every mode was run end to end:
  * customer: sign in, add to cart, see it in the cart and at checkout, place an order, open the new order from its
    order number, see it in the orders list;
  * retailer: log out, sign in as the retailer, see the customer's new order, create a product, leave and come back;
  * location manager: open a verification request from the queue, open support.

  All pass in every mode.
* **Every button and link:** on each of the 80 pages, signed in as that page's user, the check clicks every button and
  link. It also clicks every item of what a click opens: menus, dialogs, forms, the address picker and the account
  menu. It does this in a browser that gives every file its own storage and clears the tab copy (the Firefox case),
  4,272 clicks in all. No click lost the session or the data. No click ended on the login page, except logging out. No
  click caused a script error.
* **Retailer profile:**
  * Initially: Edit enabled, Save disabled, fields disabled.
  * After Edit: fields enabled, Save still disabled.
  * After a change: Save enabled. Changing the value back disables Save again.
  * After Save: the new value is shown, the fields and Save are disabled, and the value survives a reload.
* **Bulk upload:** no bulk-upload code, text or files remain.
