/*
 * <app-confirm-dialog> - port of src/app/shared/confirm-dialog/confirm-dialog.component.*
 */
(function () {
  'use strict';

  const html = U.html;

  /*
   * ConfirmDialog({ key, title, message, confirmLabel, cancelLabel, busyLabel, danger, busy, onConfirm, onCancel })
   * Focuses Cancel when it first appears; Escape cancels unless busy.
   */
  window.ConfirmDialog = function (opts) {
    const key = opts.key || 'confirm-dialog';
    const inst = U.component(key, () => ({
      init() {
        App.nextRender(() => { const b = document.querySelector(`[data-confirm-cancel="${key}"]`); if (b) b.focus(); });
        this.escape = () => { if (U.registry[key] === this && !this.opts.busy) this.opts.onCancel && this.opts.onCancel(); };
        U.onEscape(this.escape);
      },
      destroy() { App.escapeHandlers = App.escapeHandlers.filter((f) => f !== this.escape); },
    }));
    inst.opts = opts;
    const danger = !!opts.danger;
    const busy = !!opts.busy;
    return html`
      <app-confirm-dialog><div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div class="card w-full max-w-md" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
          <div class="flex items-start gap-3">
            <span class="${U.cls('grid h-10 w-10 shrink-0 place-items-center rounded-full', { 'bg-rose-50': danger, 'text-rose-600': danger, 'bg-amber-50': !danger, 'text-amber-600': !danger })}">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </span>
            <div class="min-w-0">
              <h2 id="confirm-dialog-title" class="m-0 text-lg font-bold text-slate-900">${opts.title}</h2>
              <p id="confirm-dialog-message" class="m-0 mt-1 text-sm text-slate-600">${opts.message}</p>
            </div>
          </div>
          <div class="mt-5 flex justify-end gap-2">
            <button type="button" class="btn-outline" data-confirm-cancel="${key}" ${U.dis(busy)} onclick="U.$('${key}').opts.onCancel()">${opts.cancelLabel || 'Cancel'}</button>
            <button type="button" class="${U.cls('btn-primary', { '!bg-gradient-to-br': danger, '!from-rose-600': danger, '!to-rose-500': danger })}"
              ${U.dis(busy)} onclick="U.$('${key}').opts.onConfirm()">
              ${busy ? html`<span class="spinner !h-4 !w-4 !border-white/40 !border-t-white"></span> ${opts.busyLabel || 'Processing...'}` : html`${opts.confirmLabel || 'Confirm'}`}
            </button>
          </div>
        </div>
      </div></app-confirm-dialog>`;
  };
})();
