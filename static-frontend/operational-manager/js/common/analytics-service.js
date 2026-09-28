/*
 * AnalyticsService - port of the Angular AnalyticsService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.AnalyticsService = { overview: () => Api.get('/api/analytics/overview'), refundRegions: () => Api.get('/api/analytics/refunds/by-region') };
})();
