/*
 * StateService - port of the Angular StateService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.StateService = {
    all: () => Api.get('/api/states'),
    create: (request) => Api.post('/api/states', request),
    update: (id, request) => Api.put(`/api/states/${id}`, request),
    remove: (id) => Api.delete(`/api/states/${id}`),
  };
})();
