/*
 * Portal layout shell - port of layout/*-shell/*-shell.component.*: the sidebar, the top header, the page and
 * the footer of the signed-in portals. The sidebar, header and footer live in common/sidebar, common/portal-header
 * and common/portal-footer; each role's navigation, titles and host element come from <role>/js/<role>-shell.js.
 */
(function () {
  'use strict';

  window.PortalShell = {
    config: null,
    state: null,
    init(portal) {
      this.config = window.PortalConfig; // <role>/js/<role>-shell.js
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
      return U.tpl('portal-shell', [this.renderSidebar(), this.renderMain(outlet)]);
    },
    renderMain(outlet) {
      return U.tpl('portal-shell-main', [this.renderHeader(), outlet, this.renderFooter()]);
    },
  };
  window.Layout = window.PortalShell;
})();
