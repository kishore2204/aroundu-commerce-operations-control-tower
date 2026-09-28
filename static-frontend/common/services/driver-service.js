/*
 * DriverService - port of the Angular DriverService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const MY_DRIVER_IDS_KEY = 'aroundu.myDriverIds';
  window.DriverService = {
    add: (fleetOwnerId, request) => Api.post('/api/drivers', Object.assign({}, request, { fleetOwnerId })),
    submitForVerification: (driverId, submittedByAccountId) => Api.post(`/api/drivers/${driverId}/submit-for-verification`, { submittedByAccountId }),
    get: (id) => Api.get(`/api/drivers/${id}`),
    mine: (fleetOwnerId) => Api.get('/api/drivers/mine', { fleetOwnerId }),
    me: () => Api.get('/api/drivers/me'),
    updateMe: (licenseNumber, licenseExpiryDate) => Api.put('/api/drivers/me', { licenseNumber, licenseExpiryDate }),
    rememberDriverId(id) { const ids = this.myDriverIds(); if (!ids.includes(id)) { ids.unshift(id); AppStorage.setItem(MY_DRIVER_IDS_KEY, JSON.stringify(ids)); } },
    myDriverIds() { try { return JSON.parse(AppStorage.getItem(MY_DRIVER_IDS_KEY) || '[]'); } catch (e) { return []; } },
  };
})();
