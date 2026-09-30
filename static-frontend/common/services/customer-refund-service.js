/*
 * CustomerRefundService - port of the Angular CustomerRefundService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.CustomerRefundService = {
    create: (request) => Api.post('/api/customer-refunds', request),
    byTicket: (id) => Api.get(`/api/customer-refunds/by-ticket/${id}`),
    eligibility: (id) => Api.get(`/api/customer-refunds/eligibility/by-ticket/${id}`),
    approve: (id) => Api.post(`/api/customer-refunds/${id}/approve`, {}),
    reject: (id, reason) => Api.post(`/api/customer-refunds/${id}/reject`, reason ? { reason } : {}),
    complete: (id) => Api.post(`/api/customer-refunds/${id}/complete`, {}),
  };
})();
