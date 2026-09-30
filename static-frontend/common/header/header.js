/*
 * Customer header (layout/shell) - brand, main navigation, delivery-address picker, support, wishlist,
 * notifications dropdown, cart badge and the account menu.
 */
(function () {
  'use strict';

  Object.assign(Shell, {
    toggleAddressMenu() {
      const s = this.state;
      const opening = !s.addressMenuOpen;
      s.addressMenuOpen = opening;
      s.accountMenuOpen = false;
      s.notificationsOpen = false;
      if (opening)
        AddressService.list(0, 20).then(
          (page) => {
            s.myAddresses = page.items;
          },
          () => {},
        );
    },
    selectAddress(id) {
      const s = this.state;
      const address = s.myAddresses.find((a) => a.id === id);
      const active = CustomerZoneService.activeAddress;
      if (address.id === (active && active.id)) {
        s.addressMenuOpen = false;
        return;
      }
      if (CartService.itemCount > 0) {
        Toast.open(
          "You can't switch your delivery address while your cart contains items. Please clear your cart before changing the address.",
          'Dismiss',
          { duration: 4500 },
        );
        s.addressMenuOpen = false;
        return;
      }
      s.switchingAddress = true;
      CustomerZoneService.setActive(address).then(
        () => {
          s.switchingAddress = false;
          s.addressMenuOpen = false;
          if (window.Page && Page.onActiveAddressChange) Page.onActiveAddressChange();
        },
        () => {
          s.switchingAddress = false;
        },
      );
    },
    addressLabel() {
      const address = CustomerZoneService.activeAddress;
      if (!address) return 'Add delivery address';
      return `${address.line1}, ${address.zoneName ?? address.cityName}`;
    },
    loadNotifications() {
      NotificationService.popup().then(
        (popup) => {
          this.state.notifications = popup.items;
          this.state.unreadCount = popup.unreadCount;
        },
        () => {},
      );
    },
    clearNotifications() {
      const s = this.state;
      if (s.clearingNotifications || s.unreadCount === 0) return;
      s.clearingNotifications = true;
      NotificationService.clearMine().then(
        () => {
          s.clearingNotifications = false;
          s.notifications = [];
          s.unreadCount = 0;
        },
        () => {
          s.clearingNotifications = false;
        },
      );
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
      NotificationService.markRead(id).then(
        () => {
          s.notifications = s.notifications.filter((x) => x.notificationId !== id);
          s.unreadCount = Math.max(0, s.unreadCount - 1);
        },
        () => {},
      );
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
      const navPill = (path, icon, label) =>
        U.tpl('header-nav-pill', [Nav.href(path), U.clsMore({ active: Nav.isActive(path) }), icon, label]);
      return U.tpl('header', [
        Nav.href('/home'),
        navPill('/home', 'fa-house', 'Home'),
        navPill('/products', 'fa-store', 'Retail Commerce'),
        navPill('/logistics', 'fa-truck-fast', 'Logistics & Parcel'),
        navPill('/orders', 'fa-box', 'Orders'),
        this.addressLabel(),
        s.addressMenuOpen
          ? U.tpl('header-1', [
              s.myAddresses.length === 0 ? U.tpl('header-1-1') : '',
              U.each(s.myAddresses, (a) =>
                U.tpl('header-1-2', [
                  U.clsMore({ 'header-address-option--selected': a.id === (active && active.id) }),
                  U.dis(s.switchingAddress),
                  U.arg(a.id),
                  a.addressTag,
                  a.id === (active && active.id) ? U.tpl('header-1-2-1') : '',
                  a.line1,
                  a.zoneName ?? a.cityName,
                ]),
              ),
              Nav.href('/add-address'),
            ])
          : '',
        Nav.href('/support'),
        Nav.href('/wishlist'),
        s.unreadCount > 0 ? U.tpl('header-2', [s.unreadCount]) : '',
        s.notificationsOpen
          ? U.tpl('header-3', [
              s.unreadCount > 0 ? U.tpl('header-3-1', [U.dis(s.clearingNotifications)]) : '',
              s.notifications.length === 0
                ? U.tpl('header-3-2')
                : U.each(s.notifications, (n) =>
                    U.tpl('header-3-3', [
                      U.clsMore({ 'header-notification--unread': !n.read }),
                      n.notificationId,
                      n.title,
                      n.message,
                      U.date(n.sentAt, 'medium'),
                    ]),
                  ),
            ])
          : '',
        Nav.href('/cart'),
        CartService.itemCount > 0 ? U.tpl('header-4', [CartService.itemCount]) : '',
        (AuthService.email() || '').charAt(0).toUpperCase(),
        s.accountMenuOpen ? U.tpl('header-5', [AuthService.email(), Nav.href('/profile'), Nav.href('/orders')]) : '',
      ]);
    },
  });
})();
