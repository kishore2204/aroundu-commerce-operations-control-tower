/*
 * LocationDashboardService - port of the Angular LocationDashboardService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.LocationDashboardService = {
    summary: (from, to) => Api.get('/api/location-dashboard/summary', { from, to }),
    users(query) { return Api.get('/api/location-dashboard/users', query); },
    retailerReviews: (retailerId, page = 0, size = 5) => Api.get(`/api/location-dashboard/retailers/${retailerId}/reviews`, { page, size }),
    fleetAssets: (id) => Api.get(`/api/location-dashboard/fleet-owners/${id}/assets`),
  };
})();
