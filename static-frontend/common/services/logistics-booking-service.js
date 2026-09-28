/*
 * LogisticsBookingService - port of the Angular LogisticsBookingService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.LogisticsBookingService = {
    create: (request) => Api.post('/api/logistics-bookings', request),
    quote: (request) => Api.post('/api/logistics-bookings/quote', request),
    get: (orderId) => Api.get(`/api/logistics-bookings/${orderId}`),
  };
})();
