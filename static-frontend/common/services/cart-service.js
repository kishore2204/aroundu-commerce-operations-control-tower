/*
 * CartService - port of the Angular CartService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const unwrap = Api.unwrap;
  const set = (obj, key, value) => { obj[key] = value; App.update(); };

  window.CartService = {
    itemCount: 0,
    items: [],
    itemForProduct(productId) { return this.items.find((item) => item.productId === productId); },
    get() {
      return Api.get('/api/v1/cart').then(unwrap).then((cart) => {
        this.itemCount = cart.distinctProducts;
        this.items = cart.items;
        App.update();
        return cart;
      });
    },
    addItem(request) { return Api.post('/api/v1/cart/items', request).then(unwrap).then((r) => { this.refreshCount(); return r; }); },
    updateItem(cartItemId, request) { return Api.patch(`/api/v1/cart/items/${cartItemId}`, request).then(unwrap).then((r) => { this.refreshCount(); return r; }); },
    removeItem(cartItemId) { return Api.delete(`/api/v1/cart/items/${cartItemId}`).then((r) => { this.refreshCount(); return r; }); },
    clear() { return Api.delete('/api/v1/cart').then((r) => { set(this, 'itemCount', 0); return r; }); },
    validate: () => Api.post('/api/v1/cart/validate', {}).then(unwrap),
    moveToWishlist(cartItemId) { return Api.post(`/api/v1/cart/items/${cartItemId}/move-to-wishlist`, {}).then((r) => { this.refreshCount(); return r; }); },
    checkServiceability: (request) => Api.post('/api/v1/cart/serviceability-check', request).then(unwrap),
    refreshCount() { this.get().catch(() => {}); },
  };
})();
