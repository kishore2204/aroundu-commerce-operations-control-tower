/*
 * Portal layout shell - port of layout/*-shell/*-shell.component.*: the sidebar, the top header, the page and
 * the footer of the signed-in portals. The sidebar, header and footer live in sidebar.js, header.js and footer.js.
 */
(function () {
  'use strict';

  const html = U.html;

  const PORTALS = {
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
