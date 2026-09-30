/*
 * admin-shell - the role-specific part of the portal layout (Angular: src/app/layout/admin-shell/admin-shell.component.*):
 * its host element, badge, titles and navigation. The layout itself is common/portal-shell (+ sidebar, portal-header,
 * portal-footer).
 */
window.PortalConfig = {
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
};
