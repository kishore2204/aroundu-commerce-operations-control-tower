/*
 * Portal layout shell - port of layout/*-shell/*-shell.component.*: the sidebar, the top header, the page and
 * the footer of the signed-in portals. The sidebar, header and footer live in sidebar.js, header.js and footer.js.
 */
(function () {
  'use strict';

  const html = U.html;

  const PORTALS = {
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
