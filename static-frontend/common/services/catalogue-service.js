/*
 * CatalogueService - port of the Angular CatalogueService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const unwrap = Api.unwrap;

  window.CatalogueService = {
    search(params) {
      return Api.get('/api/v1/retailers/me/products', { page: params.page ?? 0, size: params.size ?? 20, q: params.q, categoryId: params.categoryId, status: params.status, inventoryStatus: params.inventoryStatus }).then(unwrap);
    },
    summary: () => Api.get('/api/v1/retailers/me/products/summary').then(unwrap),
    create: (request) => Api.post('/api/v1/retailers/me/products', request).then(unwrap),
    update: (id, request) => Api.patch(`/api/v1/retailers/me/products/${id}`, request).then(unwrap),
    duplicate: (id) => Api.post(`/api/v1/retailers/me/products/${id}/duplicate`, {}).then(unwrap),
    images: (id) => Api.get(`/api/v1/retailers/me/products/${id}/images`).then(unwrap),
    uploadImages(id, files) {
      return Promise.all(Array.from(files).map(Api.readFile)).then((list) => Api.post(`/api/v1/retailers/me/products/${id}/images`, { files: list }).then(unwrap));
    },
    remove: (id) => Api.delete(`/api/v1/retailers/me/products/${id}`),
  };
})();
