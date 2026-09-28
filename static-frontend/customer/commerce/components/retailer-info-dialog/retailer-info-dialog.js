/*
 * <app-retailer-info-dialog> - port of src/app/shared/retailer-info-dialog/retailer-info-dialog.component.*
 */
(function () {
  'use strict';

  window.RetailerInfoDialog = function (key, retailerId, onClosed, onShopSelected) {
    const inst = U.component(key, () => ({
      loading: true,
      error: false,
      retailer: null,
      rating: null,
      init() {
        RetailerService.getPublicSummary(retailerId).then(
          (s) => {
            this.retailer = s;
            this.loading = false;
            App.update();
          },
          () => {
            this.error = true;
            this.loading = false;
            App.update();
          },
        );
        RetailerService.ratingSummary(retailerId).then(
          (s) => {
            this.rating = s;
            App.update();
          },
          () => {},
        );
        this.escape = () => {
          if (U.registry[key] === this) this.dismiss();
        };
        U.onEscape(this.escape);
      },
      destroy() {
        App.escapeHandlers = App.escapeHandlers.filter((f) => f !== this.escape);
      },
      dismiss() {
        this.onClosed();
      },
      browseShop() {
        this.onShopSelected(retailerId);
      },
    }));
    inst.onClosed = onClosed;
    inst.onShopSelected = onShopSelected;
    const r = inst.ref;
    const shop = inst.retailer;
    return U.tpl('retailer-info-dialog', [
      r,
      r,
      inst.loading
        ? U.tpl('retailer-info-dialog-1')
        : inst.error
          ? U.tpl('retailer-info-dialog-2')
          : shop
            ? U.tpl('retailer-info-dialog-3', [
                shop.businessName,
                shop.retailerStatus === 'VERIFIED' || shop.retailerStatus === 'ACTIVE' ? U.tpl('retailer-info-dialog-3-1') : '',
                inst.rating ? StarRating(inst.rating.average, inst.rating.count) : '',
                shop.retailerStatus,
                shop.latitude != null && shop.longitude != null ? U.tpl('retailer-info-dialog-3-2', [shop.latitude, shop.longitude]) : '',
                r,
              ])
            : '',
    ]);
  };
})();
