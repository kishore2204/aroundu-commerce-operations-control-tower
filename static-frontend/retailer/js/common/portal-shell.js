/*
 * Portal layout shell - port of layout/*-shell/*-shell.component.*: the sidebar, the top header, the page and
 * the footer of the signed-in portals. The sidebar, header and footer live in sidebar.js, header.js and footer.js.
 */
(function () {
  'use strict';

  const html = U.html;

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
  };

  window.PortalShell = {
    config: null,
    state: null,
    init(portal) {
      this.config = PORTALS[portal];
      this.state = U.state({
        sidebarOpen: false,
        accountMenuOpen: false,
        collapsed: this.config.collapsible ? AppStorage.getItem('aroundu.sidebarCollapsed') === 'true' : false,
        myTerritory: null,
      });
      this.currentYear = new Date().getFullYear();
      if (this.config.loadTerritory) this.config.loadTerritory(this.state);
    },
    render(outlet) {
      const c = this.config;
      return html`
${U.raw('<' + c.tag + '>')}
<div class="min-h-screen bg-slate-50 flex">
  ${this.renderSidebar()}

  ${this.renderMain(outlet)}
</div>
${U.raw('</' + c.tag + '>')}`;
    },
    renderMain(outlet) {
      return html`
  <div class="flex-1 min-w-0 flex flex-col">
    ${this.renderHeader()}

    <main class="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6">
      <router-outlet></router-outlet>${outlet}
    </main>

    ${this.renderFooter()}
  </div>`;
    },
  };
  window.Layout = window.PortalShell;
})();
