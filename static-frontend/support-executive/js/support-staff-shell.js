/*
 * support-staff-shell - the role-specific part of the portal layout (Angular: src/app/layout/support-staff-shell/support-staff-shell.component.*):
 * its host element, badge, titles and navigation. The layout itself is common/portal-shell (+ sidebar, portal-header,
 * portal-footer).
 */
window.PortalConfig = {
  tag: 'app-support-staff-shell', badge: 'Support', title: 'Support Staff', footer: 'Support Portal', collapsible: false,
  navItems: [
    { path: '/support-staff/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
    { path: '/support-staff/support', label: 'Ticket Queue', icon: 'fa-headset' },
  ],
};
