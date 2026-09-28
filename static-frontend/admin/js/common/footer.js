/* Portal footer (layout/*-shell). */
(function () {
  'use strict';

  const html = U.html;

  PortalShell.renderFooter = function () {
    const c = this.config;
    return html`
    <footer class="border-t border-slate-100 px-4 sm:px-6 py-3 text-center text-xs text-slate-400">
      &copy; ${this.currentYear} AroundU &middot; ${c.footer}
    </footer>`;
  };
})();
