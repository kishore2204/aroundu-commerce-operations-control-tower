/*
 * Customer header (layout/shell) - brand, main navigation, delivery-address picker, support, wishlist,
 * notifications dropdown, cart badge and the account menu.
 */
(function () {
  'use strict';

  const html = U.html;

  Object.assign(Shell, {
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
    renderHeader() {
      const s = this.state;
      const active = CustomerZoneService.activeAddress;
      const navPill = (path, icon, label) => html`
        <a href="${Nav.href(path)}" class="${U.cls('nav-pill', { active: Nav.isActive(path) })}">
          <i class="fa-solid ${icon} text-xs opacity-75"></i> ${label}
        </a>`;
      return html`
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
</header>`;
    },
  });
})();
