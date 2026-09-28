/*
 * <app-loading-state> - port of src/app/shared/loading-state/loading-state.component.*
 */
(function () {
  'use strict';

  const html = U.html;

  window.LoadingState = function (opts = {}) {
    const message = opts.message === undefined ? 'Loading...' : opts.message;
    const diameter = opts.diameter || 40;
    return html`
      <app-loading-state class="${opts.hostClass || ''}"><div class="flex flex-col items-center justify-center gap-3 py-12 px-4">
        <div class="spinner" style="width: ${diameter}px; height: ${diameter}px;"></div>
        ${message ? html`<p class="message text-sm text-slate-500 m-0">${message}</p>` : ''}
      </div></app-loading-state>`;
  };
})();
