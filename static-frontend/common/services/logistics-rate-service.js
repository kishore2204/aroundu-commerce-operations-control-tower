/*
 * LogisticsRateService - port of the Angular LogisticsRateService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.LogisticsRateService = {
    list: () => Api.get('/api/logistics-rates'),
    update: (rate) => Api.put(`/api/logistics-rates/${rate.vehicleCategory}`, rate),
  };
})();
