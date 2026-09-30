/*
 * driver-shell - the role-specific part of the portal layout (Angular: src/app/layout/driver-shell/driver-shell.component.*):
 * its host element, badge, titles and navigation. The layout itself is common/portal-shell (+ sidebar, portal-header,
 * portal-footer).
 */
window.PortalConfig = {
  tag: 'app-driver-shell', badge: 'Driver', title: 'Driver Console', footer: 'Driver Portal', collapsible: true,
  navItems: [
    { path: '/driver/dashboard', label: 'Active Delivery', icon: 'fa-motorcycle' },
    { path: '/driver/trips', label: 'Earnings & Trips', icon: 'fa-wallet' },
    { path: '/driver/support', label: 'Support', icon: 'fa-headset' },
    { path: '/driver/profile', label: 'Profile', icon: 'fa-id-card' },
  ],
};
