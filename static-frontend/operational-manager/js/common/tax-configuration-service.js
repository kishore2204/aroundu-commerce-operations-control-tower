/*
 * TaxConfigurationService - port of the Angular TaxConfigurationService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.TaxConfigurationService = {
    list: () => Api.get('/api/tax-configurations'),
    create: (request) => Api.post('/api/tax-configurations', request),
    saveByCategoryName: (request) => Api.post('/api/tax-configurations/by-category-name', request),
    update: (id, request) => Api.put(`/api/tax-configurations/${id}`, request),
    remove: (id) => Api.delete(`/api/tax-configurations/${id}`),
  };
})();
