/*
 * OperationsManagerService - port of the Angular OperationsManagerService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.OperationsManagerService = {
    byUser: (id) => Api.get(`/api/v1/operations-managers/by-user/${id}`),
    list: (cityId) => Api.get('/api/v1/operations-managers', { size: 100, cityId }),
    search: (query) => Api.get('/api/v1/operations-managers', { page: query.page ?? 0, size: query.size ?? 10, q: query.q && query.q.trim(), status: query.status, cityId: query.cityId, sort: query.sort }),
    create: (request) => Api.post('/api/v1/operations-managers', request),
    setStatus: (id, status) => Api.patch(`/api/v1/operations-managers/${id}/status`, { status }),
    reassignCity: (id, cityId) => Api.patch(`/api/v1/operations-managers/${id}/city`, { cityId }),
    summary: () => Api.get('/api/v1/operations-managers/summary'),
  };
})();
