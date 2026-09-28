/* Portal footer (layout/*-shell). */
(function () {
  'use strict';

  PortalShell.renderFooter = function () {
    const c = this.config;
    return U.tpl('portal-footer', [this.currentYear, c.footer]);
  };
})();
