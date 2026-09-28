/*
 * Customer layout shell - port of layout/shell/shell.component.*: the customer header, the page, the mobile
 * bottom navigation and the footer, stacked in a full-height column (sticky footer). The header, bottom
 * navigation and footer live in header.js, bottom-nav.js and footer.js.
 */
(function () {
  'use strict';

  const html = U.html;

  window.Shell = {
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
    render(outlet) {
      return html`
<app-shell>
${this.renderHeader()}

<main class="mx-auto max-w-[1200px] px-4 pb-24 md:pb-12 pt-6" onclick="Shell.closeAccountMenu()">
  <router-outlet></router-outlet>${outlet}
</main>

${this.renderBottomNav()}

${this.renderFooter()}
</app-shell>`;
    },
  };
  window.Layout = window.Shell;
})();
