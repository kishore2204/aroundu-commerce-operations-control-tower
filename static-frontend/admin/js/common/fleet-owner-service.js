/*
 * FleetOwnerService - port of the Angular FleetOwnerService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const set = (obj, key, value) => { obj[key] = value; App.update(); };

  window.FleetOwnerService = {
    myFleetOwner: null,
    register(request) { return Api.post('/api/fleet-owners/register', request).then((o) => { set(this, 'myFleetOwner', o); return o; }); },
    get(id) { return Api.get(`/api/fleet-owners/${id}`).then((o) => { set(this, 'myFleetOwner', o); return o; }); },
    update(id, request) { return Api.put(`/api/fleet-owners/${id}`, request).then((o) => { set(this, 'myFleetOwner', o); return o; }); },
    resolveMine() {
      if (this.myFleetOwner && this.myFleetOwner.userAccountId === AuthService.userAccountId()) return Promise.resolve(this.myFleetOwner);
      return Api.get('/api/fleet-owners/me').then((o) => { set(this, 'myFleetOwner', o); return o; }, (err) => (err && err.status === 404 ? null : Promise.reject(err)));
    },
    submitDocuments(fleetOwnerId, documents) {
      const payload = documents.map((d) => Object.assign({ verificationQueueId: '00000000-0000-0000-0000-000000000000', documentStatus: 'PENDING', versionNumber: 1 }, d));
      return Api.post(`/api/fleet-owners/${fleetOwnerId}/documents`, payload);
    },
    submitForVerification: (id) => Api.post(`/api/fleet-owners/${id}/submit-verification`, {}),
    verificationStatus: (id) => Api.get(`/api/fleet-owners/${id}/verification-status`),
  };
})();
