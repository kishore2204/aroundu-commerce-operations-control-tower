/* Customer footer (layout/shell). */
(function () {
  'use strict';

  Shell.renderFooter = function () {
    return U.tpl('footer', [this.currentYear]);
  };
})();
