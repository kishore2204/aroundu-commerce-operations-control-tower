/*
 * <app-serviceability-conflict-dialog> - port of src/app/shared/serviceability-conflict-dialog/serviceability-conflict-dialog.component.*
 */
(function () {
  'use strict';

  window.ServiceabilityConflictDialog = function (data, allowAddressChange, onClosed) {
    const key = 'serviceability-conflict-dialog';
    const inst = U.component(key, () => ({
      init() {
        this.escape = () => {
          if (U.registry[key] === this) this.onClosed(undefined);
        };
        U.onEscape(this.escape);
      },
      destroy() {
        App.escapeHandlers = App.escapeHandlers.filter((f) => f !== this.escape);
      },
    }));
    inst.onClosed = onClosed;
    const r = inst.ref;
    const nameFor = (id) => data.productNames[id] ?? `Product #${id}`;
    return U.tpl('serviceability-conflict-dialog', [
      r,
      r,
      U.each(data.lines, (line) =>
        U.tpl('serviceability-conflict-dialog-1', [nameFor(line.productId), r, line.productId, r, line.productId]),
      ),
      allowAddressChange !== false ? U.tpl('serviceability-conflict-dialog-2', [r]) : '',
    ]);
  };
})();
