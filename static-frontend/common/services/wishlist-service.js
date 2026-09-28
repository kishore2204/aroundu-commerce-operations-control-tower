/*
 * WishlistService - port of the Angular WishlistService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const unwrap = Api.unwrap;

  window.WishlistService = {
    list: (page = 0, size = 20) => Api.get('/api/v1/customers/me/wishlist-items', { page, size }).then(unwrap),
    summary: () => Api.get('/api/v1/customers/me/wishlist-items/summary').then(unwrap),
    add: (request) => Api.post('/api/v1/customers/me/wishlist-items', request).then(unwrap),
    remove: (id) => Api.delete(`/api/v1/customers/me/wishlist-items/${id}`),
  };
})();
