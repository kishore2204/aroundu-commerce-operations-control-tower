/*
 * <app-serviceability-conflict-dialog> - port of src/app/shared/serviceability-conflict-dialog/serviceability-conflict-dialog.component.*
 */
(function () {
  'use strict';

  const html = U.html;

  window.ServiceabilityConflictDialog = function (data, allowAddressChange, onClosed) {
    const key = 'serviceability-conflict-dialog';
    const inst = U.component(key, () => ({
      init() { this.escape = () => { if (U.registry[key] === this) this.onClosed(undefined); }; U.onEscape(this.escape); },
      destroy() { App.escapeHandlers = App.escapeHandlers.filter((f) => f !== this.escape); },
    }));
    inst.onClosed = onClosed;
    const r = inst.ref;
    const nameFor = (id) => data.productNames[id] ?? `Product #${id}`;
    return html`
      <app-serviceability-conflict-dialog><div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onclick="${r}.onClosed(undefined)">
        <div class="card w-full max-w-lg max-h-[85vh] overflow-y-auto" onclick="event.stopPropagation()">
          <div class="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
            <h2 class="text-base font-semibold text-slate-800 m-0">This product is not serviceable at this location.</h2>
            <button type="button" class="btn-icon !w-8 !h-8 shrink-0" aria-label="Close" onclick="${r}.onClosed(undefined)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="p-5">
            <ul class="list-none m-0 p-0 flex flex-col gap-3">
              ${U.each(data.lines, (line) => html`
                <li class="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-b-0">
                  <div class="flex items-center gap-2 min-w-0">
                    <i class="fa-solid fa-circle-exclamation text-rose-600"></i>
                    <span class="font-medium text-slate-800 truncate">${nameFor(line.productId)}</span>
                  </div>
                  <div class="flex gap-2 shrink-0">
                    <button type="button" class="btn-outline !py-1.5 !px-3 text-xs" onclick="${r}.onClosed({ type: 'try-another-shop', productId: ${line.productId} })">
                      Try Another Shop
                    </button>
                    <button type="button" class="text-xs font-medium text-rose-600 hover:underline px-1" onclick="${r}.onClosed({ type: 'remove', productId: ${line.productId} })">
                      Remove
                    </button>
                  </div>
                </li>`)}
            </ul>
          </div>

          ${allowAddressChange !== false ? html`
            <div class="flex justify-end p-5 pt-0">
              <button type="button" class="btn-primary" onclick="${r}.onClosed({ type: 'change-address' })">Choose a Different Address</button>
            </div>` : ''}
        </div>
      </div></app-serviceability-conflict-dialog>`;
  };
})();
