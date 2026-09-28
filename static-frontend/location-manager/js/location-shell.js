/*
 * location-shell - the role-specific part of the portal layout (Angular: src/app/layout/location-shell/location-shell.component.*):
 * its host element, badge, titles and navigation. The layout itself is common/portal-shell (+ sidebar, portal-header,
 * portal-footer).
 */
window.PortalConfig = {
  tag: 'app-location-shell', badge: 'Location', title: 'Location Manager', footer: 'Location Manager Portal', collapsible: true,
  loadTerritory(state) {
    LocationManagerAssignmentService.mine().then((mine) => { state.myTerritory = `${mine.cityName ?? 'Unknown city'} · ${mine.zoneName ?? 'Unknown zone'}`; }, () => {});
  },
  navItems: [
    { path: '/location/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
    { path: '/location/queue', label: 'Verification Queue', icon: 'fa-clipboard-check' },
    { path: '/location/notifications', label: 'Notifications', icon: 'fa-bell' },
    { path: '/location/support', label: 'Support', icon: 'fa-headset' },
  ],
};
