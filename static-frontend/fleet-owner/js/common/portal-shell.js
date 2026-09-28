/*
 * Portal layout shell - port of layout/*-shell/*-shell.component.*: the sidebar, the top header, the page and
 * the footer of the signed-in portals. The sidebar, header and footer live in sidebar.js, header.js and footer.js.
 */
(function () {
  'use strict';

  const html = U.html;

  const PORTALS = {
    fleet: {
      tag: 'app-fleet-shell', badge: 'Fleet', title: 'Fleet Portal', footer: 'Fleet Portal', collapsible: true, verificationLink: '/fleet/onboarding',
      loadTerritory(state) {
        FleetOwnerService.resolveMine().then((owner) => {
          if (!owner || !owner.cityId) return;
          TerritoryService.cities().then((cityPage) => {
            const city = cityPage.content.find((c) => c.id === owner.cityId);
            const cityName = city ? city.cityName : 'Unknown city';
            if (!owner.zoneId) { state.myTerritory = cityName; return; }
            TerritoryService.zones(owner.cityId).then((zonePage) => {
              const zone = zonePage.content.find((z) => z.zoneId === owner.zoneId);
              state.myTerritory = `${cityName} · ${zone ? zone.zoneName : 'Unknown zone'}`;
            }, () => { state.myTerritory = cityName; });
          }, () => {});
        }, () => {});
      },
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
