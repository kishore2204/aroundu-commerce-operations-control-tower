/*
 * Customer layout shell - port of layout/shell/shell.component.*: the customer header, the page, the mobile
 * bottom navigation and the footer, stacked in a full-height column (sticky footer). The header, bottom
 * navigation and footer live in header.js, bottom-nav.js and footer.js.
 */
(function () {
  'use strict';

  window.Shell = {
    state: null,
    init() {
      this.state = U.state({
        accountMenuOpen: false,
        notificationsOpen: false,
        notifications: [],
        clearingNotifications: false,
        unreadCount: 0,
        addressMenuOpen: false,
        myAddresses: [],
        switchingAddress: false,
      });
      this.currentYear = new Date().getFullYear();
      CartService.get().catch(() => {});
      this.loadNotifications();
      if (!CustomerZoneService.activeAddress) CustomerZoneService.load();
      U.onEscape(() => this.closeAccountMenu());
    },
    render(outlet) {
      return U.tpl('customer-shell', [this.renderHeader(), outlet, this.renderBottomNav(), this.renderFooter()]);
    },
  };
  window.Layout = window.Shell;
})();
