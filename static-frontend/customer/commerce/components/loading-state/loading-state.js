/*
 * <app-loading-state> - port of src/app/shared/loading-state/loading-state.component.*
 */
(function () {
  'use strict';

  window.LoadingState = function (opts = {}) {
    const message = opts.message === undefined ? 'Loading...' : opts.message;
    const diameter = opts.diameter || 40;
    return U.tpl('loading-state', [opts.hostClass || '', diameter, diameter, message ? U.tpl('loading-state-1', [message]) : '']);
  };
})();
