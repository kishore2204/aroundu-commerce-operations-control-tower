/*
 * retailer-shell - the role-specific part of the portal layout (Angular: src/app/layout/retailer-shell/retailer-shell.component.*):
 * its host element, badge, titles and navigation. The layout itself is common/portal-shell (+ sidebar, portal-header,
 * portal-footer).
 */
window.PortalConfig = {
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
};
