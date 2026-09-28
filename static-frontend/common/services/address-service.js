/*
 * AddressService - port of the Angular AddressService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const unwrap = Api.unwrap;

  window.AddressService = {
    list: (page = 0, size = 20) => Api.get('/api/v1/customers/me/addresses', { page, size }).then(unwrap),
    invalidate() {},
    get: (id) => Api.get(`/api/v1/customers/me/addresses/${id}`).then(unwrap),
    getDefault: () => Api.get('/api/v1/customers/me/addresses/default').then(unwrap),
    create: (request) => Api.post('/api/v1/customers/me/addresses', request).then(unwrap),
    update: (id, request) => Api.patch(`/api/v1/customers/me/addresses/${id}`, request).then(unwrap),
    remove: (id) => Api.delete(`/api/v1/customers/me/addresses/${id}`),
    setDefault: (id) => Api.put(`/api/v1/customers/me/addresses/${id}/default`, {}).then(unwrap),
  };
})();
