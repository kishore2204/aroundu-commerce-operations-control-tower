/*
 * fleet-shell - the role-specific part of the portal layout (Angular: src/app/layout/fleet-shell/fleet-shell.component.*):
 * its host element, badge, titles and navigation. The layout itself is common/portal-shell (+ sidebar, portal-header,
 * portal-footer).
 */
window.PortalConfig = {
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
};
