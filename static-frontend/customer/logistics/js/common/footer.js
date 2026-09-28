/* Customer footer (layout/shell). */
(function () {
  'use strict';

  const html = U.html;

  Shell.renderFooter = function () {
    return html`
<footer class="border-t border-slate-100 px-4 py-6 pb-20 md:pb-6 text-center text-xs font-medium text-slate-400">
  &copy; ${this.currentYear} AroundU &middot; Local Logistics &amp; Hyperlocal Retail Platform
</footer>`;
  };
})();
