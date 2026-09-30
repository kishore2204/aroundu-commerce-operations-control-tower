/*
 * VehicleService - port of the Angular VehicleService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const MY_VEHICLE_IDS_KEY = 'aroundu.myVehicleIds';
  window.VehicleService = {
    add: (fleetOwnerId, request) => Api.post('/api/vehicles', Object.assign({}, request, { fleetOwnerId })),
    submitForVerification: (vehicleId, submittedByAccountId) => Api.post(`/api/vehicles/${vehicleId}/submit-for-verification`, { submittedByAccountId }),
    get: (id) => Api.get(`/api/vehicles/${id}`),
    mine: (fleetOwnerId) => Api.get('/api/vehicles/mine', { fleetOwnerId }),
    rememberVehicleId(id) { const ids = this.myVehicleIds(); if (!ids.includes(id)) { ids.unshift(id); AppStorage.setItem(MY_VEHICLE_IDS_KEY, JSON.stringify(ids)); } },
    myVehicleIds() { try { return JSON.parse(AppStorage.getItem(MY_VEHICLE_IDS_KEY) || '[]'); } catch (e) { return []; } },
  };
})();
