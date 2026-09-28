/*
 * InventoryService - port of the Angular InventoryService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const unwrap = Api.unwrap;

  window.InventoryService = {
    search: (q, categoryId, inventoryStatus, page = 0, size = 20) => Api.get('/api/v1/retailers/me/inventory', { page, size, q, categoryId, inventoryStatus }).then(unwrap),
    summary: () => Api.get('/api/v1/retailers/me/inventory/summary').then(unwrap),
    adjust: (request) => Api.post('/api/v1/retailers/me/inventory/adjustments', request).then(unwrap),
  };
})();
