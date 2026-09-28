/*
 * SettlementService - port of the Angular SettlementService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.SettlementService = {
    list: () => Api.get('/api/settlements'),
    create: (request) => Api.post('/api/settlements', request),
    update: (id, request) => Api.put(`/api/settlements/${id}`, request),
    complete: (id) => Api.post(`/api/settlements/${id}/complete`, {}),
    remove: (id) => Api.delete(`/api/settlements/${id}`),
  };
})();
