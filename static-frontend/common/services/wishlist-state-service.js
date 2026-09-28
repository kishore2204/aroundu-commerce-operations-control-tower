/*
 * WishlistStateService - port of the Angular WishlistStateService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const set = (obj, key, value) => { obj[key] = value; App.update(); };

  window.WishlistStateService = {
    items: new Map(),
    loaded: false,
    loadInFlight: null,
    ensureLoaded() {
      if (this.loaded) return Promise.resolve();
      if (this.loadInFlight) return this.loadInFlight;
      this.loadInFlight = WishlistService.list(0, 200).then(
        (page) => { this.items = new Map(page.items.map((item) => [item.product.id, item.id])); this.loaded = true; this.loadInFlight = null; App.update(); },
        () => { this.loaded = false; this.loadInFlight = null; },
      );
      return this.loadInFlight;
    },
    isWishlisted(productId) { return this.items.has(productId); },
    toggle(productId) {
      const wishlistItemId = this.items.get(productId);
      if (wishlistItemId) {
        return WishlistService.remove(wishlistItemId).then(() => { const next = new Map(this.items); next.delete(productId); this.items = next; App.update(); });
      }
      return WishlistService.add({ productId }).then((item) => { this.items = new Map(this.items).set(productId, item.id); App.update(); });
    },
  };
})();
