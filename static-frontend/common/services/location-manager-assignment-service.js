/*
 * LocationManagerAssignmentService - port of the Angular LocationManagerAssignmentService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.LocationManagerAssignmentService = {
    mine: () => Api.get('/api/v1/location-managers/me'),
    list: (zoneId, operationsManagerId, status, name) => Api.get('/api/v1/location-managers', { size: 100, zoneId, operationsManagerId, status, name: name && name.trim() }),
    create: (request) => Api.post('/api/v1/location-managers', request),
    createOfficer: (request) => Api.post('/api/v1/location-managers/officers', request),
    transferCandidates: (id) => Api.get(`/api/v1/location-managers/${id}/transfer-candidates`),
    transfer: (assignment, zoneId) => Api.put(`/api/v1/location-managers/${assignment.locationManagerId}/transfer`, { userAccountId: assignment.userAccountId, zoneId, operationsManagerId: assignment.operationsManagerId }),
    setActive: (id, active) => Api.patch(`/api/v1/location-managers/${id}/${active ? 'activate' : 'deactivate'}`, {}),
  };
})();
