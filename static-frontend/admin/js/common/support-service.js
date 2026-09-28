/*
 * SupportService - port of the Angular SupportService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.SupportService = {
    create: (request) => Api.post('/api/support-tickets', request),
    list: () => Api.get('/api/support-tickets'),
    mine: () => Api.get('/api/support-tickets/mine'),
    mineAsDriver: () => Api.get('/api/support-tickets/mine-as-driver'),
    escalatedToMe: () => Api.get('/api/support-tickets/escalated-to-me'),
    escalatedToEntity: (entityType, entityId) => Api.get('/api/support-tickets/escalated-to-entity', { entityType, entityId }),
    getContext: (id) => Api.get(`/api/support-tickets/${id}/context`),
    get: (id) => Api.get(`/api/support-tickets/${id}`),
    update: (id, request) => Api.put(`/api/support-tickets/${id}`, request),
    assign: (id, supportAccountId) => Api.post(`/api/support-tickets/${id}/assign`, { supportAccountId }),
    resolve: (id) => Api.post(`/api/support-tickets/${id}/resolve`, {}),
    close: (id) => Api.post(`/api/support-tickets/${id}/close`, {}),
    escalate: (id, request) => Api.post(`/api/support-tickets/${id}/escalate`, request),
    getMessages: (id) => Api.get(`/api/support-tickets/${id}/messages`),
    addMessage: (id, request) => Api.post(`/api/support-tickets/${id}/messages`, request),
    getDeliveryProof: (id) => Api.get(`/api/support-tickets/${id}/delivery-proof`),
  };
})();
