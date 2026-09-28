/*
 * ProductService - port of the Angular ProductService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const unwrap = Api.unwrap;

  window.ProductService = {
    search(params) {
      return Api.get('/api/v1/products', { page: params.page ?? 0, size: params.size ?? 20, q: params.q, categoryId: params.categoryId, retailerId: params.retailerId, inStock: params.inStock, zoneId: params.zoneId }).then(unwrap);
    },
    invalidateListings() {},
    get: (id) => Api.get(`/api/v1/products/${id}`).then(unwrap),
    images: (id) => Api.get(`/api/v1/products/${id}/images`).then(unwrap),
    getDetails: (id) => Api.get(`/api/v1/products/${id}/details`).then(unwrap),
  };
})();
