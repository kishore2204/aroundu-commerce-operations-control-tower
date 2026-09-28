/*
 * TerritoryService - port of the Angular TerritoryService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.TerritoryService = {
    cities: (active) => Api.get('/api/v1/cities', { size: 100, active }),
    zones: (cityId, active) => Api.get('/api/v1/zones', { size: 100, cityId, active }),
    city: (id) => Api.get(`/api/v1/cities/${id}`),
    zone: (id) => Api.get(`/api/v1/zones/${id}`),
    createCity: (request) => Api.post('/api/v1/cities', request),
    setCityActive: (id, active) => Api.patch(`/api/v1/cities/${id}/${active ? 'activate' : 'deactivate'}`, {}),
    createZone: (request) => Api.post('/api/v1/zones', request),
    setZoneActive: (id, active) => Api.patch(`/api/v1/zones/${id}/${active ? 'activate' : 'deactivate'}`, {}),
  };
})();
