/*
 * operations-shell - the role-specific part of the portal layout (Angular: src/app/layout/operations-shell/operations-shell.component.*):
 * its host element, badge, titles and navigation. The layout itself is common/portal-shell (+ sidebar, portal-header,
 * portal-footer).
 */
window.PortalConfig = {
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
};
