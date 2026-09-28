/*
 * <app-retailer-info-dialog> - port of src/app/shared/retailer-info-dialog/retailer-info-dialog.component.*
 */
(function () {
  'use strict';

  const html = U.html;

  window.RetailerInfoDialog = function (key, retailerId, onClosed, onShopSelected) {
    const inst = U.component(key, () => ({
      loading: true, error: false, retailer: null, rating: null,
      init() {
        RetailerService.getPublicSummary(retailerId).then((s) => { this.retailer = s; this.loading = false; App.update(); }, () => { this.error = true; this.loading = false; App.update(); });
        RetailerService.ratingSummary(retailerId).then((s) => { this.rating = s; App.update(); }, () => {});
        this.escape = () => { if (U.registry[key] === this) this.dismiss(); };
        U.onEscape(this.escape);
      },
      destroy() { App.escapeHandlers = App.escapeHandlers.filter((f) => f !== this.escape); },
      dismiss() { this.onClosed(); },
      browseShop() { this.onShopSelected(retailerId); },
    }));
    inst.onClosed = onClosed;
    inst.onShopSelected = onShopSelected;
    const r = inst.ref;
    const shop = inst.retailer;
    return html`
      <app-retailer-info-dialog><div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onclick="${r}.dismiss(); event.stopPropagation(); event.preventDefault()">
        <div class="card w-full max-w-sm" onclick="event.stopPropagation()">
          <div class="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
            <h2 class="text-base font-semibold text-slate-800 m-0 flex items-center gap-2">
              <i class="fa-solid fa-store text-zepto-600"></i> Shop details
            </h2>
            <button type="button" class="btn-icon !w-8 !h-8 shrink-0" aria-label="Close" onclick="${r}.dismiss()">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="p-5">
            ${inst.loading ? html`<div class="flex justify-center py-6"><span class="spinner"></span></div>`
              : inst.error ? html`<p class="text-sm text-rose-600">Couldn't load shop details right now.</p>`
              : shop ? html`
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center gap-1.5">
                    <span class="font-semibold text-base text-slate-900">${shop.businessName}</span>
                    ${shop.retailerStatus === 'VERIFIED' || shop.retailerStatus === 'ACTIVE' ? html`<i class="fa-solid fa-circle-check text-emerald-600 text-sm" title="Verified shop"></i>` : ''}
                  </div>
                  ${inst.rating ? StarRating(inst.rating.average, inst.rating.count) : ''}
                  <p class="text-sm text-slate-500 m-0">Status: ${shop.retailerStatus}</p>
                  ${shop.latitude != null && shop.longitude != null ? html`
                    <p class="text-xs text-slate-500 m-0 flex items-center gap-1 mt-1">
                      <i class="fa-solid fa-location-dot text-[11px]"></i>
                      ${shop.latitude}, ${shop.longitude}
                    </p>` : ''}
                  <button type="button" class="btn-outline !py-1.5 !px-3 text-xs self-start mt-2" onclick="${r}.browseShop()">
                    Browse this shop
                  </button>
                </div>` : ''}
          </div>
        </div>
      </div></app-retailer-info-dialog>`;
  };
})();
