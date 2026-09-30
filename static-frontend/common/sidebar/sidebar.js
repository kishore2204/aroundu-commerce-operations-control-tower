/*
 * Portal sidebar (layout/*-shell) - brand, navigation and log out; a drawer below the lg breakpoint.
 * The portals have a collapsible sidebar with a Collapse button; the support staff portal has a fixed one
 * (layout/support-staff-shell).
 */
(function () {
  'use strict';

  Object.assign(PortalShell, {
    toggleSidebar() {
      this.state.sidebarOpen = !this.state.sidebarOpen;
    },
    closeSidebar() {
      this.state.sidebarOpen = false;
    },
    toggleCollapsed() {
      const next = !this.state.collapsed;
      this.state.collapsed = next;
      AppStorage.setItem('aroundu.sidebarCollapsed', String(next));
    },
    renderSidebar() {
      return this.config.collapsible ? this.renderCollapsible() : this.renderFixed();
    },
    renderCollapsible() {
      const c = this.config;
      const s = this.state;
      const collapsed = s.collapsed;
      return U.tpl('sidebar-collapsible', [
        s.sidebarOpen ? U.tpl('sidebar-collapsible-1') : '',
        U.clsMore({
          'sidebar--closed': !s.sidebarOpen,
          'sidebar--open': s.sidebarOpen,
          'sidebar--expanded': !collapsed,
          'sidebar--collapsed': collapsed,
        }),
        !collapsed ? U.tpl('sidebar-collapsible-2', [c.badge]) : '',
        U.each(c.navItems, (item) =>
          U.tpl('sidebar-collapsible-3', [
            Nav.href(item.path),
            U.clsMore({ 'sidebar-link--collapsed': collapsed, 'sidebar-link--active': Nav.isActive(item.path) }),
            collapsed ? item.label : '',
            item.icon,
            !collapsed ? U.tpl('sidebar-collapsible-3-1', [item.label]) : '',
          ]),
        ),
        U.clsMore({ 'sidebar-collapse-button--collapsed': collapsed }),
        U.clsMore({ 'fa-angles-left': !collapsed, 'fa-angles-right': collapsed }),
        !collapsed ? U.tpl('sidebar-collapsible-4') : '',
        U.clsMore({ 'sidebar-logout--collapsed': collapsed }),
        collapsed ? 'Log out' : '',
        !collapsed ? U.tpl('sidebar-collapsible-5') : '',
      ]);
    },
    renderFixed() {
      const c = this.config;
      const s = this.state;
      return U.tpl('sidebar-fixed', [
        s.sidebarOpen ? U.tpl('sidebar-fixed-1') : '',
        U.clsMore({ 'sidebar-fixed--closed': !s.sidebarOpen, 'sidebar-fixed--open': s.sidebarOpen }),
        c.badge,
        U.each(c.navItems, (item) =>
          U.tpl('sidebar-fixed-2', [
            Nav.href(item.path),
            U.clsMore({ 'sidebar-link--active': Nav.isActive(item.path) }),
            item.icon,
            item.label,
          ]),
        ),
      ]);
    },
  });
})();
