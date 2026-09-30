/*
 * <app-confirm-dialog> - port of src/app/shared/confirm-dialog/confirm-dialog.component.*
 */
(function () {
  'use strict';

  /*
   * ConfirmDialog({ key, title, message, confirmLabel, cancelLabel, busyLabel, danger, busy, onConfirm, onCancel })
   * Focuses Cancel when it first appears; Escape cancels unless busy.
   */
  window.ConfirmDialog = function (opts) {
    const key = opts.key || 'confirm-dialog';
    const inst = U.component(key, () => ({
      init() {
        App.nextRender(() => {
          const b = document.querySelector(`[data-confirm-cancel="${key}"]`);
          if (b) b.focus();
        });
        this.escape = () => {
          if (U.registry[key] === this && !this.opts.busy) this.opts.onCancel && this.opts.onCancel();
        };
        U.onEscape(this.escape);
      },
      destroy() {
        App.escapeHandlers = App.escapeHandlers.filter((f) => f !== this.escape);
      },
    }));
    inst.opts = opts;
    const danger = !!opts.danger;
    const busy = !!opts.busy;
    return U.tpl('confirm-dialog', [
      U.clsMore({ 'bg-rose-50': danger, 'text-rose-600': danger, 'bg-amber-50': !danger, 'text-amber-600': !danger }),
      opts.title,
      opts.message,
      key,
      U.dis(busy),
      key,
      opts.cancelLabel || 'Cancel',
      U.clsMore({ '!bg-gradient-to-br': danger, '!from-rose-600': danger, '!to-rose-500': danger }),
      U.dis(busy),
      key,
      busy ? U.tpl('confirm-dialog-1', [opts.busyLabel || 'Processing...']) : U.tpl('confirm-dialog-2', [opts.confirmLabel || 'Confirm']),
    ]);
  };
})();
