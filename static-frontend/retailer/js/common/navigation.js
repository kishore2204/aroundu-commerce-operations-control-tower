/*
 * Navigation - the Angular routes (app.routes.ts) mapped to the static pages, the route guards
 * (core/auth/*.guard.ts), the role landing pages (core/auth/role-landing.ts) and boot(), which every page
 * calls to run its guards and mount its layout shell and page component into <app-root>.
 *
 * Every page lives in its role's folder (customer/commerce, customer/logistics, retailer, fleet-owner, driver,
 * support-executive, location-manager, operational-manager, admin), so links are built relative to the
 * static-frontend folder:
 *
 *   Nav.href('/orders/12')          -> '../../../customer/commerce/html/order-detail.html?id=12'
 *   Nav.go('/login', { a: 1 })      -> navigates (router.navigate)
 */
(function () {
  'use strict';

  const html = U.html;

  /* --------------------------------------------------------------------------------------------- */
  /* routes: Angular path -> static page (path inside static-frontend)                             */
  /* --------------------------------------------------------------------------------------------- */

  const ROUTES = {
    '/': 'customer/commerce/html/landing.html',
    '/login': 'customer/commerce/html/login.html',
    '/register': 'customer/commerce/html/register.html',
    '/forgot-password': 'customer/commerce/html/forgot-password.html',
    '/reset-password': 'customer/commerce/html/reset-password.html',
    '/unavailable': 'customer/commerce/html/unavailable.html',
    '/add-address': 'customer/commerce/html/add-address.html',
    '/home': 'customer/commerce/html/home.html',
    '/products': 'customer/commerce/html/product-list.html',
    '/products/:id': 'customer/commerce/html/product-detail.html',
    '/cart': 'customer/commerce/html/cart.html',
    '/wishlist': 'customer/commerce/html/wishlist.html',
    '/addresses': 'customer/commerce/html/address-list.html',
    '/checkout': 'customer/commerce/html/checkout.html',
    '/orders': 'customer/commerce/html/order-list.html',
    '/orders/:id': 'customer/commerce/html/order-detail.html',
    '/profile': 'customer/commerce/html/profile.html',
    '/support': 'customer/commerce/html/customer-support.html',
    '/support/:id': 'customer/commerce/html/ticket-detail.html',
    '/profile/:id': 'customer/commerce/html/profile-ticket-detail.html',
    '/logistics': 'customer/logistics/html/logistics-booking.html',
    '/retailer/onboarding': 'retailer/html/onboarding.html',
    '/retailer/dashboard': 'retailer/html/dashboard.html',
    '/retailer/catalogue': 'retailer/html/catalogue.html',
    '/retailer/inventory': 'retailer/html/inventory.html',
    '/retailer/orders': 'retailer/html/orders.html',
    '/retailer/store': 'retailer/html/store.html',
    '/retailer/profile': 'retailer/html/profile.html',
    '/retailer/finance': 'retailer/html/finance.html',
    '/retailer/support': 'retailer/html/user-support.html',
    '/retailer/notifications': 'retailer/html/notifications.html',
    '/retailer/support/:id': 'retailer/html/ticket-detail.html',
    '/retailer/escalations': 'retailer/html/escalations.html',
    '/location/dashboard': 'location-manager/html/dashboard.html',
    '/location/notifications': 'location-manager/html/notifications.html',
    '/location/queue': 'location-manager/html/queue-list.html',
    '/location/queue/:id': 'location-manager/html/queue-detail.html',
    '/location/support': 'location-manager/html/support.html',
    '/location/support/:id': 'location-manager/html/ticket-detail.html',
    '/operations/dashboard': 'operational-manager/html/dashboard.html',
    '/operations/queue': 'operational-manager/html/queue-list.html',
    '/operations/queue/:id': 'operational-manager/html/queue-detail.html',
    '/operations/officers': 'operational-manager/html/officers.html',
    '/operations/territory': 'operational-manager/html/territory.html',
    '/operations/finance': 'operational-manager/html/finance.html',
    '/operations/support': 'operational-manager/html/support.html',
    '/operations/support/:id': 'operational-manager/html/ticket-detail.html',
    '/operations/audit': 'operational-manager/html/audit.html',
    '/fleet/onboarding': 'fleet-owner/html/onboarding.html',
    '/fleet/dashboard': 'fleet-owner/html/dashboard.html',
    '/fleet/drivers': 'fleet-owner/html/drivers.html',
    '/fleet/vehicles': 'fleet-owner/html/vehicles.html',
    '/fleet/assignments': 'fleet-owner/html/assignments.html',
    '/fleet/expenses': 'fleet-owner/html/expenses.html',
    '/fleet/trips': 'fleet-owner/html/trips.html',
    '/fleet/notifications': 'fleet-owner/html/notifications.html',
    '/fleet/support': 'fleet-owner/html/user-support.html',
    '/fleet/support/:id': 'fleet-owner/html/ticket-detail.html',
    '/fleet/escalations': 'fleet-owner/html/escalations.html',
    '/fleet/profile': 'fleet-owner/html/profile.html',
    '/driver/dashboard': 'driver/html/dashboard.html',
    '/driver/trips': 'driver/html/trips.html',
    '/driver/profile': 'driver/html/profile.html',
    '/driver/support': 'driver/html/user-support.html',
    '/driver/support/:id': 'driver/html/ticket-detail.html',
    '/admin/dashboard': 'admin/html/dashboard.html',
    '/admin/accounts': 'admin/html/accounts.html',
    '/admin/operations-managers': 'admin/html/operations-managers.html',
    '/admin/officers': 'admin/html/officers.html',
    '/admin/states': 'admin/html/states.html',
    '/admin/territory': 'admin/html/territory.html',
    '/admin/queue': 'admin/html/queue-list.html',
    '/admin/queue/:id': 'admin/html/queue-detail.html',
    '/admin/finance': 'admin/html/finance.html',
    '/admin/support': 'admin/html/support.html',
    '/admin/support/:id': 'admin/html/ticket-detail.html',
    '/admin/audit': 'admin/html/audit.html',
    '/support-staff/dashboard': 'support-executive/html/dashboard.html',
    '/support-staff/support': 'support-executive/html/support.html',
    '/support-staff/support/:id': 'support-executive/html/ticket-detail.html',
  };
  const PORTAL_DEFAULTS = {
    '/retailer': '/retailer/dashboard', '/location': '/location/dashboard', '/operations': '/operations/dashboard', '/fleet': '/fleet/dashboard',
    '/driver': '/driver/dashboard', '/admin': '/admin/dashboard', '/support-staff': '/support-staff/dashboard',
  };
  const PATTERNS = Object.keys(ROUTES).map((route) => ({
    route,
    regex: new RegExp('^' + route.replace(/:id/, '([^/]+)') + '$'),
  }));

  function fileFor(path) {
    let clean = ('/' + String(path || '').replace(/^\/+/, '')).replace(/\/+$/, '') || '/';
    clean = PORTAL_DEFAULTS[clean] || clean;
    for (const { route, regex } of PATTERNS) {
      const m = regex.exec(clean);
      if (m) return { file: ROUTES[route], query: m[1] !== undefined ? { id: decodeURIComponent(m[1]) } : {} };
    }
    return { file: ROUTES['/'], query: {} };
  }

  /* '../' once for every folder between static-frontend and the page of this route */
  function rootOf(route) {
    return '../'.repeat(ROUTES[route].split('/').length - 1);
  }

  const Nav = (window.Nav = {
    current: '/',
    root: '',
    href(path, query) {
      const [p, qs] = String(path).split('?');
      const target = fileFor(p);
      const params = new URLSearchParams(qs || '');
      Object.entries(target.query).forEach(([k, v]) => params.set(k, v));
      Object.entries(query || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) params.set(k, String(v)); });
      const search = params.toString();
      return Nav.root + target.file + (search ? '?' + search : '');
    },
    go(path, query) {
      if (Nav.sessionExpired) return;
      window.location.href = AppStorage.handoff(Nav.href(path, query));
    },
    /* routerLinkActive (default, non-exact): active when the current URL is the link path or below it */
    isActive(path) {
      const cur = Nav.current;
      return cur === path || cur.startsWith(path.replace(/\/$/, '') + '/');
    },
  });

  /* a link to another page carries the session along (see storage.js) */
  document.addEventListener('click', (event) => {
    const a = event.target.closest && event.target.closest('a[href]');
    if (!a || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = a.getAttribute('href');
    if (a.target || a.hasAttribute('download') || /^[a-z][a-z0-9+.-]*:/i.test(href) || !/\.html(?:[?#]|$)/.test(href)) return;
    event.preventDefault();
    window.location.href = AppStorage.handoff(a.href);
  });

  /* --------------------------------------------------------------------------------------------- */
  /* role landing (core/auth/role-landing.ts)                                                      */
  /* --------------------------------------------------------------------------------------------- */

  window.RoleLanding = {
    queueBasePathFor(role) {
      if (role === 'OPERATIONS_MANAGER') return '/operations/queue';
      if (role === 'SUPER_ADMIN') return '/admin/queue';
      return '/location/queue';
    },
    landingRouteFor(role) {
      return {
        CUSTOMER: '/home', RETAILER: '/retailer/dashboard', LOCATION_MANAGER: '/location/dashboard', OPERATIONS_MANAGER: '/operations/dashboard',
        FLEET_MANAGER: '/fleet/dashboard', DRIVER: '/driver/dashboard', SUPER_ADMIN: '/admin/dashboard', SUPPORT_STAFF: '/support-staff/dashboard',
      }[role] || '/unavailable';
    },
  };

  /* --------------------------------------------------------------------------------------------- */
  /* guards (core/auth/*.guard.ts) - resolve to true, or to the path to redirect to                 */
  /* --------------------------------------------------------------------------------------------- */

  const Guards = {
    auth: () => (AuthService.isAuthenticated() ? true : '/login'),
    role: (...roles) => () => {
      if (!AuthService.isAuthenticated()) return '/login';
      return roles.includes(AuthService.role()) ? true : '/unavailable';
    },
    retailerProfile: () => RetailerService.resolveMine().then(
      (r) => (r && r.retailerStatus === 'VERIFIED' ? true : '/retailer/onboarding'),
      () => '/retailer/onboarding',
    ),
  };
  window.Guards = Guards;

  async function runGuards(guards) {
    for (const guard of guards) {
      const result = await guard();
      if (result !== true) return result;
    }
    return true;
  }

  /* --------------------------------------------------------------------------------------------- */
  /* Page.boot                                                                                     */
  /* --------------------------------------------------------------------------------------------- */

  const PORTAL_OF_SHELL = { retailer: 'RETAILER', location: 'LOCATION_MANAGER', operations: 'OPERATIONS_MANAGER', fleet: 'FLEET_MANAGER', driver: 'DRIVER', admin: 'SUPER_ADMIN', 'support-staff': 'SUPPORT_STAFF', customer: 'CUSTOMER' };

  /*
   * config: {
   *   route:  Angular path of this page, e.g. '/orders/:id'
   *   shell:  'none' | 'customer' | 'retailer' | 'location' | 'operations' | 'fleet' | 'driver' | 'admin' | 'support-staff'
   *   guards: extra guards after the shell's auth + role guard (e.g. [Guards.addressRequired])
   *   page:   the page component object (tag, init(), render())
   * }
   */
  window.Page = null;
  window.boot = function (config) {
    const id = U.query('id');
    Nav.current = config.route.replace(':id', id ?? '');
    Nav.root = rootOf(config.route);
    const guards = [];
    if (config.shell !== 'none') guards.push(Guards.role(PORTAL_OF_SHELL[config.shell]));
    (config.guards || []).forEach((g) => guards.push(g));
    const root = document.querySelector('app-root');
    runGuards(guards).then((result) => {
      if (Nav.sessionExpired) return; // the session-expiry redirect to the login page is already under way
      if (result !== true) {
        window.location.replace(AppStorage.handoff(Nav.href(result)));
        return;
      }
      const page = config.page;
      window.Page = page;
      // the page's layout shell (shell.js for customer pages, portal-shell.js for the portals) registers itself as window.Layout
      const layout = config.shell === 'none' ? null : window.Layout;
      if (layout) layout.init(config.shell);
      if (page.init) page.init();
      const outlet = () => html`${U.raw('<' + page.tag + '>')}${page.render()}${U.raw('</' + page.tag + '>')}`;
      App.mount(root, () => {
        const body = layout ? layout.render(outlet()) : outlet();
        return html`<router-outlet></router-outlet>${body}<app-toast>${Toast.render()}</app-toast>`;
      });
      if (page.afterMount) page.afterMount();
    });
  };
})();
