/*
 * Navigation for the static frontend: the Angular routes (app.routes.ts) mapped to one HTML file per
 * route, the route guards, and the layout shells every portal page is rendered inside
 * (layout/shell, retailer-shell, location-shell, operations-shell, fleet-shell, driver-shell,
 * admin-shell, support-staff-shell).
 *
 *   Nav.href('/orders/12')          -> 'order-details.html?id=12'
 *   Nav.go('/login', { a: 1 })      -> navigates (router.navigate)
 *   Page.boot({...})                -> guards + shell + page component, mounted into <app-root>
 */
(function () {
  'use strict';

  const html = U.html;

  /* --------------------------------------------------------------------------------------------- */
  /* routes: Angular path -> static file                                                           */
  /* --------------------------------------------------------------------------------------------- */

  const DETAIL_ROUTES = [
    [/^\/products\/([^/]+)$/, 'product-details'],
    [/^\/orders\/([^/]+)$/, 'order-details'],
    [/^\/support\/([^/]+)$/, 'support-ticket'],
    [/^\/profile\/([^/]+)$/, 'profile-ticket'],
    [/^\/(retailer|location|operations|fleet|driver|admin|support-staff)\/support\/([^/]+)$/, '$1-support-ticket'],
    [/^\/(location|operations|admin)\/queue\/([^/]+)$/, '$1-queue-detail'],
  ];
  const PORTAL_DEFAULTS = {
    retailer: 'dashboard', location: 'dashboard', operations: 'dashboard', fleet: 'dashboard', driver: 'dashboard', admin: 'dashboard', 'support-staff': 'dashboard',
  };

  function fileFor(path) {
    const clean = ('/' + String(path || '').replace(/^\/+/, '')).replace(/\/+$/, '') || '/';
    if (clean === '/') return { file: 'landing.html', query: {} };
    for (const [regex, name] of DETAIL_ROUTES) {
      const m = regex.exec(clean);
      if (m) {
        const portal = m.length > 2 ? m[1] : null;
        const id = m.length > 2 ? m[2] : m[1];
        return { file: name.replace('$1', portal) + '.html', query: { id: decodeURIComponent(id) } };
      }
    }
    const segments = clean.slice(1).split('/');
    if (segments.length === 1 && PORTAL_DEFAULTS[segments[0]]) segments.push(PORTAL_DEFAULTS[segments[0]]);
    return { file: segments.join('-') + '.html', query: {} };
  }

  const Nav = (window.Nav = {
    current: '/',
    href(path, query) {
      const [p, qs] = String(path).split('?');
      const target = fileFor(p);
      const params = new URLSearchParams(qs || '');
      Object.entries(target.query).forEach(([k, v]) => params.set(k, v));
      Object.entries(query || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) params.set(k, String(v)); });
      const search = params.toString();
      return target.file + (search ? '?' + search : '');
    },
    go(path, query) {
      if (Nav.sessionExpired) return;
      window.location.href = Nav.href(path, query);
    },
    /* routerLinkActive (default, non-exact): active when the current URL is the link path or below it */
    isActive(path) {
      const cur = Nav.current;
      return cur === path || cur.startsWith(path.replace(/\/$/, '') + '/');
    },
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
    guestLanding: () => {
      const role = AuthService.role();
      return role ? RoleLanding.landingRouteFor(role) : true;
    },
    addressRequired: () => {
      if (CustomerZoneService.activeAddress) return true;
      return CustomerZoneService.load().then((address) => (address ? true : '/add-address'));
    },
    retailerProfile: () => RetailerService.resolveMine().then(
      (r) => (r && r.retailerStatus === 'VERIFIED' ? true : '/retailer/onboarding'),
      () => '/retailer/onboarding',
    ),
    fleetOwnerProfile: () => FleetOwnerService.resolveMine().then(
      (o) => (o && o.profileStatus === 'VERIFIED' && o.ownerStatus === 'ACTIVE' ? true : '/fleet/onboarding'),
      () => '/fleet/onboarding',
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
  /* customer shell (layout/shell)                                                                 */
  /* --------------------------------------------------------------------------------------------- */

  const CustomerShell = (window.Shell = {
    state: null,
    init() {
      this.state = U.state({
        accountMenuOpen: false, notificationsOpen: false, notifications: [], clearingNotifications: false, unreadCount: 0,
        addressMenuOpen: false, myAddresses: [], switchingAddress: false,
      });
      this.currentYear = new Date().getFullYear();
      CartService.get().catch(() => {});
      this.loadNotifications();
      if (!CustomerZoneService.activeAddress) CustomerZoneService.load();
      U.onEscape(() => this.closeAccountMenu());
    },
    toggleAddressMenu() {
      const s = this.state;
      const opening = !s.addressMenuOpen;
      s.addressMenuOpen = opening;
      s.accountMenuOpen = false;
      s.notificationsOpen = false;
      if (opening) AddressService.list(0, 20).then((page) => { s.myAddresses = page.items; }, () => {});
    },
    selectAddress(id) {
      const s = this.state;
      const address = s.myAddresses.find((a) => a.id === id);
      const active = CustomerZoneService.activeAddress;
      if (address.id === (active && active.id)) { s.addressMenuOpen = false; return; }
      if (CartService.itemCount > 0) {
        Toast.open("You can't switch your delivery address while your cart contains items. Please clear your cart before changing the address.", 'Dismiss', { duration: 4500 });
        s.addressMenuOpen = false;
        return;
      }
      s.switchingAddress = true;
      CustomerZoneService.setActive(address).then(
        () => { s.switchingAddress = false; s.addressMenuOpen = false; if (window.Page && Page.onActiveAddressChange) Page.onActiveAddressChange(); },
        () => { s.switchingAddress = false; },
      );
    },
    addressLabel() {
      const address = CustomerZoneService.activeAddress;
      if (!address) return 'Add delivery address';
      return `${address.line1}, ${address.zoneName ?? address.cityName}`;
    },
    loadNotifications() {
      NotificationService.popup().then((popup) => { this.state.notifications = popup.items; this.state.unreadCount = popup.unreadCount; }, () => {});
    },
    clearNotifications() {
      const s = this.state;
      if (s.clearingNotifications || s.unreadCount === 0) return;
      s.clearingNotifications = true;
      NotificationService.clearMine().then(() => { s.clearingNotifications = false; s.notifications = []; s.unreadCount = 0; }, () => { s.clearingNotifications = false; });
    },
    toggleNotifications() {
      const s = this.state;
      s.notificationsOpen = !s.notificationsOpen;
      s.accountMenuOpen = false;
      s.addressMenuOpen = false;
    },
    markRead(id) {
      const s = this.state;
      const n = s.notifications.find((x) => x.notificationId === id);
      if (!n || n.read) return;
      NotificationService.markRead(id).then(() => {
        s.notifications = s.notifications.filter((x) => x.notificationId !== id);
        s.unreadCount = Math.max(0, s.unreadCount - 1);
      }, () => {});
    },
    toggleAccountMenu() {
      const s = this.state;
      s.accountMenuOpen = !s.accountMenuOpen;
      s.notificationsOpen = false;
      s.addressMenuOpen = false;
    },
    closeAccountMenu() {
      const s = this.state;
      s.accountMenuOpen = false;
      s.notificationsOpen = false;
      s.addressMenuOpen = false;
    },
    logout() {
      this.closeAccountMenu();
      AuthService.logout();
      Nav.go('/login');
    },
    render(outlet) {
      const s = this.state;
      const active = CustomerZoneService.activeAddress;
      const navPill = (path, icon, label) => html`
        <a href="${Nav.href(path)}" class="${U.cls('nav-pill', { active: Nav.isActive(path) })}">
          <i class="fa-solid ${icon} text-xs opacity-75"></i> ${label}
        </a>`;
      const mobile = (path, icon, label, extra) => html`
        <a href="${Nav.href(path)}" class="${U.cls('flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs text-slate-500 no-underline transition-all', extra, { 'text-zepto-600 bg-zepto-50/80 font-bold': Nav.isActive(path) })}">
          <i class="fa-solid ${icon} text-base"></i>
          <span>${label}</span>
          ${path === '/cart' && CartService.itemCount > 0 ? html`
            <span class="absolute top-1 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-zgreen-500 text-[9px] font-bold text-white">
              ${CartService.itemCount}
            </span>` : ''}
        </a>`;
      return html`
<app-shell>
<header class="header-glass sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/70 shadow-sm transition-all duration-300">
  <div class="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3">
    <a href="${Nav.href('/home')}" class="mr-2 flex items-center gap-2.5 no-underline group">
      <span class="brandmark font-display shadow-glow group-hover:scale-105 transition-transform duration-300">A</span>
      <span class="hidden text-xl font-display font-black tracking-tight text-slate-900 sm:inline">Around<span class="bg-gradient-to-r from-zepto-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">U</span></span>
    </a>

    <nav class="hidden md:flex items-center gap-1.5 font-display">
      ${navPill('/home', 'fa-house', 'Home')}
      ${navPill('/products', 'fa-store', 'Retail Commerce')}
      ${navPill('/logistics', 'fa-truck-fast', 'Logistics & Parcel')}
      ${navPill('/orders', 'fa-box', 'Orders')}
    </nav>

    <span class="flex-1"></span>

    <div class="relative">
      <button type="button" class="flex max-w-[240px] items-center gap-2 rounded-full border border-zepto-200/80 bg-zepto-50/80 px-3.5 py-1.5 text-xs font-bold text-zepto-800 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-zepto-100 hover:border-zepto-300 active:scale-95"
        onclick="Shell.toggleAddressMenu(); event.stopPropagation()">
        <i class="fa-solid fa-location-dot text-zepto-600 animate-pulse"></i>
        <span class="truncate">${this.addressLabel()}</span>
        <i class="fa-solid fa-chevron-down text-[10px] text-zepto-500"></i>
      </button>

      ${s.addressMenuOpen ? html`
        <div class="dropdown-panel absolute left-0 sm:right-0 sm:left-auto mt-2 w-80 shadow-2xl border border-slate-100/80 z-50" onclick="event.stopPropagation()">
          <div class="px-4 py-2.5 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100">
            <span>Deliver to</span>
            <i class="fa-solid fa-map-pin text-zepto-500"></i>
          </div>
          ${s.myAddresses.length === 0 ? html`<p class="px-4 py-3 text-sm text-slate-400">No saved addresses yet.</p>` : ''}
          ${U.each(s.myAddresses, (a) => html`
            <button type="button"
              class="${U.cls('flex w-full flex-col items-start gap-0.5 border-b border-slate-50 px-4 py-3 text-left transition-all duration-150 last:border-0 hover:bg-zepto-50/70', { 'bg-zepto-50': a.id === (active && active.id) })}"
              ${U.dis(s.switchingAddress)} onclick="Shell.selectAddress(${U.arg(a.id)})">
              <span class="flex items-center gap-2 text-sm font-bold text-slate-800">
                ${a.addressTag}
                ${a.id === (active && active.id) ? html`<i class="fa-solid fa-circle-check text-xs text-emerald-500"></i>` : ''}
              </span>
              <span class="text-xs text-slate-500 line-clamp-1">${a.line1}, ${a.zoneName ?? a.cityName}</span>
            </button>`)}
          <a href="${Nav.href('/add-address')}" class="flex items-center gap-2 px-4 py-3 text-sm font-bold text-zepto-600 no-underline transition-colors hover:bg-zepto-50" onclick="Shell.state.addressMenuOpen = false">
            <i class="fa-solid fa-circle-plus text-zepto-500"></i> Add new address
          </a>
        </div>` : ''}
    </div>

    <a href="${Nav.href('/support')}" aria-label="Support" class="btn-icon text-slate-600 hover:text-zepto-600">
      <i class="fa-solid fa-headset text-base"></i>
    </a>

    <a href="${Nav.href('/wishlist')}" aria-label="Wishlist" class="btn-icon text-slate-600 hover:text-rose-500">
      <i class="fa-solid fa-heart text-base"></i>
    </a>

    <div class="relative">
      <button type="button" class="btn-icon relative text-slate-600 hover:text-zepto-600" aria-label="Notifications" onclick="Shell.toggleNotifications(); event.stopPropagation()">
        <i class="fa-solid fa-bell text-base"></i>
        ${s.unreadCount > 0 ? html`
          <span class="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm">
            ${s.unreadCount}
          </span>` : ''}
      </button>

      ${s.notificationsOpen ? html`
        <div class="dropdown-panel absolute right-0 mt-2 max-h-96 w-80 overflow-y-auto shadow-2xl border border-slate-100/80 z-50" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Notifications</span>
            ${s.unreadCount > 0 ? html`
              <button type="button" class="clear-notifications text-xs font-bold text-zepto-600 hover:text-zepto-700 disabled:opacity-50" ${U.dis(s.clearingNotifications)} onclick="Shell.clearNotifications()">Clear</button>` : ''}
          </div>
          ${s.notifications.length === 0 ? html`
            <p class="px-4 py-3 text-sm text-slate-400">No new notifications.</p>` : U.each(s.notifications, (n) => html`
              <button type="button"
                class="${U.cls('flex w-full flex-col items-start gap-0.5 border-b border-slate-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-zepto-50/70', { 'bg-zepto-50': !n.read })}"
                onclick="Shell.markRead(${n.notificationId})">
                <span class="text-sm font-bold text-slate-800">${n.title}</span>
                <span class="text-xs text-slate-500">${n.message}</span>
                <span class="mt-1 text-[10px] font-medium text-slate-400">${U.date(n.sentAt, 'medium')}</span>
              </button>`)}
        </div>` : ''}
    </div>

    <a href="${Nav.href('/cart')}" aria-label="Cart" class="btn-icon relative text-slate-600 hover:text-zgreen-600">
      <i class="fa-solid fa-cart-shopping text-base"></i>
      ${CartService.itemCount > 0 ? html`
        <span class="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-white bg-zgreen-500 px-1 text-[10px] font-bold text-white shadow-sm">
          ${CartService.itemCount}
        </span>` : ''}
    </a>

    <div class="relative">
      <button type="button" class="flex items-center gap-2 rounded-full py-1 pl-1 pr-1.5 transition-all duration-200 hover:bg-zepto-50 active:scale-95" aria-label="Account" onclick="Shell.toggleAccountMenu(); event.stopPropagation()">
        <span class="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-zepto-600 to-indigo-600 text-sm font-display font-extrabold text-white shadow-glow">
          ${(AuthService.email() || '').charAt(0).toUpperCase()}
        </span>
      </button>

      ${s.accountMenuOpen ? html`
        <div class="dropdown-panel absolute right-0 mt-2 w-60 shadow-2xl border border-slate-100/80 z-50" onclick="event.stopPropagation()">
          <div class="truncate px-4 py-3 text-xs font-medium text-slate-500 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Signed in as</span>
            <span class="font-bold text-slate-800">${AuthService.email()}</span>
          </div>
          <a href="${Nav.href('/profile')}" class="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline transition-colors hover:bg-zepto-50" onclick="Shell.closeAccountMenu()">
            <i class="fa-solid fa-user-gear w-4 text-zepto-500"></i>
            <span>Profile &amp; Settings</span>
          </a>
          <a href="${Nav.href('/orders')}" class="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline transition-colors hover:bg-zepto-50 md:hidden" onclick="Shell.closeAccountMenu()">
            <i class="fa-solid fa-box w-4 text-zepto-500"></i>
            <span>My Orders</span>
          </a>
          <button type="button" class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 rounded-b-2xl" onclick="Shell.logout()">
            <i class="fa-solid fa-right-from-bracket w-4"></i>
            <span>Log out</span>
          </button>
        </div>` : ''}
    </div>
  </div>
</header>

<main class="mx-auto max-w-[1200px] px-4 pb-24 md:pb-12 pt-6" onclick="Shell.closeAccountMenu()">
  <router-outlet></router-outlet>${outlet}
</main>

<nav class="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around bg-white/90 backdrop-blur-xl border-t border-slate-200/80 px-2 py-2 shadow-2xl">
  ${mobile('/home', 'fa-house', 'Home')}
  ${mobile('/products', 'fa-store', 'Shop')}
  ${mobile('/logistics', 'fa-truck-fast', 'Parcel')}
  ${mobile('/orders', 'fa-box', 'Orders')}
  ${mobile('/cart', 'fa-cart-shopping', 'Cart', 'relative')}
</nav>

<footer class="border-t border-slate-100 px-4 py-6 pb-20 md:pb-6 text-center text-xs font-medium text-slate-400">
  &copy; ${this.currentYear} AroundU &middot; Local Logistics &amp; Hyperlocal Retail Platform
</footer>
</app-shell>`;
    },
  });

  /* --------------------------------------------------------------------------------------------- */
  /* portal shells (retailer / location / operations / fleet / driver / admin / support-staff)     */
  /* --------------------------------------------------------------------------------------------- */

  const PORTALS = {
    retailer: {
      tag: 'app-retailer-shell', badge: 'Retailer', title: 'Retailer Portal', footer: 'Retailer Portal', collapsible: true, verificationLink: '/retailer/onboarding',
      navItems: [
        { path: '/retailer/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
        { path: '/retailer/catalogue', label: 'Catalogue', icon: 'fa-book-open' },
        { path: '/retailer/inventory', label: 'Inventory', icon: 'fa-boxes-stacked' },
        { path: '/retailer/orders', label: 'Orders', icon: 'fa-receipt' },
        { path: '/retailer/finance', label: 'Finance', icon: 'fa-sack-dollar' },
        { path: '/retailer/escalations', label: 'Escalations', icon: 'fa-triangle-exclamation' },
        { path: '/retailer/notifications', label: 'Notifications', icon: 'fa-bell' },
        { path: '/retailer/support', label: 'Support', icon: 'fa-headset' },
        { path: '/retailer/store', label: 'Store', icon: 'fa-store' },
        { path: '/retailer/profile', label: 'Profile', icon: 'fa-id-card' },
        { path: '/retailer/onboarding', label: 'Onboarding', icon: 'fa-clipboard-check' },
      ],
    },
    fleet: {
      tag: 'app-fleet-shell', badge: 'Fleet', title: 'Fleet Portal', footer: 'Fleet Portal', collapsible: true, verificationLink: '/fleet/onboarding', territory: 'fleet',
      navItems: [
        { path: '/fleet/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
        { path: '/fleet/assignments', label: 'Assignments', icon: 'fa-clipboard-list' },
        { path: '/fleet/drivers', label: 'Drivers', icon: 'fa-id-card-clip' },
        { path: '/fleet/expenses', label: 'Expenses', icon: 'fa-money-bill-wave' },
        { path: '/fleet/escalations', label: 'Escalations', icon: 'fa-triangle-exclamation' },
        { path: '/fleet/notifications', label: 'Notifications', icon: 'fa-bell' },
        { path: '/fleet/onboarding', label: 'Onboarding', icon: 'fa-clipboard-check' },
        { path: '/fleet/trips', label: 'Trips', icon: 'fa-route' },
        { path: '/fleet/vehicles', label: 'Vehicles', icon: 'fa-truck' },
        { path: '/fleet/profile', label: 'Profile', icon: 'fa-id-card' },
      ],
    },
    location: {
      tag: 'app-location-shell', badge: 'Location', title: 'Location Manager', footer: 'Location Manager Portal', collapsible: true, territory: 'location',
      navItems: [
        { path: '/location/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
        { path: '/location/queue', label: 'Verification Queue', icon: 'fa-clipboard-check' },
        { path: '/location/notifications', label: 'Notifications', icon: 'fa-bell' },
        { path: '/location/support', label: 'Support', icon: 'fa-headset' },
      ],
    },
    operations: {
      tag: 'app-operations-shell', badge: 'Ops', title: 'Operations Console', footer: 'Operations Console', collapsible: true,
      navItems: [
        { path: '/operations/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
        { path: '/operations/queue', label: 'Verification', icon: 'fa-clipboard-check' },
        { path: '/operations/officers', label: 'Officers', icon: 'fa-id-card-clip' },
        { path: '/operations/territory', label: 'Territory', icon: 'fa-map-location-dot' },
        { path: '/operations/finance', label: 'Finance', icon: 'fa-sack-dollar' },
        { path: '/operations/support', label: 'Support', icon: 'fa-headset' },
        { path: '/operations/audit', label: 'Audit', icon: 'fa-clipboard-list' },
      ],
    },
    admin: {
      tag: 'app-admin-shell', badge: 'Admin', title: 'Admin Console', footer: 'Admin Console', collapsible: true,
      navItems: [
        { path: '/admin/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
        { path: '/admin/accounts', label: 'Accounts', icon: 'fa-users' },
        { path: '/admin/operations-managers', label: 'Ops Managers', icon: 'fa-user-tie' },
        { path: '/admin/officers', label: 'Officers', icon: 'fa-user-shield' },
        { path: '/admin/states', label: 'States', icon: 'fa-map' },
        { path: '/admin/territory', label: 'Territory', icon: 'fa-map-location-dot' },
        { path: '/admin/queue', label: 'Verification', icon: 'fa-clipboard-check' },
        { path: '/admin/finance', label: 'Finance', icon: 'fa-sack-dollar' },
        { path: '/admin/support', label: 'Support', icon: 'fa-headset' },
        { path: '/admin/audit', label: 'Audit', icon: 'fa-list-check' },
      ],
    },
    driver: {
      tag: 'app-driver-shell', badge: 'Driver', title: 'Driver Console', footer: 'Driver Portal', collapsible: true,
      navItems: [
        { path: '/driver/dashboard', label: 'Active Delivery', icon: 'fa-motorcycle' },
        { path: '/driver/trips', label: 'Earnings & Trips', icon: 'fa-wallet' },
        { path: '/driver/support', label: 'Support', icon: 'fa-headset' },
        { path: '/driver/profile', label: 'Profile', icon: 'fa-id-card' },
      ],
    },
    'support-staff': {
      tag: 'app-support-staff-shell', badge: 'Support', title: 'Support Staff', footer: 'Support Portal', collapsible: false,
      navItems: [
        { path: '/support-staff/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
        { path: '/support-staff/support', label: 'Ticket Queue', icon: 'fa-headset' },
      ],
    },
  };

  const PortalShell = (window.PortalShell = {
    config: null,
    state: null,
    init(portal) {
      this.config = PORTALS[portal];
      this.state = U.state({
        sidebarOpen: false,
        accountMenuOpen: false,
        collapsed: this.config.collapsible ? localStorage.getItem('aroundu.sidebarCollapsed') === 'true' : false,
        myTerritory: null,
      });
      this.currentYear = new Date().getFullYear();
      if (this.config.territory === 'location') {
        LocationManagerAssignmentService.mine().then((mine) => { this.state.myTerritory = `${mine.cityName ?? 'Unknown city'} · ${mine.zoneName ?? 'Unknown zone'}`; }, () => {});
      }
      if (this.config.territory === 'fleet') {
        FleetOwnerService.resolveMine().then((owner) => {
          if (!owner || !owner.cityId) return;
          TerritoryService.cities().then((cityPage) => {
            const city = cityPage.content.find((c) => c.id === owner.cityId);
            const cityName = city ? city.cityName : 'Unknown city';
            if (!owner.zoneId) { this.state.myTerritory = cityName; return; }
            TerritoryService.zones(owner.cityId).then((zonePage) => {
              const zone = zonePage.content.find((z) => z.zoneId === owner.zoneId);
              this.state.myTerritory = `${cityName} · ${zone ? zone.zoneName : 'Unknown zone'}`;
            }, () => { this.state.myTerritory = cityName; });
          }, () => {});
        }, () => {});
      }
    },
    toggleSidebar() { this.state.sidebarOpen = !this.state.sidebarOpen; },
    toggleCollapsed() {
      const next = !this.state.collapsed;
      this.state.collapsed = next;
      localStorage.setItem('aroundu.sidebarCollapsed', String(next));
    },
    closeSidebar() { this.state.sidebarOpen = false; },
    toggleAccountMenu() { this.state.accountMenuOpen = !this.state.accountMenuOpen; },
    logout() {
      AuthService.logout();
      Nav.go('/login');
    },
    render(outlet) {
      const c = this.config;
      const s = this.state;
      const collapsed = s.collapsed;
      if (!c.collapsible) return this.renderFixed(outlet);
      return html`
${U.raw('<' + c.tag + '>')}
<div class="min-h-screen bg-slate-50 flex">
  ${s.sidebarOpen ? html`<div class="fixed inset-0 bg-black/40 z-30 lg:hidden" onclick="PortalShell.closeSidebar()"></div>` : ''}

  <aside class="${U.cls('fixed inset-y-0 left-0 z-40 bg-zepto-800 text-zepto-100 flex flex-col transform transition-all duration-200 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen', { '-translate-x-full': !s.sidebarOpen, 'translate-x-0': s.sidebarOpen, 'w-64': !collapsed, 'w-[72px]': collapsed })}">
    <div class="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
      <span class="brandmark !h-9 !w-9 !rotate-0 !text-base">A</span>
      ${!collapsed ? html`
        <span class="text-white font-bold text-lg">AroundU</span>
        <span class="ml-auto text-[10px] font-semibold uppercase tracking-wide bg-white/10 text-zepto-100 px-2 py-0.5 rounded-full">${c.badge}</span>` : ''}
    </div>

    <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      ${U.each(c.navItems, (item) => html`
        <a href="${Nav.href(item.path)}"
          class="${U.cls('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zepto-100 hover:bg-white/10 transition-colors', { 'justify-center': collapsed, 'bg-gradient-to-r from-zepto-600 to-violet-600 text-white shadow-glow': Nav.isActive(item.path) })}"
          title="${collapsed ? item.label : ''}" onclick="PortalShell.closeSidebar()">
          <i class="fa-solid ${item.icon} w-5 text-center"></i>
          ${!collapsed ? html`<span>${item.label}</span>` : ''}
        </a>`)}
    </nav>

    <div class="px-3 py-2 border-t border-white/10">
      <button type="button" onclick="PortalShell.toggleCollapsed()"
        class="${U.cls('hidden lg:flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-zepto-100 hover:bg-white/10 transition-colors', { 'justify-center': collapsed })}" aria-label="Toggle sidebar width">
        <i class="${U.cls('fa-solid', { 'fa-angles-left': !collapsed, 'fa-angles-right': collapsed })}"></i>
        ${!collapsed ? html`<span>Collapse</span>` : ''}
      </button>
    </div>

    <div class="px-3 py-4 border-t border-white/10">
      <button type="button" onclick="PortalShell.logout()"
        class="${U.cls('flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-zepto-100 hover:bg-white/10 transition-colors', { 'justify-center': collapsed })}" title="${collapsed ? 'Log out' : ''}">
        <i class="fa-solid fa-right-from-bracket w-5 text-center"></i>
        ${!collapsed ? html`<span>Log out</span>` : ''}
      </button>
    </div>
  </aside>

  ${this.renderMain(outlet)}
</div>
${U.raw('</' + c.tag + '>')}`;
    },
    renderFixed(outlet) {
      const c = this.config;
      const s = this.state;
      return html`
${U.raw('<' + c.tag + '>')}
<div class="min-h-screen bg-slate-50 flex">
  ${s.sidebarOpen ? html`<div class="fixed inset-0 bg-black/40 z-30 lg:hidden" onclick="PortalShell.closeSidebar()"></div>` : ''}

  <aside class="${U.cls('fixed inset-y-0 left-0 z-40 w-64 bg-zepto-800 text-zepto-100 flex flex-col transform transition-transform duration-200 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen', { '-translate-x-full': !s.sidebarOpen, 'translate-x-0': s.sidebarOpen })}">
    <div class="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
      <span class="brandmark !h-9 !w-9 !rotate-0 !text-base">A</span>
      <span class="text-white font-bold text-lg">AroundU</span>
      <span class="ml-auto text-[10px] font-semibold uppercase tracking-wide bg-white/10 text-zepto-100 px-2 py-0.5 rounded-full">${c.badge}</span>
    </div>

    <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      ${U.each(c.navItems, (item) => html`
        <a href="${Nav.href(item.path)}"
          class="${U.cls('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zepto-100 hover:bg-white/10 transition-colors', { 'bg-gradient-to-r from-zepto-600 to-violet-600 text-white shadow-glow': Nav.isActive(item.path) })}"
          onclick="PortalShell.closeSidebar()">
          <i class="fa-solid ${item.icon} w-5 text-center"></i>
          <span>${item.label}</span>
        </a>`)}
    </nav>

    <div class="px-3 py-4 border-t border-white/10">
      <button type="button" onclick="PortalShell.logout()" class="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-zepto-100 hover:bg-white/10 transition-colors">
        <i class="fa-solid fa-right-from-bracket w-5 text-center"></i>
        <span>Log out</span>
      </button>
    </div>
  </aside>

  ${this.renderMain(outlet)}
</div>
${U.raw('</' + c.tag + '>')}`;
    },
    renderMain(outlet) {
      const c = this.config;
      const s = this.state;
      return html`
  <div class="flex-1 min-w-0 flex flex-col">
    <header class="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl flex items-center gap-3 px-4 sm:px-6 py-3">
      <button type="button" class="btn-icon lg:hidden" onclick="PortalShell.toggleSidebar()" aria-label="Toggle menu">
        <i class="fa-solid fa-bars"></i>
      </button>
      <span class="font-semibold text-slate-800">${c.title}</span>
      ${c.territory && s.myTerritory ? html`
        <span class="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          <i class="fa-solid fa-map-location-dot text-zepto-600"></i> ${s.myTerritory}
        </span>` : ''}
      <span class="flex-1"></span>

      <div class="relative">
        <button type="button" class="btn-icon" onclick="PortalShell.toggleAccountMenu()" aria-label="Account">
          <i class="fa-solid fa-circle-user text-xl text-zepto-600"></i>
        </button>
        ${s.accountMenuOpen ? html`
          <div class="dropdown-panel absolute right-0 mt-2 w-56 p-1.5 z-30">
            <div class="px-3 py-2 text-xs text-slate-500 truncate">${AuthService.email()}</div>
            ${c.verificationLink ? html`
              <a href="${Nav.href(c.verificationLink)}" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-zepto-50" onclick="PortalShell.state.accountMenuOpen = false">
                <i class="fa-solid fa-shield-halved w-4 text-center"></i>
                <span>Verification status</span>
              </a>` : ''}
            <button type="button" onclick="PortalShell.logout()" class="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-zepto-50">
              <i class="fa-solid fa-right-from-bracket w-4 text-center"></i>
              <span>Log out</span>
            </button>
          </div>` : ''}
      </div>
    </header>

    <main class="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6">
      <router-outlet></router-outlet>${outlet}
    </main>

    <footer class="border-t border-slate-100 px-4 sm:px-6 py-3 text-center text-xs text-slate-400">
      &copy; ${this.currentYear} AroundU &middot; ${c.footer}
    </footer>
  </div>`;
    },
  });

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
    const guards = [];
    if (config.shell !== 'none') guards.push(Guards.role(PORTAL_OF_SHELL[config.shell]));
    (config.guards || []).forEach((g) => guards.push(g));
    const root = document.querySelector('app-root');
    runGuards(guards).then((result) => {
      if (Nav.sessionExpired) return; // the session-expiry redirect to the login page is already under way
      if (result !== true) {
        window.location.replace(Nav.href(result));
        return;
      }
      const page = config.page;
      window.Page = page;
      if (config.shell === 'customer') CustomerShell.init();
      else if (config.shell !== 'none') PortalShell.init(config.shell);
      if (page.init) page.init();
      const outlet = () => html`${U.raw('<' + page.tag + '>')}${page.render()}${U.raw('</' + page.tag + '>')}`;
      App.mount(root, () => {
        let body;
        if (config.shell === 'customer') body = CustomerShell.render(outlet());
        else if (config.shell !== 'none') body = PortalShell.render(outlet());
        else body = outlet();
        return html`<router-outlet></router-outlet>${body}<app-toast>${Toast.render()}</app-toast>`;
      });
      if (page.afterMount) page.afterMount();
    });
  };
})();
