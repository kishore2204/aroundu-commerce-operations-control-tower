/*
 * RetailerService - port of the Angular RetailerService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const unwrap = Api.unwrap;
  const set = (obj, key, value) => { obj[key] = value; App.update(); };

  window.RetailerService = {
    myRetailer: null,
    register(request) { return Api.post('/api/retailers/register', request).then((r) => { set(this, 'myRetailer', r); return r; }); },
    get(id) { return Api.get(`/api/retailers/${id}`).then((r) => { set(this, 'myRetailer', r); return r; }); },
    update(id, request) { return Api.put(`/api/retailers/${id}`, request).then((r) => { set(this, 'myRetailer', r); return r; }); },
    resolveMine() {
      if (this.myRetailer && this.myRetailer.userAccountId === AuthService.userAccountId()) return Promise.resolve(this.myRetailer);
      return Api.get('/api/retailers/me').then((r) => { set(this, 'myRetailer', r); return r; }, (err) => (err && err.status === 404 ? null : Promise.reject(err)));
    },
    submitDocuments(retailerId, documents) {
      const payload = documents.map((d) => Object.assign({ verificationQueueId: '00000000-0000-0000-0000-000000000000', documentStatus: 'PENDING', versionNumber: 1 }, d));
      return Api.post(`/api/retailers/${retailerId}/documents`, payload);
    },
    submitForVerification: (id) => Api.post(`/api/retailers/${id}/submit-verification`, {}),
    verificationStatus: (id) => Api.get(`/api/retailers/${id}/verification-status`),
    getPublicSummary: (id) => Api.get(`/api/v1/retailers/${id}`).then(unwrap),
    ratingSummary: (id) => Api.get(`/api/v1/retailers/${id}/rating-summary`).then(unwrap),
  };
})();
