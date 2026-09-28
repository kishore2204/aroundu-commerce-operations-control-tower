/*
 * TripService - port of the Angular TripService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.TripService = {
    create: (request) => Api.post('/api/trips', request),
    mine: (fleetOwnerId) => Api.get('/api/trips/mine', { fleetOwnerId }),
    driverMine: () => Api.get('/api/trips/driver/mine'),
    update: (id, request) => Api.put(`/api/trips/${id}`, request),
    confirmPickup: (id, proof) => Api.post(`/api/trips/${id}/pickup/confirm`, { proof }),
    complete: (id, proof) => Api.post(`/api/trips/${id}/complete`, { proof }),
    history: (id) => Api.get(`/api/trips/${id}/history`),
  };
})();
